---
name: mcp-server
description: Build production MCP (Model Context Protocol) servers that let AI clients call your tools and read your data. Covers tool registration with Zod validation, resource handlers, prompt templates, stdio and HTTP transports, session management, error handling, testing, and deployment. Use when building MCP servers or tools for AI integration.
---

# MCP Server Mastery

## Project Setup

```bash
mkdir my-mcp-server && cd my-mcp-server
npm init -y
npm install @modelcontextprotocol/server zod
npm install -D typescript @types/node
```

### package.json
```json
{
  "type": "module",
  "bin": { "my-mcp-server": "dist/index.js" },
  "scripts": { "build": "tsc", "start": "node dist/index.js" }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext",
    "outDir": "dist", "strict": true, "esModuleInterop": true, "skipLibCheck": true
  },
  "include": ["src"]
}
```

## Server Architecture

```
src/
├── index.ts           # Entry point, server + transport setup
├── tools/             # Tool handler files
│   ├── search.ts
│   └── compute.ts
├── resources/         # Resource handlers
│   └── config.ts
└── utils/             # Shared utilities
    └── errors.ts
```

## Tool Patterns

### Tool with Structured Output
```ts
import { McpServer } from "@modelcontextprotocol/server/mcp.js";
import { z } from "zod";

const server = new McpServer({ name: "my-server", version: "1.0.0" });

server.registerTool("calculate-bmi", {
  title: "BMI Calculator",
  description: "Calculate Body Mass Index from weight and height",
  inputSchema: z.object({
    weightKg: z.number().positive(),
    heightM: z.number().positive(),
  }),
  outputSchema: z.object({ bmi: z.number(), category: z.string() }),
}, async ({ weightKg, heightM }) => {
  const bmi = weightKg / (heightM * heightM);
  const category = bmi < 18.5 ? "underweight" : bmi < 25 ? "normal" : bmi < 30 ? "overweight" : "obese";
  return {
    content: [{ type: "text", text: `BMI: ${bmi.toFixed(1)} (${category})` }],
    structuredContent: { bmi: Number(bmi.toFixed(1)), category },
  };
});
```

### Tool with Error Handling
```ts
server.registerTool("fetch-url", {
  title: "Fetch URL",
  description: "Fetch content from a URL and return as text",
  inputSchema: z.object({
    url: z.string().url(),
    timeout: z.number().optional().default(10000),
  }),
}, async ({ url, timeout }) => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) {
      return { content: [{ type: "text", text: `HTTP ${response.status}: ${response.statusText}` }], isError: true };
    }

    const text = await response.text();
    return { content: [{ type: "text", text: text.slice(0, 50000) }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { content: [{ type: "text", text: `Fetch failed: ${message}` }], isError: true };
  }
});
```

### Tool with Annotations
```ts
server.registerTool("read-file", {
  title: "Read File",
  description: "Read a file from disk",
  inputSchema: z.object({ path: z.string() }),
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async ({ path }) => {
  const content = await fs.readFile(path, "utf-8");
  return { content: [{ type: "text", text: content }] };
});
```

## Resource Patterns

### Static Resource
```ts
server.registerResource("config", "config://app", {
  title: "App Configuration",
  description: "Current application configuration",
  mimeType: "application/json",
}, async (uri) => ({
  contents: [{ uri: uri.href, text: JSON.stringify(getConfig(), null, 2) }],
}));
```

### Dynamic Resource with Template
```ts
import { ResourceTemplate } from "@modelcontextprotocol/server/mcp.js";

server.registerResource("user-profile",
  new ResourceTemplate("user://{userId}/profile", {
    list: async () => ({
      resources: users.map((u) => ({ uri: `user://${u.id}/profile`, name: u.name })),
    }),
  }),
  { title: "User Profile", mimeType: "application/json" },
  async (uri, { userId }) => ({
    contents: [{ uri: uri.href, text: JSON.stringify(await getUser(userId)) }],
  })
);
```

## Transport Setup

### Stdio (local CLI tools)
```ts
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio.js";
const transport = new StdioServerTransport();
await server.connect(transport);
```

### HTTP (remote services)
```ts
import express from "express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/server/streamableHttp.js";

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(3000, "127.0.0.1");
```

## Client Configuration

### Claude Desktop / Cursor / VS Code
```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["path/to/dist/index.js"],
      "env": { "API_KEY": "..." }
    }
  }
}
```

## Best Practices
- Use Zod schemas for ALL input/output validation
- Keep tools focused — one action per tool
- Return `isError: true` on failures — never throw unhandled
- Log to stderr (`console.error`) — stdout is used by stdio transport
- Add `#!/usr/bin/env node` shebang for CLI distribution
- Resources are read-only — no mutations
- Use `outputSchema` when tools return structured data
- Set timeouts on all external calls
