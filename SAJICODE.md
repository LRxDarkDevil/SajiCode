# SajiCode

## Overview
The AI engineering team in your terminal. SajiCode is a powerful CLI tool featuring 17 specialized agents × 21 expert skills that build production software, not prototypes. It leverages LangChain for AI orchestration and supports multiple LLM providers including OpenAI, Google Gemini, Ollama, and OpenRouter.

## Tech Stack
- Language: TypeScript
- Framework: Express
- Key Dependencies:
  - LangChain ecosystem (@langchain/core, @langchain/langgraph, @langchain/mcp-adapters)
  - LLM Providers: @langchain/openai, @langchain/google-genai, @langchain/ollama, @openrouter/sdk
  - WhatsApp: @whiskeysockets/baileys
  - CLI: commander, omelette, ora, chalk
  - Utilities: zod, dotenv, fs-extra, glob, chokidar

## Project Structure
```
├── src/
│   ├── agents/           # Agent implementations
│   │   ├── agent-factory.ts
│   │   ├── auto-parse-middleware.ts
│   │   ├── context-guard.ts
│   │   ├── context.ts
│   │   ├── critic.ts
│   │   ├── domain-heads.ts
│   │   ├── index.ts
│   │   ├── judgment.ts
│   │   └── onboarding.ts
│   └── channels/         # Channel integrations
│       └── channel.ts
├── skills/               # 21 expert skills
│   ├── 3d-web-experience/
│   ├── ai-engineer/
│   ├── api-architect/
│   ├── architect/
│   ├── database/
│   ├── debugger/
│   ├── devops/
│   ├── frontend-design/
│   ├── fullstack-app-generator/
│   ├── mcp-server/
│   ├── mobile-app/
│   ├── nextjs/
│   ├── nodejs/
│   ├── performance-optimizer/
│   ├── python-engineer/
│   ├── security/
│   ├── shadcn-ui/
│   ├── styling/
│   ├── superpowers/
│   ├── testing/
│   └── web-research/
├── deepagents-docs/      # Documentation
└── package.json
```

## Conventions
- TypeScript strict mode
- Modular agent architecture with domain heads
- Skill-based system with dedicated SKILL.md files
- Middleware pattern for request/response processing
- Context-driven agent selection

## Build & Run
```bash
npm run build      # Compile TypeScript
npm run dev        # Run in development with tsx
npm run start      # Run compiled JavaScript
npm run test       # Run tests
npm run lint       # Lint code
```

## Notes
- Supports WhatsApp integration via Baileys
- MCP (Model Context Protocol) adapters for tool orchestration
- Streaming support for real-time agent responses
- Human-in-the-loop workflows supported
- Long-term memory capabilities
- Sandboxed execution environments