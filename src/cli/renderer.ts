import chalk from "chalk";
import ora, { type Ora } from "ora";
import path from "path";
import { AGENT_ICONS, AGENT_LABELS, AgentRole } from "../types/index.js";
import { MarkdownStream } from "streammark";
import { AIMessageChunk, ToolMessage } from "@langchain/core/messages";

const O = chalk.hex("#FF8C00");
const DIM = chalk.hex("#996600");
const G = chalk.green;
const GY = chalk.gray;
const CY = chalk.cyan;
const WH = chalk.white;
const YL = chalk.yellow;
const RD = chalk.red;


// ── Public interrupt type consumed by index.ts ────────────────────────────────
export interface ActionRequest {
  name: string;
  args: Record<string, unknown>;
}
export interface ReviewConfig {
  actionName: string;
  allowedDecisions: string[];
}
export interface InterruptInfo {
  actionRequests: ActionRequest[];
  reviewConfigs: ReviewConfig[];
}

interface ActiveAgent {
  name: string;
  status: "spawned" | "working" | "done";
  toolCallId: string;
}

interface PendingTool {
  name: string;
  argsBuffer: string;
  agentName: string;
  shownContentLength?: number;  // Track how much content has been printed
  filePath?: string;            // Track file path for write_file/edit_file
}

export class StreamRenderer {
  
  private agents = new Map<string, ActiveAgent>();
  private namespaceToAgent = new Map<string, string>();
  private pendingTool: PendingTool | null = null;
  private tokenBuffer = "";
  private mdStream: MarkdownStream | null = null;
  private mainSpinner: Ora | null = null;
  private toolSpinner: Ora | null = null;
  private thinkingSpinner: Ora | null = null;
  private currentSource = "";  // Track which agent is currently streaming tokens
  private midLine = false;     // Track if we're in the middle of a line


  constructor(private readonly isHeadless: boolean = false) {}

  printHeader(): void {
    const p = chalk.hex("#FF6A00"); // SajiOrange
    const w = chalk.hex("#FFFFFF"); // White
    const g = chalk.gray;           // Subdued UI elements

    console.log("");
    // The "Prompt" Icon + Wordmark
    console.log(`  ${p("┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓")}`);
    console.log(`  ${p("┃")}  ${p.bold(">_")} ${p.bold("SAJI")}${w.bold("CODE")} ${g("│")} ${w("The AI Engineering Team")}         ${p("┃")}`);
    console.log(`  ${p("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛")}`);
    
  
}

  printSessionInfo(info: {
    model: string;
    project: string;
    thread: string;
    hasContext: boolean;
    hitlEnabled: boolean;
    mcpServerCount?: number;
  }): void {
    const label = chalk.hex("#666666");
    const value = chalk.hex("#AAAAAA");
    const dim = chalk.hex("#444444");

    console.log(dim("  ─── Session ───────────────────────────────────────"));
    console.log(`  ${label("model")}     ${value(info.model)}`);
    console.log(`  ${label("project")}   ${value(info.project)}`);
    console.log(`  ${label("thread")}    ${dim(info.thread)}`);
    if (info.hasContext) {
      console.log(`  ${label("context")}   ${G("● ")}${value("SAJICODE.md loaded")}`);
    } else {
      console.log(`  ${label("context")}   ${dim("○ ")}${dim("none — run /init")}`);
    }
    const hitlStatus = info.hitlEnabled
      ? `${YL("● ")}${value("human-in-the-loop ON")}`
      : `${dim("○ ")}${dim("human-in-the-loop off")}`;
    console.log(`  ${label("approval")}  ${hitlStatus}`);
    if (info.mcpServerCount && info.mcpServerCount > 0) {
      console.log(`  ${label("mcp")}       ${G("● ")}${value(`${info.mcpServerCount} server${info.mcpServerCount > 1 ? "s" : ""} connected`)}`);
    }
    console.log(dim("  ─────────────────────────────────────────────────── "));
    console.log("");
  }

  printTeamAssembled(): void {
    const roles = Object.values(AgentRole);
    const dim = chalk.hex("#555555");
    const o = chalk.hex("#FF6A00");
    console.log(`  ${o("┌─")} ${o.bold("Team Assembled")}`);
    for (const role of roles) {
      console.log(`  ${o("│")} ${AGENT_ICONS[role]}  ${dim(AGENT_LABELS[role] ?? role)}`);
    }
    console.log(`  ${o("└─")} ${dim(`${roles.length} agents ready`)}`);
    console.log("");
  }

