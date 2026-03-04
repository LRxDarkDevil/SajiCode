
export interface PlatformInfo {
  isWindows: boolean;
  platform: string;
  pathSep: string;
}

export function getPlatformInfo(): PlatformInfo {
  const isWindows = process.platform === "win32";
  return {
    isWindows,
    platform: isWindows ? "Windows" : process.platform === "darwin" ? "macOS" : "Linux",
    pathSep: isWindows ? "\\" : "/",
  };
}

export function getPlatformPrompt(projectPath: string): string {
  const info = getPlatformInfo();

  if (info.isWindows) {
    return `PLATFORM: Windows (PowerShell)
PROJECT ROOT: ${projectPath}

WINDOWS RULES — READ CAREFULLY:
  • Use backslash paths: src\\routes\\tasks.ts
  • NEVER use: ls, mkdir -p, rm -rf, cat, grep, touch, del, rm
  • Use instead: dir, mkdir, type, findstr
  • NEVER delete files. If a file has errors, overwrite it or instruct a sub-agent to fix it.
  • For directory creation use: mkdir "path\\to\\dir"
  • All file paths in write_file/edit_file/read_file must use
    the project root as base, e.g.: ${projectPath}\\src\\server.ts
  • NEVER prefix paths with /d/ or /c/ — use d:\\ or c:\\`;
  }

  return `PLATFORM: ${info.platform}
PROJECT ROOT: ${projectPath}

SHELL RULES:
  • Use forward slash paths: src/routes/tasks.ts
  • Standard Unix commands: ls, mkdir -p, cat, grep
  • NEVER delete files. If a file has errors, overwrite it or instruct a sub-agent to fix it.`;
}
