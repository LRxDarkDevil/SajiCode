---
name: web-research
description: Deep web research and data extraction skill. Systematically research ANY topic by fetching URLs, reading documentation, crawling API docs, evaluating npm/pypi packages, comparing technologies, and synthesizing findings into actionable recommendations. Use when researching libraries, frameworks, APIs, solutions, or any topic requiring web investigation.
---

# Deep Web Research & Data Extraction

## Research Methodology

### Step 1: Define Research Scope
Before fetching any URLs, clearly define:
- **Question**: What exactly are we trying to answer?
- **Criteria**: What makes a solution acceptable?
- **Constraints**: Budget, performance, compatibility, licensing?
- **Deliverable**: Comparison matrix? Recommendation? Implementation guide?

### Step 2: Multi-Source Research Plan
```
Primary sources:
1. Official documentation (always start here)
2. GitHub repositories (README, issues, stars, last commit)
3. npm/pypi package pages (weekly downloads, dependencies)
4. Technical blog posts from reputable sources
5. Stack Overflow / GitHub Discussions for edge cases

Secondary sources:
6. Benchmark comparisons
7. Migration guides (from competing tools)
8. Conference talks / release announcements
```

### Step 3: Fetch and Extract
Use `fetch_url` tool to read documentation pages. For each source:
```
1. Read the overview / getting started page
2. Check the API reference for the specific features needed
3. Read the changelog / release notes for stability signals
4. Check GitHub issues for known problems
```

### Step 4: Synthesize Findings

#### Technology Comparison Matrix
```markdown
| Criteria | Option A | Option B | Option C |
|----------|----------|----------|----------|
| Stars / Downloads | X | Y | Z |
| Last updated | date | date | date |
| Bundle size (min+gz) | X KB | Y KB | Z KB |
| TypeScript support | Native | @types | None |
| Learning curve | Low | Medium | High |
| Community size | Large | Medium | Small |
| Documentation quality | Excellent | Good | Poor |
| License | MIT | Apache 2.0 | GPL |
| Key strength | ... | ... | ... |
| Key weakness | ... | ... | ... |
```

#### Recommendation Format
```
## Recommendation: [Tool Name]

**Why**: 1-2 sentence justification tied to criteria.
**Risks**: What could go wrong.
**Alternative**: What to use if the primary choice fails.
**Implementation**: Next steps to integrate.
```

## Package Evaluation Checklist

### npm Package Assessment
```
1. Weekly downloads → > 10K = established, > 100K = mainstream
2. GitHub stars → Health indicator, not quality indicator
3. Last publish date → > 6 months ago = potential concern
4. Open issues vs closed → High ratio = poor maintenance
5. Dependencies count → Fewer = better (less supply chain risk)
6. Bundle size → Check bundlephobia.com
7. TypeScript support → Native > @types > none
8. License → MIT/Apache preferred, check compatibility
9. Breaking changes → Check major version frequency
10. Alternatives → Always identify at least one
```

### API Documentation Evaluation
```
1. Is there an OpenAPI/Swagger spec?
2. Are there code examples in our language?
3. What's the rate limit?
4. What authentication method is required?
5. Is there a sandbox/test environment?
6. What's the pricing model?
7. Are there SDKs or just raw HTTP?
8. What's the SLA/uptime guarantee?
```

## Research Patterns by Topic

### "Which library should I use for X?"
```
1. Search: "best [X] library [language] [year]"
2. Check npm trends for download comparison
3. Read GitHub README of top 3 candidates
4. Check bundle size on bundlephobia
5. Read "migration from" guides to understand trade-offs
6. Build comparison matrix
7. Make recommendation with clear rationale
```

### "How do I implement X?"
```
1. Search official docs for the specific feature
2. Find the API reference / method signature
3. Find 2-3 code examples (official + community)
4. Check for common pitfalls in GitHub issues
5. Synthesize into a step-by-step implementation guide
6. Include error handling and edge cases
```

### "Why is X broken / not working?"
```
1. Read the exact error message
2. Search GitHub issues for the exact error string
3. Check Stack Overflow for similar issues
4. Read the changelog for breaking changes
5. Check if it's a known bug with a workaround
6. If no solution found, create minimal reproduction
```

### "What's the best architecture for X?"
```
1. Search for "[X] architecture" on engineering blogs
2. Read case studies from companies at similar scale
3. Check for established patterns (microservices, CQRS, event-driven)
4. Find reference implementations on GitHub
5. Evaluate trade-offs for the specific constraints
6. Document decision with ADR (Architecture Decision Record) format
```

## Documentation URL Patterns

### Quick Reference URLs
```
npm package info:    https://www.npmjs.com/package/{name}
Bundle size:         https://bundlephobia.com/package/{name}
GitHub repo:         https://github.com/{owner}/{repo}
npm trends:          https://npmtrends.com/{pkg1}-vs-{pkg2}
MDN Web Docs:        https://developer.mozilla.org/en-US/docs/Web/API/{API}
Node.js docs:        https://nodejs.org/docs/latest/api/{module}.html
TypeScript docs:     https://www.typescriptlang.org/docs/handbook/
```

## Output Standards
- NEVER guess or speculate — always verify with actual source
- Include URLs for every claim
- Note when information may be outdated
- Clearly distinguish facts from opinions
- If research is inconclusive, say so and explain why
- Always provide at least 2 options with trade-offs