  printReady(): void {
    const o = chalk.hex("#FF6A00");
    const g = chalk.hex("#666666");
    console.log(`  ${o.bold(">_")} ${chalk.hex("#CC5500")("SajiCode is ready!")}`);
    console.log(`  ${g("Type a task to build, or /help for commands")}`);
    console.log("");
  }

  startSpinner(text: string): void {
    if (this.isHeadless) {
      console.log(`  ${GY("▸")} ${GY(text)}`);
      return;
    }
    this.mainSpinner = ora({
      text: GY(text),
      color: "yellow",
      spinner: "dots",
      prefixText: "  ",
    }).start();
  }

  stopSpinner(text?: string): void {
    if (this.isHeadless) return;
    if (this.mainSpinner) {
      if (text) {
        this.mainSpinner.succeed(GY(text));
      } else {
        this.mainSpinner.stop();
      }
      this.mainSpinner = null;
    }
  }

  private startToolSpinner(text: string): void {
    if (this.isHeadless) return;
    this.stopToolSpinner();
    this.toolSpinner = ora({
      text: GY(text),
      color: "yellow",
      spinner: "dots",
      prefixText: "  ",
    }).start();
  }

  private stopToolSpinner(): void {
    if (this.toolSpinner) {
      this.toolSpinner.stop();
      this.toolSpinner = null;
    }
  }

  

 

  /**
   * Main streaming loop.
   * Handles multiple stream modes: updates, messages, custom.
   * Returns InterruptInfo if the agent paused for HITL approval, null if done normally.
   */
  async processMultiStream(
    stream: AsyncIterable<[string[], any, any?]>
  ): Promise<InterruptInfo | null> {
    
    this.startThinkingSpinner();
    let interrupt: InterruptInfo | null = null;

    for await (const event of stream) {
      // Handle both 2-tuple (single mode) and 3-tuple (multi-mode) formats
      const namespace = event[0];
      const modeOrData = event[1];
      const maybeData = event[2];

      // Determine if this is multi-mode (3-tuple) or single-mode (2-tuple)
      const isMultiMode = maybeData !== undefined;
      const mode = isMultiMode ? modeOrData : "updates";
      const data = isMultiMode ? maybeData : modeOrData;

      const isSubagent = namespace.some((s: string) => s.startsWith("tools:"));
      const source = isSubagent
        ? namespace.find((s: string) => s.startsWith("tools:")) ?? "subagent"
        : "main";

      if (mode === "updates") {
        const result = this.onUpdate(source, namespace, data, isSubagent);
        if (result) interrupt = result;
      } else if (mode === "messages") {
        this.onMessage(source, namespace, data, isSubagent);
      } else if (mode === "custom") {
        // Handle custom events if needed
        this.onCustomEvent(source, namespace, data, isSubagent);
      }
    }

    this.finishPendingTool();
    this.flushBuffer();
    this.stopToolSpinner();
    this.stopThinkingSpinner();
    console.log("");

    return interrupt;
  }

  private startThinkingSpinner(): void {
    this.thinkingSpinner = ora({
      text: GY("Thinking..."),
      color: "yellow",
      spinner: "dots",
      prefixText: "  ",
    }).start();
  }

  private stopThinkingSpinner(): void {
    if (this.thinkingSpinner) {
      this.thinkingSpinner.stop();
      this.thinkingSpinner = null;
    }
  }

  /** Returns InterruptInfo when __interrupt__ is detected, else null */
  private onUpdate(
    source: string,
    namespace: string[],
    data: any,
    isSubagent: boolean
  ): InterruptInfo | null {
    // Detect HITL interrupt — it appears as { __interrupt__: [...] } in updates
    if (data?.__interrupt__) {
      this.flushBuffer();
      this.stopToolSpinner();
      this.stopThinkingSpinner();
      const raw = Array.isArray(data.__interrupt__)
        ? data.__interrupt__[0]?.value
        : data.__interrupt__;
      if (raw?.actionRequests) {
        return raw as InterruptInfo;
      }
      return null;
    }

    for (const [node, nodeData] of Object.entries(data)) {
      if (node === "__metadata__") continue;

      // Detect task() spawns at ANY level — not just main agent
      if (node === "model_request") {
        this.detectSpawns(nodeData);
        // Display AI response content from model_request
        this.renderModelResponse(nodeData, source, isSubagent);
      }

      // Track subagent working status
      if (isSubagent) {
        const nsKey = namespace.find((s: string) => s.startsWith("tools:")) ?? "";
        this.markWorking(nsKey);
      }

      // Detect completions at ANY level where 'tools' node has ToolMessage results
      if (node === "tools") {
        this.detectComplete(nodeData);
        // Display tool results with better formatting
        this.renderToolResults(nodeData, isSubagent, source);
      }
    }

    return null;
  }

