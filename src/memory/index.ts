import { MemorySaver } from "@langchain/langgraph";

let checkpointerInstance: MemorySaver | null = null;

export function getCheckpointer(): MemorySaver {
  if (!checkpointerInstance) {
    checkpointerInstance = new MemorySaver();
  }
  return checkpointerInstance;
}

export function generateThreadId(): string {
  return `sajicode-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSessionConfig(threadId?: string) {
  return {
    configurable: {
      thread_id: threadId ?? generateThreadId(),
    },
  };
}
