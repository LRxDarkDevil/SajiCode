import fs from "fs/promises";
import path from "path";

const SAJICODE_DIR = ".sajicode";
const MEMORIES_DIR = "memories";
const SAJICODE_MD = "SAJICODE.md";
const WHATS_DONE = "whats_done.md";

export async function ensureSajiCodeDir(projectPath: string): Promise<void> {
  await fs.mkdir(path.join(projectPath, SAJICODE_DIR, MEMORIES_DIR), { recursive: true });
  await fs.mkdir(path.join(projectPath, SAJICODE_DIR, "agents"), { recursive: true });
}

export async function loadProjectContext(projectPath: string): Promise<string> {
  const sections: string[] = [];

  const sajicodeMd = await safeRead(path.join(projectPath, SAJICODE_MD));
  if (sajicodeMd) {
    sections.push("## Project Context (SAJICODE.md)");
    sections.push(sajicodeMd);
  }

  const whatsDone = await safeRead(path.join(projectPath, SAJICODE_DIR, WHATS_DONE));
  if (whatsDone) {
    sections.push("## Previous Work (whats_done.md)");
    sections.push(whatsDone);
    sections.push("⚠️ Do NOT redo the work above. Continue from where you left off.");
  }

  const memoriesDir = path.join(projectPath, SAJICODE_DIR, MEMORIES_DIR);
  const memoryFiles = await safeReadDir(memoriesDir);
  if (memoryFiles.length > 0) {
    sections.push("## ⚠️ SAVED MEMORIES — You MUST use this information when answering");
    sections.push("The following are facts the user has told you. ALWAYS reference them.");
    for (const file of memoryFiles) {
      const content = await safeRead(path.join(memoriesDir, file));
      if (content) {
        sections.push(`### Memory: ${file.replace(".md", "")}`);
        sections.push(content);
      }
    }
    sections.push("---");
    sections.push("When the user asks about their preferences or anything you have saved, ALWAYS check the memories above FIRST.");
  }

  return sections.join("\n\n");
}

export async function hasSajiCodeMd(projectPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(projectPath, SAJICODE_MD));
    return true;
  } catch {
    return false;
  }
}

export function getSajiCodeMdPath(projectPath: string): string {
  return path.join(projectPath, SAJICODE_MD);
}

async function safeRead(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

async function safeReadDir(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath);
    return entries.filter((e) => e.endsWith(".md"));
  } catch {
    return [];
  }
}

export const INIT_SYSTEM_PROMPT = `You are a project analyzer. Generate SAJICODE.md at the PROJECT ROOT.

## Instructions
1. You will receive the full project context already collected — do NOT scan again
2. Write SAJICODE.md to the PROJECT ROOT using write_file
3. Format it as clean markdown

## SAJICODE.md Format

\`\`\`markdown
# [Project Name]

## Overview
One paragraph describing what this project does.

## Tech Stack
- Language: [detected]
- Framework: [detected]
- Key Dependencies: [from package.json]

## Project Structure
[from tree output]

## Conventions
- [Coding patterns detected]

## Build & Run
- [scripts from package.json]

## Notes
- [Anything important for AI agents]
\`\`\`

IMPORTANT: Write SAJICODE.md to the project root, NOT inside .sajicode/.`;