  /**
   * Render AI model responses from model_request node data.
   * Note: When using 'messages' stream mode, tokens are printed via onMessage,
   * so this only handles non-streaming cases and tool calls.
   */
  private renderModelResponse(data: any, _source: string, _isSubagent: boolean): void {
    const messages = (data as any)?.messages ?? [];
    for (const msg of messages) {
      // Skip printing content when using token streaming (currentSource indicates streaming is active)
      // Only handle tool calls here
      
      // Handle tool calls in the response
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          if (tc.name) {
            const agentLabel = _isSubagent ? this.subAgentLabel(_source.replace("tools:", "").split(":")[0] ?? "agent") : "PM";
            const icon = _isSubagent ? this.agentIcon(_source.replace("tools:", "").split(":")[0] ?? "agent") : "🎯";
            console.log(`  ${chalk.cyan("→")} ${icon} ${chalk.hex("#AAAAAA")(agentLabel)} ${chalk.gray("calling")} ${chalk.cyan(tc.name)}`);
          }
        }
      }
    }
  }

  /**
   * Render tool execution results with better formatting
   * Skip rendering for file operations - they're handled in finishPendingTool
   */
  private renderToolResults(data: any, isSubagent: boolean = false, source: string = "main"): void {
    const messages = (data as any)?.messages ?? [];
    for (const msg of messages) {
      if (msg.type === "tool" && msg.name) {
        // Skip file operations - they're handled in finishPendingTool with enhanced preview
        if (msg.name === "write_file" || msg.name === "edit_file" || msg.name === "read_file") {
          continue;
        }
        
        const content = String(msg.content ?? "");
        const agentLabel = isSubagent ? this.subAgentLabel(source.replace("tools:", "").split(":")[0] ?? "agent") : "PM";
        const icon = isSubagent ? this.agentIcon(source.replace("tools:", "").split(":")[0] ?? "agent") : "🎯";
        
        // Format tool result based on tool type
        if (msg.name === "execute") {
          // Show command output preview
          const lines = content.split("\n").slice(0, 3);
          console.log(`    ${chalk.green("✓")} ${icon} ${chalk.hex("#AAAAAA")(agentLabel)} ${chalk.gray(msg.name)}`);
          for (const line of lines) {
            if (line.trim()) {
              console.log(`      ${chalk.gray(line.slice(0, 100))}`);
            }
          }
          if (content.split("\n").length > 3) {
            console.log(`      ${chalk.gray(`… ${content.split("\n").length - 3} more lines`)}`);
          }
        } else {
          // Other tools - show short result
          const shortContent = content.slice(0, 120);
          console.log(`    ${chalk.green("✓")} ${icon} ${chalk.hex("#AAAAAA")(agentLabel)} ${chalk.gray(msg.name)}: ${chalk.gray(shortContent)}${content.length > 120 ? "..." : ""}`);
        }
      }
    }
  }

  /**
   * Handle messages stream mode - displays LLM tokens and tool calls.
   */
  private onMessage(
    source: string,
    _namespace: string[],
    data: any,
    isSubagent: boolean
  ): void {
    const [message] = data;
    if (!message) return;

    // Stop thinking spinner when any message arrives
    this.stopThinkingSpinner();

    // Tool call chunks (streaming tool invocations)
    if (AIMessageChunk.isInstance(message) && message.tool_call_chunks?.length) {
      for (const tc of message.tool_call_chunks) {
        if (tc.name) {
          // New tool call started
          this.finishPendingTool();
          this.pendingTool = {
            name: tc.name,
            argsBuffer: "",
            agentName: source,
          };
          
          const agentLabel = isSubagent ? this.subAgentLabel(source.replace("tools:", "").split(":")[0] ?? "agent") : "PM";
          const icon = isSubagent ? this.agentIcon(source.replace("tools:", "").split(":")[0] ?? "agent") : "🎯";
          
          if (!this.isHeadless) {
            // For file operations, use a simpler spinner message to avoid glitching
            if (tc.name === "write_file" || tc.name === "edit_file") {
              this.startToolSpinner(`${icon} ${agentLabel} ${tc.name}...`);
            } else {
              this.startToolSpinner(`${icon} ${agentLabel} calling ${tc.name}...`);
            }
          } else {
            console.log(`  ${chalk.cyan("→")} ${icon} ${chalk.hex("#AAAAAA")(agentLabel)} ${chalk.gray(`calling ${tc.name}...`)}`);
          }
        }
        // Args stream in chunks - accumulate them
        if (tc.args) {
          if (this.pendingTool) {
            this.pendingTool.argsBuffer += tc.args;
            // Don't show args streaming for file operations to avoid glitching
            // Only show for other tools if needed
          }
        }
      }
    }

    // Tool results
    if (ToolMessage.isInstance(message)) {
      this.finishPendingTool();
      if (message.name) {
        const content = String(message.content ?? "");
        const shortResult = content.slice(0, 150);
        const prefix = isSubagent ? `[${source}] ` : "";
        console.log(`    ${chalk.green("✓")} ${prefix}${chalk.gray(`${message.name}: ${shortResult}${content.length > 150 ? "..." : ""}`)}`);
      }
    }

    // Regular AI content (tokens) - skip tool call messages
    if (
      AIMessageChunk.isInstance(message) &&
      message.text &&
      !message.tool_call_chunks?.length
    ) {
      if (!this.isHeadless && !this.pendingTool) {
        // Determine display label
        const displaySource = isSubagent ? source : "main";
        
        // When source changes, finalize previous stream and start fresh
        if (displaySource !== this.currentSource) {
          if (this.mdStream) {
            this.mdStream.end();
            this.mdStream = null;
          }
          if (this.midLine) {
            process.stdout.write("\n");
            this.midLine = false;
          }
          const label = isSubagent 
            ? `[${this.subAgentLabel(displaySource.replace("tools:", "").split(":")[0] ?? "subagent")}]`
            : ">_";
          const color = isSubagent ? chalk.gray : chalk.hex("#FF6A00");
          process.stdout.write(`\n  ${color(label)} `);
          this.currentSource = displaySource;
        }
        
        // Initialize MarkdownStream if needed
        if (!this.mdStream) {
          this.mdStream = new MarkdownStream({ theme: "dark" });
        }
        
        // Write token to markdown stream for beautiful rendering
        this.mdStream.write(message.text);
        this.midLine = true;
      } else if (this.isHeadless) {
        // In headless mode, just print tokens directly
        const prefix = isSubagent ? `[${source}] ` : "";
        process.stdout.write(`${prefix}${message.text}`);
      }
    }
  }

  /**
   * Handle custom stream mode - displays custom progress events.
   */
  private onCustomEvent(
    source: string,
    _namespace: string[],
    data: any,
    _isSubagent: boolean
  ): void {
    // Handle file write progress events
    if (data && typeof data === "object") {
      const { type, file_path, file_name, progress, message, error } = data;
      
      // File write events
      if (type?.startsWith("file_write")) {
        const prefix = source !== "main" ? `[${source}] ` : "";
        const fileName = file_name || file_path?.split(/[\\/]/).pop() || "file";
        
        switch (type) {
          case "file_write_start":
            console.log(`  ${CY("→")} ${prefix}${GY(`Writing ${fileName}...`)}`);
            if (message) console.log(`    ${GY(message)}`);
            break;
            
          case "file_write_progress":
            if (progress !== undefined) {
              console.log(`    ${YL("●")} ${prefix}${GY(`${progress}% - ${message || 'Writing...'}`)}`);
            } else if (message) {
              console.log(`    ${YL("●")} ${prefix}${GY(message)}`);
            }
            break;
            
          case "file_write_complete":
            console.log(`    ${G("✓")} ${prefix}${GY(`Successfully wrote ${fileName}`)}`);
            if (message) console.log(`    ${GY(message)}`);
            break;
            
          case "file_write_error":
            console.log(`    ${RD("✗")} ${prefix}${RD(`Error writing ${fileName}: ${error || 'Unknown error'}`)}`);
            break;
        }
        return;
      }
      
      // File edit events
      if (type?.startsWith("file_edit")) {
        const prefix = source !== "main" ? `[${source}] ` : "";
        const fileName = file_name || file_path?.split(/[\\/]/).pop() || "file";
        
        switch (type) {
          case "file_edit_start":
            console.log(`  ${CY("→")} ${prefix}${GY(`Editing ${fileName}...`)}`);
            break;
            
          case "file_edit_progress":
            if (message) {
              console.log(`    ${YL("●")} ${prefix}${GY(message)}`);
            }
            break;
            
          case "file_edit_complete":
            console.log(`    ${G("✓")} ${prefix}${GY(`Successfully edited ${fileName}`)}`);
            if (message) console.log(`    ${GY(message)}`);
            break;
            
          case "file_edit_error":
            console.log(`    ${RD("✗")} ${prefix}${RD(`Error editing ${fileName}: ${error || 'Unknown error'}`)}`);
            break;
        }
        return;
      }
      
      // Handle other custom progress events
      const { status } = data;
      if (status || progress !== undefined) {
        const icon = status === "complete" ? chalk.green("✓") :
                     status === "error" ? chalk.red("✗") :
                     status === "in_progress" || status === "analyzing" ? chalk.yellow("●") :
                     chalk.gray("○");
        const progressStr = progress !== undefined ? ` ${progress}%` : "";
        console.log(`    ${icon} ${chalk.gray(`[${source}]`)} ${chalk.gray(status)}${chalk.gray(progressStr)}`);
      }
    }
  }

  private finishPendingTool(): void {
    if (!this.pendingTool) return;
    const { name, argsBuffer, agentName } = this.pendingTool;
    this.pendingTool = null;
    this.flushBuffer();

    let args: any = {};
    try { args = JSON.parse(argsBuffer); } catch { /* incomplete */ }

    switch (name) {
      case "write_todos":
        this.stopToolSpinner();
        this.renderTodoList(args, agentName);
        break;

      case "task":
        this.stopToolSpinner();
        this.renderTask(args);
        break;

      case "read_file": {
        const fp = String(args.file_path ?? args.path ?? "file");
        const bn = path.basename(fp);
        
        if (this.toolSpinner) {
          this.toolSpinner.succeed(chalk.green(`✔ Read ${bn}`));
          this.toolSpinner = null;
        }
        // Don't show content preview for read_file - it's too verbose
        // The agent will use the content internally
        break;
      }

      case "write_file": {
        const fp = String(args.file_path ?? args.path ?? "file");
        const bn = path.basename(fp);
        const content = String(args.content ?? "");
        const lines = content.split("\n");
        const sizeKB = Math.round(content.length / 1024);
        
        if (this.toolSpinner) {
          this.toolSpinner.succeed(chalk.green(`✔ Saved ${bn} (${lines.length} lines, ${sizeKB}KB)`));
          this.toolSpinner = null;
        }
        
        // Show enhanced file preview with syntax highlighting hints
        this.renderEnhancedFilePreview(fp, content, agentName);
        break;
      }

      case "edit_file": {
        const fp = String(args.file_path ?? args.path ?? "file");
        const bn = path.basename(fp);
        const oldStr = String(args.old_string ?? "");
        const newStr = String(args.new_string ?? "");
        const replaceAll = args.replace_all ?? false;
        
        if (this.toolSpinner) {
          this.toolSpinner.succeed(chalk.green(`✔ Edited ${bn}`));
          this.toolSpinner = null;
        }
        
        // Show diff preview
        this.renderEditDiff(fp, oldStr, newStr, replaceAll, agentName);
        break;
      }

      case "execute": {
        const cmd = String(args.command ?? "");
        if (cmd) {
          this.stopToolSpinner();
          console.log(`    ${CY("$")} ${WH(cmd.length > 120 ? cmd.slice(0, 117) + "..." : cmd)}`);
          this.startToolSpinner("Running...");
        }
        break;
      }

      case "tavily_search_results_json": {
        const query = String(args.query ?? "");
        const short = query.length > 50 ? query.slice(0, 47) + "..." : query;
        if (this.toolSpinner) {
          this.toolSpinner.text = GY(`Searching web for "${short}"`);
          // Wait for tool result
        }
        break;
      }

      default:
        this.stopToolSpinner();
        break;
    }
  }

  /** Enhanced file preview with better formatting and agent attribution */
  private renderEnhancedFilePreview(filePath: string, content: string, agentName: string): void {
    if (!content || content.trim().length === 0) return;
    
    const lines = content.split("\n");
    const preview = lines.slice(0, 8);
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName).toLowerCase();
    
    // Agent attribution
    const label = this.subAgentLabel(agentName);
    
    console.log(`    ${chalk.hex("#FF6A00")("┌─")} ${chalk.cyan(fileName)} ${chalk.gray(`by ${label}`)}`);
    
    // Show preview with line numbers
    for (let i = 0; i < preview.length; i++) {
      const lineNum = chalk.hex("#666666")(`${String(i + 1).padStart(3)} │`);
      let line = preview[i] ?? "";
      
      // Truncate long lines
      if (line.length > 85) {
        line = line.slice(0, 82) + "...";
      }
      
      // Basic syntax highlighting hints
      line = this.highlightLine(line, ext);
      
      console.log(`    ${chalk.hex("#FF6A00")("│")} ${lineNum} ${line}`);
    }
    
    if (lines.length > 8) {
      console.log(`    ${chalk.hex("#FF6A00")("│")} ${chalk.gray(`… ${lines.length - 8} more lines`)}`);
    }
    console.log(`    ${chalk.hex("#FF6A00")("└─")}`);
  }

  /** Show diff for file edits */
  private renderEditDiff(
    filePath: string,
    oldStr: string,
    newStr: string,
    replaceAll: boolean,
    agentName: string
  ): void {
    const fileName = path.basename(filePath);
    const label = this.subAgentLabel(agentName);
    
    console.log(`    ${chalk.hex("#FF6A00")("┌─")} ${chalk.cyan(fileName)} ${chalk.gray(`edited by ${label}`)}`);
    
    // Show old content (removed)
    const oldLines = oldStr.split("\n").slice(0, 3);
    for (const line of oldLines) {
      const truncated = line.length > 80 ? line.slice(0, 77) + "..." : line;
      console.log(`    ${chalk.hex("#FF6A00")("│")} ${chalk.red("- " + truncated)}`);
    }
    
    if (oldStr.split("\n").length > 3) {
      console.log(`    ${chalk.hex("#FF6A00")("│")} ${chalk.gray(`  … ${oldStr.split("\n").length - 3} more lines removed`)}`);
    }
    
    // Show new content (added)
    const newLines = newStr.split("\n").slice(0, 3);
    for (const line of newLines) {
      const truncated = line.length > 80 ? line.slice(0, 77) + "..." : line;
      console.log(`    ${chalk.hex("#FF6A00")("│")} ${chalk.green("+ " + truncated)}`);
    }
    
    if (newStr.split("\n").length > 3) {
      console.log(`    ${chalk.hex("#FF6A00")("│")} ${chalk.gray(`  … ${newStr.split("\n").length - 3} more lines added`)}`);
    }
    
    if (replaceAll) {
      console.log(`    ${chalk.hex("#FF6A00")("│")} ${chalk.yellow("⚠ Replaced all occurrences")}`);
    }
    
    console.log(`    ${chalk.hex("#FF6A00")("└─")}`);
  }

  /** Basic syntax highlighting for common file types */
  private highlightLine(line: string, ext: string): string {
    // Keywords for different languages
    const jsKeywords = /\b(const|let|var|function|class|import|export|from|return|if|else|for|while|async|await)\b/g;
    const pyKeywords = /\b(def|class|import|from|return|if|else|elif|for|while|async|await|with|as)\b/g;
    const htmlTags = /<\/?[a-zA-Z][^>]*>/g;
    const strings = /(["'`])(?:(?=(\\?))\2.)*?\1/g;
    const comments = /(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$)/gm;
    
    // Apply highlighting based on file extension
    if ([".js", ".ts", ".jsx", ".tsx", ".mjs"].includes(ext)) {
      line = line.replace(jsKeywords, (match) => chalk.magenta(match));
      line = line.replace(strings, (match) => chalk.green(match));
      line = line.replace(comments, (match) => chalk.gray(match));
    } else if ([".py"].includes(ext)) {
      line = line.replace(pyKeywords, (match) => chalk.magenta(match));
      line = line.replace(strings, (match) => chalk.green(match));
      line = line.replace(comments, (match) => chalk.gray(match));
    } else if ([".html", ".htm", ".xml"].includes(ext)) {
      line = line.replace(htmlTags, (match) => chalk.cyan(match));
      line = line.replace(strings, (match) => chalk.green(match));
    } else if ([".json"].includes(ext)) {
      line = line.replace(strings, (match) => chalk.green(match));
      line = line.replace(/\b(true|false|null)\b/g, (match) => chalk.yellow(match));
    }
    
    return line;
  }

  private renderTodoList(args: any, agentName: string): void {
    const icon = this.agentIcon(agentName);
    console.log("");
    console.log(`  ${icon} ${DIM(agentName)} ${GY("▸")} ${YL("📋 Plan")}`);
    const todos = args.todos ?? [];
    for (const todo of todos) {
      const status = todo.status ?? "pending";
      let marker: string;
      let textFn: (s: string) => string;
      switch (status) {
        case "completed":  marker = G("✓");  textFn = (s) => chalk.strikethrough(GY(s)); break;
        case "in_progress": marker = YL("●"); textFn = WH; break;
        default:           marker = GY("○"); textFn = GY; break;
      }
      console.log(`    ${marker} ${textFn(todo.content ?? "")}`);
    }
    console.log("");
  }

  private renderTask(args: any): void {
    const subName = String(args.subagent_type ?? args.name ?? "subagent");
    const desc = String(args.description ?? "");
    const shortDesc = desc.split("\n")[0]?.slice(0, 80) ?? "";
    const icon = this.agentIcon(subName);
    const label = this.subAgentLabel(subName);
    console.log("");
    console.log(`  ${O("┌")} ${icon} ${O.bold(`Delegating → ${label}`)}`);
    if (shortDesc) console.log(`  ${O("│")} ${GY(shortDesc)}`);
    console.log(`  ${O("└─────────────────────────")}`);
    console.log("");
    this.startToolSpinner(`${label} is working...`);
  }

  

  

  /** Print the HITL interrupt prompt to the terminal */
  printInterrupt(interrupt: InterruptInfo): void {
    this.flushBuffer();
    this.stopToolSpinner();
    this.stopThinkingSpinner();
    console.log("");
    console.log(`  ${YL("⚠")}  ${YL.bold("Agent wants to run a command — your approval is needed")}`);
    console.log("");

    for (const action of interrupt.actionRequests) {
      const cfg = interrupt.reviewConfigs.find((r) => r.actionName === action.name);
      const decisions = cfg?.allowedDecisions ?? ["approve", "reject"];

      console.log(`  ${GY("┌─")} ${CY(action.name)}`);
      if (action.name === "execute" && action.args["command"]) {
        const cmd = String(action.args["command"]);
        for (const line of cmd.split("\n")) {
          console.log(`  ${GY("│")} ${WH(`$ ${line}`)}`);
        }
      } else {
        const argsStr = JSON.stringify(action.args, null, 2);
        for (const line of argsStr.split("\n").slice(0, 6)) {
          console.log(`  ${GY("│")} ${GY(line)}`);
        }
      }
      console.log(`  ${GY("│")}`);
      const opts = decisions.map((d) => {
        if (d === "approve") return G("[a] approve");
        if (d === "reject")  return RD("[r] reject");
        if (d === "edit")    return YL("[e] edit");
        return GY(d);
      }).join("  ");
      console.log(`  ${GY("│")} ${GY("Options:")} ${opts}`);
      console.log(`  ${GY("└─")}`);
      console.log("");
    }
  }

  /** Print auto-approval notice (for allowedCommands) */
  printAutoApproved(command: string): void {
    const short = command.length > 80 ? command.slice(0, 77) + "..." : command;
    console.log(`  ${G("✓")} ${GY("Auto-approved:")} ${GY(short)}`);
  }

 

  private detectSpawns(data: any): void {
    const messages = (data as any)?.messages ?? [];
    for (const msg of messages) {
      for (const tc of msg.tool_calls ?? []) {
        if (tc.name === "task") {
          const name = String(tc.args?.subagent_type ?? tc.args?.name ?? "subagent");
          this.agents.set(tc.id, { name, status: "spawned", toolCallId: tc.id });
        }
      }
    }
  }

  private markWorking(nsKey: string): void {
    if (this.namespaceToAgent.has(nsKey)) return;

    for (const [id, agent] of this.agents) {
      if (agent.status === "spawned") {
        agent.status = "working";
        this.namespaceToAgent.set(nsKey, id);
        break;
      }
    }
  }

  private detectComplete(data: any): void {
    const messages = (data as any)?.messages ?? [];
    for (const msg of messages) {
      if (msg.type === "tool" && msg.tool_call_id) {
        const agent = this.agents.get(msg.tool_call_id);
        if (agent && agent.status !== "done") {
          agent.status = "done";
          this.stopToolSpinner();
          this.flushBuffer();
          const icon = this.agentIcon(agent.name);
          const label = this.subAgentLabel(agent.name);
          console.log(`  ${icon} ${G(`${label} ✓ Done`)}`);

          const total = this.agents.size;
          const done = [...this.agents.values()].filter((a) => a.status === "done").length;
          const working = [...this.agents.values()].filter((a) => a.status === "working").length;
          if (total > 1) {
            const bar = G("█".repeat(done)) + YL("░".repeat(total - done));
            console.log(`  ${GY("  Progress:")} ${bar} ${GY(`${done}/${total} agents`)} ${working > 0 ? YL(`(${working} active)`) : ""}`);
          }
          console.log("");
        }
      }
    }
  }

  


  private subAgentLabel(name: string): string {
    // First check if it's a known top-level role
    for (const role of Object.values(AgentRole)) {
      if (name === role) return AGENT_LABELS[role] ?? name;
    }
    // Convert kebab-case sub-agent names to Title Case
    // e.g. 'api-architect' → 'API Architect', 'ml-engineer' → 'ML Engineer'
    const ACRONYMS = new Set(["api", "ml", "ai", "ui", "ux", "db", "sdk", "cli", "cicd", "css"]);
    return name
      .split("-")
      .map((w) => ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  private agentIcon(name: string): string {
    const lower = name.toLowerCase();
    const fallback = chalk.hex("#FF6A00").bold(">_");

    // Match known top-level roles first
    for (const role of Object.values(AgentRole)) {
      if (lower === role || lower.includes(role.replace("-agent", "").replace("-lead", ""))) {
        return AGENT_ICONS[role] ?? fallback;
      }
    }

    // Sub-agent name pattern matching → color by domain
    if (lower.includes("api") || lower.includes("architect") || lower.includes("database") || lower.includes("backend") || lower.includes("server"))
      return "\x1b[36m●\x1b[0m";  // cyan = backend family
    if (lower.includes("component") || lower.includes("design") || lower.includes("style") || lower.includes("frontend") || lower.includes("ui"))
      return "\x1b[35m●\x1b[0m";  // magenta = frontend family
    if (lower.includes("ml") || lower.includes("ai") || lower.includes("integration") || lower.includes("pipeline"))
      return "\x1b[38;2;180;100;255m●\x1b[0m";  // purple = AI/data family
    if (lower.includes("test") || lower.includes("qa") || lower.includes("quality"))
      return "\x1b[33m●\x1b[0m";  // yellow = test family
    if (lower.includes("security") || lower.includes("vuln") || lower.includes("audit"))
      return "\x1b[31m●\x1b[0m";  // red = security family
    if (lower.includes("docker") || lower.includes("ci") || lower.includes("deploy") || lower.includes("container"))
      return "\x1b[32m●\x1b[0m";  // green = devops family
    if (lower.includes("sdk") || lower.includes("platform") || lower.includes("tool") || lower.includes("cli"))
      return "\x1b[38;2;255;180;0m●\x1b[0m";  // gold = platform family
    if (lower.includes("mobile") || lower.includes("screen") || lower.includes("native"))
      return "\x1b[38;2;100;180;255m●\x1b[0m";  // blue = mobile family
    if (lower.includes("review") || lower.includes("architecture"))
      return "\x1b[34m●\x1b[0m";  // blue = review family

    return fallback;
  }

  private flushBuffer(): void {
    if (this.mdStream) {
      this.mdStream.end();
      this.mdStream = null;
      console.log("");
    } else if (this.tokenBuffer.length > 0) {
      this.tokenBuffer = "";
      process.stdout.write("\n");
    }
  }

  printComplete(): void {
    const o = chalk.hex("#FF6A00");
    console.log("");
    console.log(`  ${o.bold(">_")} ${G.bold("Done")}`);
    console.log("");
  }

  printError(error: Error): void {
    console.log("");
    console.log(`  ${RD("✗")} ${RD.bold(error.message)}`);
    if (error.stack) {
      for (const line of error.stack.split("\n").slice(1, 4)) {
        console.log(`    ${GY(line.trim())}`);
      }
    }
    console.log("");
  }
}
