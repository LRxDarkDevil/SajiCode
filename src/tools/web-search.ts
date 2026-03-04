import { TavilySearch } from "@langchain/tavily";

export function createWebSearchTool(maxResults = 3) {
  return new TavilySearch({
    maxResults,
  });
}
