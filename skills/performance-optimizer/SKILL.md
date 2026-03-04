---
name: performance-optimizer
description: Profile and optimize application performance across frontend, backend, and database layers. Covers bundle analysis, Core Web Vitals, Lighthouse optimization, lazy loading, code splitting, image optimization, caching strategies, database query optimization, memory leak detection, and server response time reduction. Use when optimizing performance or debugging slowness.
---

# Performance Optimization

## Frontend Performance

### Core Web Vitals Targets
| Metric | Good | Needs Work | Poor |
|--------|------|-----------|------|
| LCP (Largest Contentful Paint) | ≤ 2.5s | ≤ 4s | > 4s |
| INP (Interaction to Next Paint) | ≤ 200ms | ≤ 500ms | > 500ms |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.25 | > 0.25 |

### Bundle Optimization
```bash
# Analyze bundle size
npx -y vite-bundle-visualizer     # Vite projects
npx -y @next/bundle-analyzer      # Next.js projects
npx -y source-map-explorer dist/main.js  # Any project
```

### Code Splitting
```tsx
// Route-level splitting (automatic in Next.js)
const DashboardPage = lazy(() => import("./pages/Dashboard"));

// Component-level splitting
const HeavyChart = lazy(() => import("./components/HeavyChart"));

function Dashboard() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <HeavyChart data={data} />
    </Suspense>
  );
}
```

### Image Optimization
```tsx
// Next.js — ALWAYS use next/image
import Image from "next/image";
<Image
  src="/hero.jpg"
  alt="Hero image"
  width={1200}
  height={630}
  priority              // Above-the-fold images
  placeholder="blur"    // Smooth loading
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>

// Outside Next.js
<picture>
  <source srcSet="/hero.avif" type="image/avif" />
  <source srcSet="/hero.webp" type="image/webp" />
  <img src="/hero.jpg" alt="Hero" loading="lazy" decoding="async" width="1200" height="630" />
</picture>
```

### Resource Loading
```html
<!-- Preload critical resources -->
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preconnect" href="https://api.example.com" />
<link rel="dns-prefetch" href="https://cdn.example.com" />

<!-- Defer non-critical scripts -->
<script src="/analytics.js" defer></script>
```

### CSS Optimization
```css
/* Use content-visibility for off-screen content */
.below-fold { content-visibility: auto; contain-intrinsic-size: auto 500px; }

/* Avoid layout thrashing — batch DOM reads/writes */
/* Use CSS transforms instead of layout properties */
.animate { transform: translateX(100px); }  /* Good: composite only */
.avoid   { left: 100px; }                   /* Bad: triggers layout */
```

## Backend Performance

### Response Time Optimization
```ts
// Database query optimization — SELECT only needed fields
const users = await prisma.user.findMany({
  select: { id: true, name: true, email: true },  // NOT include entire relations
  take: 20,
  cursor: lastId ? { id: lastId } : undefined,
});

// Connection pooling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Caching Strategies
```ts
// In-memory cache for hot data
const cache = new Map<string, { data: unknown; expiry: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached(key: string, data: unknown, ttlMs: number = 60000): void {
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}

// HTTP caching headers
res.set("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
res.set("ETag", computeEtag(data));
```

### Async Processing
```ts
// Move expensive operations to background
await emailQueue.add("send-welcome", { userId }, { delay: 0 });

// Stream large responses
app.get("/api/export", async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.write("[");
  const cursor = prisma.user.findMany({ cursor: true });
  let first = true;
  for await (const chunk of cursor) {
    res.write(`${first ? "" : ","}${JSON.stringify(chunk)}`);
    first = false;
  }
  res.end("]");
});
```

## Database Performance

### Query Analysis
```sql
-- Explain query plan to find slow queries
EXPLAIN ANALYZE SELECT * FROM post WHERE author_id = '123' ORDER BY created_at DESC LIMIT 20;

-- Find missing indexes
SELECT * FROM pg_stat_user_tables WHERE seq_scan > idx_scan AND n_live_tup > 10000;
```

### Index Optimization
```sql
-- Composite index matching query patterns
CREATE INDEX idx_post_author_date ON post(author_id, created_at DESC);

-- Partial index for filtered queries
CREATE INDEX idx_active_subscriptions ON subscription(user_id) WHERE status = 'active';

-- Covering index (avoids table lookup)
CREATE INDEX idx_post_listing ON post(author_id, created_at DESC) INCLUDE (title, slug);
```

## Memory Leak Detection

### Node.js Profiling
```ts
// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  if (usage.heapUsed > 500 * 1024 * 1024) {
    logger.warn("High memory usage", {
      heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(1)}MB`,
      rss: `${(usage.rss / 1024 / 1024).toFixed(1)}MB`,
    });
  }
}, 30000);
```

### Common Leak Patterns
```ts
// BAD: Growing event listeners
emitter.on("data", handler);  // Never removed

// GOOD: Clean up listeners
const handler = (data) => process(data);
emitter.on("data", handler);
onCleanup(() => emitter.off("data", handler));

// BAD: Unbounded cache
const cache = {};
cache[key] = data;  // Grows forever

// GOOD: LRU cache with max size
import { LRUCache } from "lru-cache";
const cache = new LRUCache({ max: 1000, ttl: 60000 });
```

## Performance Checklist
- [ ] Lighthouse score ≥ 90 on all categories
- [ ] Bundle size analyzed — no unnecessary imports
- [ ] Images optimized (WebP/AVIF, lazy loaded, sized)
- [ ] Fonts preloaded, subset, display: swap
- [ ] Database queries use indexes (check EXPLAIN)
- [ ] API responses cached where possible
- [ ] No memory leaks (stable heap over time)
- [ ] Background processing for expensive operations
