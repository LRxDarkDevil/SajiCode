---
name: superpowers
description: Core engineering workflow that activates on EVERY task. Enforces systematic plan-before-code methodology, multi-file refactoring safety, dependency-aware changes, pre-flight verification, and zero-placeholder quality standards. Use PROACTIVELY on all coding tasks.
---

# Engineering Superpowers

## Workflow (ALWAYS follow this order)

### 1. ANALYZE — Understand before you touch
```
read_file → grep → glob → understand patterns → identify dependencies
```
- Read every file you plan to modify BEFORE writing anything
- Check `package.json` / `requirements.txt` for existing dependencies
- Map the dependency graph: what imports what
- Identify established patterns (naming, structure, error handling)
- Check for existing tests related to the code you'll change

### 2. PLAN — Think before you code
- Break task into ordered steps with `write_todos`
- Identify files to create vs modify vs delete
- Map the blast radius: what breaks if you change X?
- Plan the order of changes (dependencies first, dependents after)
- Consider edge cases BEFORE implementing

### 3. IMPLEMENT — Write production code
- Complete, working code — never TODOs, placeholders, or stubs
- Handle ALL edge cases: empty input, null, undefined, network errors, timeouts
- Use proper TypeScript types — `unknown` over `any`, explicit return types
- Follow patterns already in the codebase
- Install dependencies BEFORE importing them

### 4. VERIFY — Prove it works
- Search for `TODO`, `FIXME`, `PLACEHOLDER`, `HACK` in your output
- Verify all imports resolve to real files/packages
- Run build command to catch type errors
- Run tests if they exist
- Check for unused imports and dead code

## Multi-File Refactoring Safety

### Pre-Flight Checklist
```
1. List ALL files that will be affected
2. Check git status — are there uncommitted changes?
3. Identify the dependency order for changes
4. Plan rollback: what to revert if something breaks
```

### Change Order Protocol
```
1. Create new files first (no existing code depends on them)
2. Update shared modules (types, utils, constants)
3. Update consumers (components, routes, handlers)
4. Update entry points (index files, main files)
5. Remove deprecated code LAST
```

### Rename/Move Safety
```
1. Find ALL references: grep for imports, usages, config references
2. Update ALL import paths in dependent files
3. Update barrel exports (index.ts files)
4. Update config files (tsconfig paths, webpack aliases)
5. Verify build passes after EVERY rename
```

## Code Quality Standards

### TypeScript
```ts
// GOOD: Explicit types, error handling, validation
async function fetchUser(id: string): Promise<User> {
  if (!id?.trim()) throw new Error("User ID required");
  const response = await fetch(`/api/users/${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new HttpError(`User fetch failed: ${response.status}`, response.status);
  }
  return response.json() as Promise<User>;
}

// BAD: No types, no validation, no error handling
async function fetchUser(id) {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}
```

### Error Handling
```ts
// Typed error classes over generic Error
class AppError extends Error {
  constructor(message: string, public code: string, public statusCode: number) {
    super(message);
    this.name = "AppError";
  }
}

// Async error boundary pattern
async function safeExecute<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logger.error("Operation failed", { error: error instanceof Error ? error.message : String(error) });
    return fallback;
  }
}
```

### Naming Conventions
| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `UserProfile.tsx` |
| Utilities | camelCase | `formatCurrency.ts` |
| Constants | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| Types | PascalCase | `ApiResponse` |
| Enums | PascalCase + UPPER members | `enum Status { ACTIVE, INACTIVE }` |
| Files | kebab-case or camelCase | `user-service.ts` |
| Directories | kebab-case | `api-routes/` |

## Anti-Patterns (NEVER DO THESE)
- `any` type — use `unknown` and narrow with type guards
- `console.log` for errors — use structured logger or throw
- String concatenation in SQL/URLs — use parameterized queries and `URL` API
- Empty catch blocks — at minimum log, ideally handle or rethrow
- `!important` in CSS — fix the specificity instead
- Hardcoded values — use constants, config, or environment variables
- Barrel re-exports with side effects — causes tree-shaking failures
- Circular imports — restructure to break the cycle

## Performance Defaults
- Use `const` over `let` — never `var`
- Prefer `Map`/`Set` over plain objects for dynamic lookups
- Use early returns to avoid deep nesting
- Debounce expensive operations (search, resize, scroll handlers)
- Lazy-load heavy modules with dynamic `import()`
- Use `AbortController` for cancellable fetch requests
