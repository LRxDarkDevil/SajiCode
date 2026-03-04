import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

interface ProcessRecord {
  command: string;
  hash: string;
  status: "running" | "completed" | "failed";
  pid: number | undefined;
  stdout: string | undefined;
  stderr: string | undefined;
  timestamp: number;
  isLongRunning: boolean;
}

const LONG_RUNNING_PATTERNS: RegExp[] = [
  /npm run dev\b/,
  /npm run dev:/,
  /npm run watch\b/,
  /npm run serve\b/,
  /npm run start\b/,
  /nodemon\b/,
  /next dev\b/,
  /vite\b/,
  /tsx watch\b/,
  /node\s+.*(?:server|api)\b/,
];

const COMPLETED_TTL_MS = 5 * 60 * 1000;
const MAX_OUTPUT_LENGTH = 500;

function isLongRunning(command: string): boolean {
  return LONG_RUNNING_PATTERNS.some((pattern) => pattern.test(command));
}

function hashCommand(command: string): string {
  return crypto.createHash("md5").update(command.trim()).digest("hex");
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function truncateOutput(output: string | undefined): string | undefined {
  if (!output) return output;
  return output.length > MAX_OUTPUT_LENGTH
    ? output.slice(0, MAX_OUTPUT_LENGTH) + "\n...[truncated]"
    : output;
}

export class ProcessStateManager {
  private readonly stateFile: string;
  private records: Map<string, ProcessRecord> = new Map();

  constructor(projectPath: string) {
    this.stateFile = path.join(projectPath, ".sajicode", "process-state.json");
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.stateFile, "utf-8");
      const parsed = JSON.parse(raw) as ProcessRecord[];
      this.records = new Map(parsed.map((r) => [r.hash, r]));
      this.cleanStaleRecords();
    } catch {
      this.records = new Map();
    }
  }

  async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
    const entries = Array.from(this.records.values());
    await fs.writeFile(this.stateFile, JSON.stringify(entries, null, 2));
  }

  private cleanStaleRecords(): void {
    for (const [hash, record] of this.records) {
      if (record.isLongRunning && record.status === "running" && record.pid != null) {
        if (!isProcessAlive(record.pid)) {
          record.status = "failed";
          this.records.set(hash, record);
        }
      }
    }
  }

  async checkCommand(
    command: string
  ): Promise<{ skip: boolean; reason: string; output: string | undefined }> {
    const hash = hashCommand(command);
    const record = this.records.get(hash);
    const longRunning = isLongRunning(command);

    if (!record) {
      return { skip: false, reason: "First execution", output: undefined };
    }

    if (longRunning && record.status === "running" && record.pid != null) {
      if (isProcessAlive(record.pid)) {
        return {
          skip: true,
          reason: `"${command}" is already running (PID: ${record.pid})`,
          output: record.stdout,
        };
      }
      record.status = "failed";
      this.records.set(hash, record);
      return { skip: false, reason: "Previous process died, restarting", output: undefined };
    }

    if (!longRunning && record.status === "completed") {
      const ageMs = Date.now() - record.timestamp;
      if (ageMs < COMPLETED_TTL_MS) {
        const ageSec = Math.round(ageMs / 1000);
        return {
          skip: true,
          reason: `"${command}" completed ${ageSec}s ago`,
          output: record.stdout,
        };
      }
    }

    return { skip: false, reason: "TTL expired, re-executing", output: undefined };
  }

  async recordCommand(
    command: string,
    status: "running" | "completed" | "failed",
    stdout?: string,
    stderr?: string,
    pid?: number
  ): Promise<void> {
    const hash = hashCommand(command);
    this.records.set(hash, {
      command,
      hash,
      status,
      pid,
      stdout: truncateOutput(stdout),
      stderr: truncateOutput(stderr),
      timestamp: Date.now(),
      isLongRunning: isLongRunning(command),
    });
    await this.save();
  }
}
