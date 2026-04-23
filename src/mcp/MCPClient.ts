import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import path from "path";
import fs from "fs/promises";
import os from "os";

export class MCPClientManager {
  private client: MultiServerMCPClient | null = null;
  private projectPath: string;
  private serverNames: string[] = [];

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async initialize(): Promise<void> {
    try {
      const rawServers = await this.loadMCPServersConfig();
      const names = Object.keys(rawServers);
      if (names.length === 0) {
        this.client = null;
        return;
      }

      // Wrap each command to suppress stderr at OS level.
      // MCP subprocess inherits raw stderr fd — Node.js monkey-patching won't work.
      const mcpServers: Record<string, any> = {};
      const isWin = os.platform() === "win32";

      for (const [name, cfg] of Object.entries(rawServers)) {
        if (isWin) {
          mcpServers[name] = {
            ...cfg,
            command: "cmd",
            args: ["/c", `${cfg.command} ${(cfg.args ?? []).join(" ")} 2>nul`],
          };
        } else {
          const originalCmd = `${cfg.command} ${(cfg.args ?? []).join(" ")}`;
          mcpServers[name] = {
            ...cfg,
            command: "sh",
            args: ["-c", `${originalCmd} 2>/dev/null`],
          };
        }
      }

      // Pass mcpServers directly as the config object
      this.client = new MultiServerMCPClient(mcpServers);
      this.serverNames = names;
    } catch {
      this.client = null;
    }
  }

  private async loadMCPServersConfig(): Promise<Record<string, any>> {
    const configPath = path.join(this.projectPath, ".sajicode", "mcp-servers.json");

    try {
      const configContent = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(configContent);
      const mcpServers: Record<string, any> = {};

      for (const [serverName, serverConfig] of Object.entries(
        config.mcpServers || config.servers || {}
      )) {
        const server = serverConfig as any;

        if (server.enabled !== false && server.disabled !== true) {
          const processedArgs =
            server.args?.map((arg: string) =>
              arg.replace("{{projectPath}}", this.projectPath)
            ) || [];

          mcpServers[serverName] = {
            command: server.command,
            args: processedArgs,
            transport: server.transport || "stdio",
            ...(server.env && { env: server.env }),
          };
        }
      }

      return mcpServers;
    } catch {
      return {};
    }
  }

  async getTools() {
    if (!this.client) return [];

    try {
      // Get all tools from all MCP servers
      const allTools = await this.client.getTools();
      
      // MultiServerMCPClient should provide tools with server context
      // We need to prefix tool names to avoid collisions with built-in tools
      return allTools.map((tool: any) => {
        // Try to get server name from tool metadata or context
        let serverName: string | null = null;
        
        // Check various possible metadata locations
        if (tool.metadata?.serverName) {
          serverName = tool.metadata.serverName;
        } else if (tool.serverName) {
          serverName = tool.serverName;
        } else if (tool._serverName) {
          serverName = tool._serverName;
        }
        
        // If no server name found, try to map by index
        // MultiServerMCPClient returns tools in order of servers
        if (!serverName && this.serverNames.length > 0) {
          // This is a fallback - assign to first server
          // In practice, MultiServerMCPClient should provide server context
          serverName = this.serverNames[0] || null;
        }
        
        if (serverName) {
          // Create a wrapper tool that preserves the original tool's invoke method
          const originalName = tool.name;
          const prefixedName = `${serverName}__${originalName}`;
          
          // Create a new tool object that wraps the original
          const wrappedTool = Object.create(tool);
          wrappedTool.name = prefixedName;
          wrappedTool.description = `[${serverName} MCP] ${tool.description || ''}`;
          
          // Preserve the invoke method by binding it to the original tool
          if (typeof tool.invoke === 'function') {
            wrappedTool.invoke = tool.invoke.bind(tool);
          }
          
          return wrappedTool;
        }
        
        // If we still can't determine server, return tool as-is
        return tool;
      });
    } catch (error) {
      console.error('Error loading MCP tools:', error);
      return [];
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
        this.client = null;
      } catch {
        // Silent close
      }
    }
  }

  isInitialized(): boolean {
    return this.client !== null;
  }

  getServerCount(): number {
    return this.serverNames.length;
  }

  getServerNames(): string[] {
    return this.serverNames;
  }

  getClient(): MultiServerMCPClient | null {
    return this.client;
  }
}
