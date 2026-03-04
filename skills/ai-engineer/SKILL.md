---
name: ai-engineer
description: Build production-ready LLM applications, RAG systems, and intelligent agents. Covers model selection, vector search, prompt engineering, agent orchestration with LangGraph, cost optimization, and AI safety. Use for any LLM feature, chatbot, AI agent, or AI-powered application.
---

# AI Engineer

## Model Selection Matrix

| Model | Best For | Cost | Speed | Context |
|-------|----------|------|-------|---------|
| GPT-4o | General tasks, function calling | $$$ | Fast | 128K |
| Claude 3.5 Sonnet | Code generation, analysis | $$$ | Fast | 200K |
| GPT-4o-mini | Cost-sensitive tasks | $ | Very fast | 128K |
| Claude 3.5 Haiku | High-volume, simple tasks | $ | Very fast | 200K |
| Llama 3.1 70B | Self-hosted, privacy | Free* | Medium | 128K |
| Mixtral 8x22B | Open-source, balanced | Free* | Medium | 64K |
| Gemini 2.0 Flash | Multimodal, long context | $$ | Fast | 1M |

**Decision**: Start with cheapest model that meets quality bar. Upgrade only when quality fails.

## RAG Pipeline Architecture

### Ingestion Pipeline
```
Documents → Chunking → Embedding → Vector Store
                ↓
         Metadata extraction
         (title, source, date)
```

### Retrieval Pipeline
```
Query → Query Understanding → Retrieval → Reranking → Generation
              ↓                    ↓           ↓
         Expansion/       Hybrid search    Cross-encoder
         Decomposition    (vector + BM25)   scoring
```

### Chunking Strategies
```ts
// Recursive text splitter — best default
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ["\n\n", "\n", ". ", " ", ""],
});

// Semantic chunking — for high-quality retrieval
const semanticSplitter = new SemanticChunker(embeddings, {
  breakpointThresholdType: "percentile",
  breakpointThresholdAmount: 95,
});
```

### Vector Database Selection
| Database | Hosting | Best For |
|----------|---------|----------|
| Pinecone | Managed | Production, scale |
| Qdrant | Self-hosted/Cloud | Hybrid search |
| Chroma | Embedded | Prototyping, local |
| pgvector | PostgreSQL ext | Existing Postgres |
| Weaviate | Self-hosted/Cloud | Multimodal |

## LangGraph Agent Patterns

### ReAct Agent (tool-calling loop)
```ts
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

const agentNode = async (state: typeof MessagesAnnotation.State) => {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
};

const shouldContinue = (state: typeof MessagesAnnotation.State) => {
  const lastMessage = state.messages[state.messages.length - 1];
  return lastMessage.tool_calls?.length ? "tools" : "__end__";
};

const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", agentNode)
  .addNode("tools", new ToolNode(tools))
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent")
  .compile();
```

### Multi-Agent Supervisor Pattern
```ts
const supervisorNode = async (state: AgentState) => {
  const response = await supervisorModel.invoke([
    { role: "system", content: "Route to the right specialist agent." },
    ...state.messages,
  ]);
  return { next: response.content }; // "researcher" | "coder" | "reviewer"
};
```

## Prompt Engineering

### Structured Output
```ts
const schema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

const structuredLlm = model.withStructuredOutput(schema);
const result = await structuredLlm.invoke("Analyze: Great product!");
```

### Chain-of-Thought
```
You are an expert analyst. Think through this step by step:

1. First, identify the key entities in the text
2. Then, determine the relationships between them
3. Finally, synthesize your findings into a structured answer

Text: {input}
```

### Few-Shot Pattern
```ts
const fewShotPrompt = ChatPromptTemplate.fromMessages([
  ["system", "Extract structured data from text."],
  ["human", "John works at Google since 2020"],
  ["ai", '{"name": "John", "company": "Google", "year": 2020}'],
  ["human", "Sarah joined Meta in 2023"],
  ["ai", '{"name": "Sarah", "company": "Meta", "year": 2023}'],
  ["human", "{input}"],
]);
```

## Cost Optimization

### Token Reduction Strategies
1. **Shorter prompts**: Remove fluff, use terse instructions
2. **Caching**: Semantic cache with vector similarity threshold
3. **Model routing**: Use cheap model for simple tasks, expensive for complex
4. **Streaming**: Stream responses to reduce perceived latency
5. **Batching**: Group similar requests for batch API pricing

### Semantic Caching
```ts
const cache = new SemanticCache({
  embeddings,
  vectorStore,
  similarityThreshold: 0.95,
});

async function cachedInvoke(prompt: string) {
  const cached = await cache.lookup(prompt);
  if (cached) return cached;
  const result = await model.invoke(prompt);
  await cache.store(prompt, result);
  return result;
}
```

## AI Safety Checklist
- [ ] Validate all user inputs before sending to LLM
- [ ] Strip PII from prompts when possible
- [ ] Set max token limits on all LLM calls
- [ ] Implement rate limiting per user/API key
- [ ] Add content moderation on LLM outputs
- [ ] Log all LLM interactions for debugging (redact PII)
- [ ] Use temperature=0 for deterministic tasks
- [ ] Implement timeout and retry with exponential backoff
- [ ] Never expose raw LLM errors to end users