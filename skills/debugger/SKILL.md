---
name: debugger
description: Systematic debugging and troubleshooting methodology for production applications. Covers error trace analysis, network debugging, memory profiling, reproducing intermittent bugs, bisecting regressions, stack trace interpretation, log analysis, performance bottleneck identification, and debugging strategies for Node.js, browser, React, and database issues. Use when debugging errors, investigating failures, or troubleshooting performance issues.
---

# Advanced Debugging

## Debugging Methodology

### The Scientific Method for Bugs
```
1. OBSERVE    — What exactly is happening? (error message, behavior, repro steps)
2. HYPOTHESIZE — What could cause this? (list 3+ possibilities)
3. TEST       — How to verify/eliminate each hypothesis?
4. ISOLATE    — Create minimal reproduction
5. FIX        — Make the smallest change that fixes the issue
6. VERIFY     — Confirm fix, add regression test, check for side effects
```

### Priority: Read Before You Touch
```
ALWAYS read in this order:
1. The exact error message / stack trace
2. The file + line number from the stack trace
3. The surrounding context (function, imports, state)
4. Recent changes to the file (git log -5 --follow -- file.ts)
5. Related tests (if they exist)

THEN form a hypothesis. NEVER change code before understanding the error.
```

## Error Analysis Patterns

### Stack Trace Interpretation
```
TypeError: Cannot read properties of undefined (reading 'map')
    at UserList (src/components/UserList.tsx:15:22)       ← WHERE (component + line)
    at renderWithHooks (node_modules/react-dom/...)       ← React internals (ignore)
    at mountIndeterminateComponent (...)                   ← React internals (ignore)

Translation:
- In UserList.tsx, line 15, something is undefined
- .map() is called on undefined → an array is expected but not received
- Check: What variable is on line 15? Where does it come from? (props? state? API?)
```

### Common Error Patterns

| Error | Usually Means | Fix |
|-------|--------------|-----|
| `Cannot read property of undefined` | Accessing nested object without null check | Optional chaining `?.` or guard check |
| `X is not a function` | Wrong import, stale reference, or wrong type | Check import path and export name |
| `ECONNREFUSED` | Target server not running | Check if the service is running on the expected port |
| `ENOENT: no such file` | File path is wrong | Check path construction, working directory |
| `MODULE_NOT_FOUND` | Package not installed or wrong path | Run `npm install` or fix import path |
| `Unhandled Promise Rejection` | Missing `.catch()` or try/catch | Wrap in try/catch, add error handler |
| `CORS error` | Server doesn't allow origin | Configure CORS middleware on server |
| `hydration mismatch` | Server/client render different HTML | Check for browser-only APIs, use `useEffect` |

## Network Debugging

### API Issues
```
1. Check the request:
   - Is the URL correct? (typos, wrong base URL, missing path segments)
   - Are headers correct? (Content-Type, Authorization)
   - Is the body correct? (JSON.stringify, form encoding)

2. Check the response:
   - What status code? (400 = your request is wrong, 500 = server bug)
   - What's in the response body? (error message, validation details)
   - Are there CORS headers? (Access-Control-Allow-Origin)

3. Reproduce with curl:
   curl -X POST https://api.example.com/endpoint \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"key": "value"}'
```

### WebSocket Debugging
```ts
// Add connection lifecycle logging
ws.addEventListener("open", () => console.log("[WS] Connected"));
ws.addEventListener("close", (e) => console.log(`[WS] Closed: code=${e.code} reason=${e.reason}`));
ws.addEventListener("error", (e) => console.error("[WS] Error:", e));
ws.addEventListener("message", (e) => console.log("[WS] Received:", e.data.slice(0, 200)));
```

## Node.js Debugging

### Memory Leak Hunt
```bash
# Start with --inspect and use Chrome DevTools
node --inspect dist/index.js

# Take heap snapshots via Chrome DevTools:
# 1. Open chrome://inspect
# 2. Click "inspect" on your Node process
# 3. Go to Memory tab → Take heap snapshot
# 4. Wait, take another snapshot
# 5. Compare snapshots → find growing objects
```

### CPU Profiling
```bash
# Generate CPU profile
node --prof dist/index.js
# Process the log
node --prof-process isolate-*.log > profile.txt
# Look for "ticks" — functions that consumed the most CPU
```

### Event Loop Monitoring
```ts
const THRESHOLD_MS = 100;
let lastCheck = Date.now();

setInterval(() => {
  const now = Date.now();
  const delay = now - lastCheck - 1000;
  if (delay > THRESHOLD_MS) {
    logger.warn(`Event loop blocked for ${delay}ms`);
  }
  lastCheck = now;
}, 1000);
```

## React Debugging

### Common React Issues
```
Infinite re-render:
  → Check useEffect dependencies — missing dep causes stale closure,
    adding object dep without useMemo causes infinite loop

Component not updating:
  → Check if you're mutating state (arrays, objects) instead of creating new references
  → obj.key = value (BAD) vs {...obj, key: value} (GOOD)

"Too many re-renders":
  → Calling setState during render, not in a handler
  → onClick={doSomething()} vs onClick={() => doSomething()}
```

## Database Debugging

### Slow Query Investigation
```sql
-- PostgreSQL: find slow queries
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;

-- Explain any slow query
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT ...;

-- Check index usage
SELECT schemaname, relname, seq_scan, idx_scan
FROM pg_stat_user_tables
WHERE seq_scan > idx_scan AND n_live_tup > 1000;
```

## Git Bisect (Finding Regression)
```bash
# Start bisect
git bisect start
git bisect bad           # Current commit is broken
git bisect good v1.2.0   # Last known good version

# Git checks out a middle commit — test it
npm test
git bisect good  # or git bisect bad

# Repeat until Git identifies the exact breaking commit
# Then: git bisect reset
```

## Debugging Rules
- NEVER change code before understanding the error
- ALWAYS reproduce the bug before attempting a fix
- Log MORE, not less — structured logging with context
- One change at a time — verify after each change
- If it takes > 30 min, step back and re-read the error message
- Write a regression test BEFORE fixing the bug
- Check if the bug exists in a fresh environment
