import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

/**
 * Enhanced write_file tool that emits progress events during large file writes.
 * This replaces the default write_file tool to provide better streaming visibility.
 */
export function createStreamingWriteFileTool(projectPath: string) {
  return tool(
    async (
      { 
        file_path, 
        content 
      }: { 
        file_path: string; 
        content: string; 
      }, 
      config: LangGraphRunnableConfig
    ) => {
      const writer = config.writer;
      
      // Resolve the file path
      const absPath = path.isAbsolute(file_path)
        ? file_path
        : path.join(projectPath, file_path);
      
      const fileName = path.basename(file_path);
      const contentLength = content.length;
      const lines = content.split('\n').length;
      
      // Emit start event
      writer?.({
        type: "file_write_start",
        file_path,
        file_name: fileName,
        size_bytes: contentLength,
        lines,
        message: `Starting to write ${fileName} (${lines} lines, ${Math.round(contentLength / 1024)}KB)`
      });
      
      try {
        // Ensure directory exists
        const dir = path.dirname(absPath);
        await fs.mkdir(dir, { recursive: true });
        
        // For large files, emit progress during write
        if (contentLength > 10000) { // 10KB+
          writer?.({
            type: "file_write_progress",
            file_path,
            progress: 50,
            message: `Writing ${fileName}... (${Math.round(contentLength / 1024)}KB)`
          });
        }
        
        // Write the file
        await fs.writeFile(absPath, content, 'utf-8');
        
        // Emit completion event
        writer?.({
          type: "file_write_complete",
          file_path,
          file_name: fileName,
          size_bytes: contentLength,
          lines,
          message: `Successfully wrote ${fileName} (${lines} lines)`
        });
        
        return `Successfully wrote ${file_path} (${lines} lines, ${Math.round(contentLength / 1024)}KB)`;
        
      } catch (error) {
        // Emit error event
        writer?.({
          type: "file_write_error",
          file_path,
          file_name: fileName,
          error: error instanceof Error ? error.message : String(error),
          message: `Error writing ${fileName}: ${error instanceof Error ? error.message : String(error)}`
        });
        
        throw error;
      }
    },
    {
      name: "write_file",
      description: "Write content to a file with progress streaming. Creates directories if needed.",
      schema: z.object({
        file_path: z.string().describe("Path to the file to write (relative or absolute)"),
        content: z.string().describe("Content to write to the file"),
      }),
    }
  );
}

/**
 * Enhanced edit_file tool that emits progress events during file edits.
 */
export function createStreamingEditFileTool(projectPath: string) {
  return tool(
    async (
      { 
        file_path, 
        old_string, 
        new_string,
        replace_all = false
      }: { 
        file_path: string; 
        old_string: string; 
        new_string: string;
        replace_all?: boolean;
      }, 
      config: LangGraphRunnableConfig
    ) => {
      const writer = config.writer;
      
      // Resolve the file path
      const absPath = path.isAbsolute(file_path)
        ? file_path
        : path.join(projectPath, file_path);
      
      const fileName = path.basename(file_path);
      
      // Emit start event
      writer?.({
        type: "file_edit_start",
        file_path,
        file_name: fileName,
        message: `Starting to edit ${fileName}`
      });
      
      try {
        // Read existing file
        let existingContent: string;
        try {
          existingContent = await fs.readFile(absPath, 'utf-8');
        } catch {
          throw new Error(`File not found: ${file_path}`);
        }
        
        // Perform the replacement
        let newContent: string;
        let occurrences = 0;
        
        if (replace_all) {
          const regex = new RegExp(old_string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          const matches = existingContent.match(regex);
          occurrences = matches ? matches.length : 0;
          newContent = existingContent.replace(regex, new_string);
        } else {
          const index = existingContent.indexOf(old_string);
          if (index === -1) {
            throw new Error(`String not found in file: "${old_string}"`);
          }
          occurrences = 1;
          newContent = existingContent.substring(0, index) + 
                     new_string + 
                     existingContent.substring(index + old_string.length);
        }
        
        // Emit progress event
        writer?.({
          type: "file_edit_progress",
          file_path,
          occurrences,
          message: `Edited ${fileName} (${occurrences} ${occurrences === 1 ? 'occurrence' : 'occurrences'})`
        });
        
        // Write the updated content
        await fs.writeFile(absPath, newContent, 'utf-8');
        
        // Emit completion event
        writer?.({
          type: "file_edit_complete",
          file_path,
          file_name: fileName,
          occurrences,
          message: `Successfully edited ${fileName} (${occurrences} ${occurrences === 1 ? 'occurrence' : 'occurrences'})`
        });
        
        return `Successfully edited ${file_path} (${occurrences} ${occurrences === 1 ? 'occurrence' : 'occurrences'} replaced)`;
        
      } catch (error) {
        // Emit error event
        writer?.({
          type: "file_edit_error",
          file_path,
          file_name: fileName,
          error: error instanceof Error ? error.message : String(error),
          message: `Error editing ${fileName}: ${error instanceof Error ? error.message : String(error)}`
        });
        
        throw error;
      }
    },
    {
      name: "edit_file",
      description: "Edit a file by replacing text with progress streaming.",
      schema: z.object({
        file_path: z.string().describe("Path to the file to edit"),
        old_string: z.string().describe("Text to replace"),
        new_string: z.string().describe("New text to insert"),
        replace_all: z.boolean().optional().default(false).describe("Replace all occurrences"),
      }),
    }
  );
}
