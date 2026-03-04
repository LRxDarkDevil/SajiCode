import chalk from "chalk";

const ORANGE = chalk.hex("#FF8C00");
const GREEN = chalk.green;
const GRAY = chalk.gray;

interface MilestoneInfo {
  id: number;
  title: string;
  status: "pending" | "in_progress" | "completed" | "failed";
}

export class ProgressTracker {
  private milestones: MilestoneInfo[] = [];
  private startTime = Date.now();

  addMilestone(id: number, title: string): void {
    this.milestones.push({ id, title, status: "pending" });
  }

  updateMilestone(id: number, status: MilestoneInfo["status"]): void {
    const milestone = this.milestones.find((m) => m.id === id);
    if (milestone) {
      milestone.status = status;
    }
  }

  printProgress(): void {
    const completed = this.milestones.filter((m) => m.status === "completed").length;
    const total = this.milestones.length;

    if (total === 0) return;

    const percent = Math.round((completed / total) * 100);
    const barWidth = 30;
    const filled = Math.round((percent / 100) * barWidth);
    const empty = barWidth - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);

    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    const elapsedStr = formatDuration(elapsed);

    console.log("");
    console.log(ORANGE(`[${bar}] ${percent}% — ${completed}/${total} milestones — ${elapsedStr} elapsed`));

    for (const m of this.milestones) {
      const icon = getStatusIcon(m.status);
      const color = getStatusColor(m.status);
      console.log(color(`  ${icon} ${m.title}`));
    }

    console.log("");
  }
}

function getStatusIcon(status: MilestoneInfo["status"]): string {
  switch (status) {
    case "completed":
      return "✅";
    case "in_progress":
      return "🔄";
    case "failed":
      return "❌";
    default:
      return "⏳";
  }
}

function getStatusColor(status: MilestoneInfo["status"]) {
  switch (status) {
    case "completed":
      return GREEN;
    case "in_progress":
      return ORANGE;
    case "failed":
      return chalk.red;
    default:
      return GRAY;
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
