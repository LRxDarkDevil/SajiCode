---
name: architect
description: Design scalable system architectures and make technology decisions. Covers microservices vs monolith analysis, event-driven architecture, CQRS, domain-driven design, system design methodology, scalability planning, technology selection frameworks, architecture decision records, C4 diagrams, and infrastructure patterns. Use when designing systems, making architectural decisions, or planning for scale.
---

# System Architecture & Design

## Architecture Decision Process

### Step 1: Understand Requirements
```
Functional: What does it DO?
Non-Functional:
  - Expected users (100? 10K? 1M+?)
  - Latency requirements (< 100ms? < 1s?)
  - Availability target (99.9%? 99.99%?)
  - Data sensitivity (PII? Financial? Public?)
  - Compliance (GDPR, SOC2, HIPAA?)
  - Budget constraints
```

### Step 2: Architecture Selection
| Pattern | Best When | Avoid When |
|---------|-----------|------------|
| Monolith | Team < 10, MVP, simple domain | > 50 developers, complex domain |
| Modular Monolith | Growing team, separation needed | Need independent deployment |
| Microservices | Large teams, independent scaling | Small team, simple domain |
| Serverless | Event-driven, variable load | Consistent high-throughput |
| Event-Driven | Async workflows, loose coupling | Strong consistency needed |

### Step 3: Document Decision (ADR)
```markdown
# ADR-001: Choose Modular Monolith Architecture

## Status: Accepted

## Context
We have a team of 5 engineers building a SaaS dashboard.
Expected users: 10K in year 1, 100K in year 3.

## Decision
Start with a modular monolith with clear domain boundaries.

## Consequences
- Faster development velocity initially
- Can extract services later if needed
- Must maintain module boundaries with linting rules
- Single deployment simplifies DevOps
```

## Architecture Patterns

### Modular Monolith
```
src/
├── modules/
│   ├── auth/                # Auth domain
│   │   ├── routes.ts
│   │   ├── service.ts
│   │   ├── repository.ts
│   │   └── types.ts
│   ├── billing/             # Billing domain
│   │   ├── routes.ts
│   │   ├── service.ts
│   │   └── events.ts        # Publishes billing events
│   └── notifications/       # Notifications domain
│       ├── service.ts
│       └── listeners.ts     # Subscribes to billing events
├── shared/                  # Shared kernel
│   ├── database.ts
│   ├── event-bus.ts
│   └── types.ts
└── index.ts
```

**Rule**: Modules communicate through events or shared interfaces — NEVER direct imports of another module's internals.

### Event-Driven Architecture
```ts
// Event bus (in-process for monolith)
type EventHandler = (data: unknown) => Promise<void>;

class EventBus {
  private handlers = new Map<string, EventHandler[]>();

  on(event: string, handler: EventHandler) {
    const existing = this.handlers.get(event) || [];
    this.handlers.set(event, [...existing, handler]);
  }

  async emit(event: string, data: unknown) {
    const handlers = this.handlers.get(event) || [];
    await Promise.allSettled(handlers.map((h) => h(data)));
  }
}

// Usage
eventBus.on("user.created", async (data) => {
  await sendWelcomeEmail(data.email);
  await createDefaultWorkspace(data.userId);
  await trackAnalytics("signup", data);
});

await eventBus.emit("user.created", { userId: user.id, email: user.email });
```

### CQRS (Command Query Responsibility Segregation)
```ts
// Commands (writes) — go through domain logic
class CreateOrderCommand {
  constructor(public userId: string, public items: OrderItem[]) {}
}

async function handleCreateOrder(cmd: CreateOrderCommand) {
  const order = OrderAggregate.create(cmd.userId, cmd.items);
  await orderRepository.save(order);
  await eventBus.emit("order.created", order.toEvent());
}

// Queries (reads) — optimized read models
async function getOrderSummary(userId: string) {
  return db.query(`
    SELECT o.id, o.total, o.status, COUNT(oi.id) as item_count
    FROM orders o JOIN order_items oi ON oi.order_id = o.id
    WHERE o.user_id = $1 GROUP BY o.id ORDER BY o.created_at DESC
  `, [userId]);
}
```

## Scalability Patterns

### Horizontal Scaling Checklist
```
- [ ] Stateless application servers (no in-memory session state)
- [ ] Database connection pooling
- [ ] Centralized session store (Redis)
- [ ] Shared file storage (S3, not local disk)
- [ ] Load balancer with health checks
- [ ] Background job queue (BullMQ, Celery)
- [ ] CDN for static assets
- [ ] Database read replicas for read-heavy workloads
```

### Caching Layers
```
Browser Cache → CDN → Application Cache (Redis) → Database
   (hours)      (min)        (seconds)           (source of truth)
```

### Database Scaling
```
1. Optimize queries (indexes, query plans)     → handles 10x load
2. Read replicas                                → handles 50x reads
3. Connection pooling (PgBouncer)              → handles 100x connections
4. Application-level caching                    → handles 100x reads
5. Sharding (last resort)                       → handles 1000x data
```

## System Design Template

When asked to design a system, follow this structure:
```
1. Clarify requirements (functional + non-functional)
2. Estimate scale (users, requests/sec, storage)
3. Define API contract (endpoints, request/response)
4. Design data model (entities, relationships)
5. Draw high-level architecture (components, data flow)
6. Deep dive into critical components
7. Address bottlenecks and failure points
8. Discuss trade-offs and alternatives
```

## C4 Diagram Levels
```
Level 1: System Context — How the system fits in the world
Level 2: Container — Major technology choices (web app, API, database)
Level 3: Component — Key components within each container
Level 4: Code — Class/function level (only for critical parts)
```

## Rules
- Start simple, add complexity only when proven necessary
- Choose boring technology for critical infrastructure
- Design for the next 10x, not 100x — you'll rewrite by then
- Every cross-service call is a potential failure point
- Prefer async communication between services
- Document ALL architectural decisions in ADRs
