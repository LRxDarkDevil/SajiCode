import type { CompiledSubAgent } from "deepagents";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { createAllAgentsFromPresets } from "./agent-factory.js";

export async function createAllDomainHeads(
  model: BaseChatModel,
  projectPath: string,
): Promise<CompiledSubAgent[]> {
  return createAllAgentsFromPresets(model, projectPath);
}
