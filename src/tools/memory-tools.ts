/**
 * Tools for interacting with three-layer memory architecture
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  loadPointerIndex,
  loadTopicFile,
  createMemoryTopic,
  grepTranscripts,
  appendTranscript,
  getTranscriptStats,
  formatPointerIndexForPrompt,
  type TranscriptEntry
} from "../memory/three-layer-memory.js";

/**
 * Tool: Read memory pointer index (Layer 1)
 * Always available, shows what topics exist
 */
export function createReadMemoryIndexTool(projectPath: string) {
  return tool(
    async () => {
      const index = await loadPointerIndex(projectPath);
      if (!index.trim()) {
        return "Memory index is empty. No topics have been created yet.";
      }
      return formatPointerIndexForPrompt(index);
    },
    {
      name: "read_memory_index",
      description: "Read the memory pointer index (Layer 1). Shows all available memory topics with brief summaries. Use this to see what knowledge is stored.",
      schema: z.object({})
    }
  );
}

/**
 * Tool: Read a specific topic file (Layer 2)
 * Fetched on-demand when agent needs detailed info
 */
export function createReadTopicTool(projectPath: string) {
  return tool(
    async ({ topicFile }: { topicFile: string }) => {
      const topic = await loadTopicFile(projectPath, topicFile);
      if (!topic) {
        return `Topic file '${topicFile}' not found. Use read_memory_index to see available topics.`;
      }
      return topic.content;
    },
    {
      name: "read_topic",
      description: "Read a detailed topic file (Layer 2). Use this when you need full details about a specific topic from the memory index. Provide the topic filename from the pointer index.",
      schema: z.object({
        topicFile: z.string().describe("The topic filename from the pointer index (e.g., 'project-architecture.md')")
      })
    }
  );
}

/**
 * Tool: Create or update a memory topic
 * Follows strict write discipline: verify file write before updating index
 */
export function createWriteMemoryTopicTool(projectPath: string) {
  return tool(
    async ({ topic, content, summary, transcriptRefs }: {
      topic: string;
      content: string;
      summary: string;
      transcriptRefs?: string[];
    }) => {
      // Enforce 150 char limit on summary
      if (summary.length > 150) {
        return `Error: Summary must be 150 characters or less. Current length: ${summary.length}. Please shorten it.`;
      }

      const result = await createMemoryTopic(
        projectPath,
        topic,
        content,
        summary,
        transcriptRefs || []
      );

      if (!result.success) {
        return `Failed to create memory topic: ${result.error}`;
      }

      return `Successfully created memory topic '${topic}' (file: ${result.topicFile}). The pointer index has been updated.`;
    },
    {
      name: "write_memory_topic",
      description: "Create or update a memory topic (Layer 2). Use this to store important knowledge. IMPORTANT: Summary must be 150 chars or less. The system will verify the file write succeeded before updating the pointer index.",
      schema: z.object({
        topic: z.string().describe("The topic name (e.g., 'Project Architecture')"),
        content: z.string().describe("The detailed content for this topic"),
        summary: z.string().describe("Brief summary (MAX 150 chars) that will appear in the pointer index"),
        transcriptRefs: z.array(z.string()).optional().describe("Optional array of transcript filenames to reference")
      })
    }
  );
}

/**
 * Tool: Search transcripts using grep (Layer 3)
 * Never loads full transcripts into context
 */
export function createSearchTranscriptsTool(projectPath: string) {
  return tool(
    async ({ pattern, transcriptFiles }: {
      pattern: string;
      transcriptFiles?: string[];
    }) => {
      const results = await grepTranscripts(projectPath, pattern, transcriptFiles);
      
      if (results.length === 0) {
        return `No matches found for pattern '${pattern}' in transcripts.`;
      }

      // Limit results to prevent context overflow
      const maxResults = 50;
      const limitedResults = results.slice(0, maxResults);
      const truncated = results.length > maxResults;

      let output = `Found ${results.length} matches for '${pattern}':\n\n`;
      output += limitedResults.join('\n');
      
      if (truncated) {
        output += `\n\n(Showing first ${maxResults} of ${results.length} matches. Refine your search pattern for more specific results.)`;
      }

      return output;
    },
    {
      name: "search_transcripts",
      description: "Search transcript files (Layer 3) using grep. Use this to find specific events or actions in history WITHOUT loading full transcript files. Returns matching lines with context.",
      schema: z.object({
        pattern: z.string().describe("The search pattern (supports regex)"),
        transcriptFiles: z.array(z.string()).optional().describe("Optional: specific transcript files to search. If omitted, searches all transcripts.")
      })
    }
  );
}

/**
 * Tool: Append to transcript (Layer 3)
 * Records actions for future reference
 */
export function createAppendTranscriptTool(projectPath: string) {
  return tool(
    async ({ transcriptFile, agent, action, context }: {
      transcriptFile: string;
      agent: string;
      action: string;
      context: string;
    }) => {
      const entry: TranscriptEntry = {
        timestamp: new Date().toISOString(),
        agent,
        action,
        context
      };

      await appendTranscript(projectPath, transcriptFile, entry);
      return `Appended to transcript '${transcriptFile}': [${agent}] ${action}`;
    },
    {
      name: "append_transcript",
      description: "Append an entry to a transcript file (Layer 3). Use this to record important actions or events for future reference. Transcripts are append-only and searchable via grep.",
      schema: z.object({
        transcriptFile: z.string().describe("The transcript filename (e.g., 'session-2026-04-23.log')"),
        agent: z.string().describe("The agent name performing the action"),
        action: z.string().describe("Brief description of the action"),
        context: z.string().describe("Additional context or details")
      })
    }
  );
}

/**
 * Tool: Get transcript stats without loading content
 */
export function createTranscriptStatsTool(projectPath: string) {
  return tool(
    async ({ transcriptFile }: { transcriptFile: string }) => {
      const stats = await getTranscriptStats(projectPath, transcriptFile);
      
      if (!stats) {
        return `Transcript file '${transcriptFile}' not found.`;
      }

      return `Transcript '${transcriptFile}' stats:\n` +
             `- Lines: ${stats.lines}\n` +
             `- Size: ${(stats.size / 1024).toFixed(2)} KB\n` +
             `- Last modified: ${stats.lastModified}`;
    },
    {
      name: "transcript_stats",
      description: "Get statistics about a transcript file without loading its content. Use this to check transcript size and activity.",
      schema: z.object({
        transcriptFile: z.string().describe("The transcript filename")
      })
    }
  );
}

/**
 * Create all memory tools for an agent
 */
export function createMemoryTools(projectPath: string) {
  return [
    createReadMemoryIndexTool(projectPath),
    createReadTopicTool(projectPath),
    createWriteMemoryTopicTool(projectPath),
    createSearchTranscriptsTool(projectPath),
    createAppendTranscriptTool(projectPath),
    createTranscriptStatsTool(projectPath)
  ];
}

// Made with Bob
