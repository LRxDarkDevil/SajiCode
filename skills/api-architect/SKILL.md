---
name: api-architect
description: Design and implement production APIs — RESTful and GraphQL. Covers API design principles, endpoint architecture, authentication flows (OAuth2, JWT, API keys), webhook handlers, third-party API integration, rate limiting, retry logic, API versioning, error standardization, and OpenAPI documentation. Use when designing APIs, integrating external services, or building API clients.
---

# API Architecture

## REST API Design

### URL Structure
```
GET    /api/v1/users          → List users (paginated)
GET    /api/v1/users/:id      → Get single user
POST   /api/v1/users          → Create user
PATCH  /api/v1/users/:id      → Partial update user
DELETE /api/v1/users/:id      → Delete user
GET    /api/v1/users/:id/posts → List user's posts (nested resource)
```

### Response Format
```ts
// Success response
{ "data": { "id": "123", "name": "John" }, "meta": { "requestId": "req_abc" } }

// List response with pagination
{ "data": [...], "meta": { "total": 100, "page": 1, "perPage": 20, "totalPages": 5 } }

// Error response
{ "error": { "code": "VALIDATION_ERROR", "message": "Email is invalid", "details": [...] } }
```

### Status Code Map
| Code | Usage |
|------|-------|
| 200 | Success (GET, PATCH) |
| 201 | Created (POST) |
| 204 | No content (DELETE) |
| 400 | Validation error |
| 401 | Not authenticated |
| 403 | Not authorized |
| 404 | Resource not found |
| 409 | Conflict (duplicate) |
| 422 | Unprocessable entity |
| 429 | Rate limited |
| 500 | Server error |

## Authentication Flows

### JWT Bearer Token
```ts
// Login → returns access + refresh tokens
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = LoginSchema.parse(req.body);
  const user = await userService.authenticate(email, password);
  if (!user) return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });

  const accessToken = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: "15m" });
  const refreshToken = jwt.sign({ sub: user.id, type: "refresh" }, JWT_REFRESH_SECRET, { expiresIn: "7d" });

  res.json({ data: { accessToken, refreshToken, user: { id: user.id, email: user.email } } });
});

// Auth middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Token required" } });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: { code: "TOKEN_EXPIRED", message: "Token expired" } });
  }
}
```

### API Key Authentication
```ts
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"] as string;
  if (!apiKey) return res.status(401).json({ error: { code: "API_KEY_REQUIRED", message: "x-api-key header required" } });

  const client = await apiKeyService.validate(apiKey);
  if (!client) return res.status(401).json({ error: { code: "INVALID_API_KEY", message: "Invalid API key" } });

  req.client = client;
  next();
}
```

## Webhook Handler
```ts
import crypto from "crypto";

app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), (req, res) => {
  const signature = req.headers["stripe-signature"] as string;
  const payload = req.body;

  // Verify webhook signature
  const expectedSig = crypto.createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return res.status(400).json({ error: { code: "INVALID_SIGNATURE" } });
  }

  const event = JSON.parse(payload.toString());
  switch (event.type) {
    case "checkout.session.completed":
      handleCheckoutComplete(event.data.object);
      break;
    case "invoice.payment_failed":
      handlePaymentFailed(event.data.object);
      break;
  }

  res.json({ received: true });
});
```

## Third-Party API Client
```ts
class ApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("retry-after") || "5");
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return this.request(method, path, body);
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(`${method} ${path} failed: ${response.status}`, response.status, error);
      }

      return response.json() as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }

  get<T>(path: string) { return this.request<T>("GET", path); }
  post<T>(path: string, body: unknown) { return this.request<T>("POST", path, body); }
  patch<T>(path: string, body: unknown) { return this.request<T>("PATCH", path, body); }
  delete<T>(path: string) { return this.request<T>("DELETE", path); }
}
```

## Rate Limiting Pattern
```ts
import rateLimit from "express-rate-limit";

// Tiered rate limiting
const publicLimiter = rateLimit({ windowMs: 60000, max: 30 });
const authenticatedLimiter = rateLimit({ windowMs: 60000, max: 100 });
const webhookLimiter = rateLimit({ windowMs: 60000, max: 500 });

app.use("/api/public", publicLimiter);
app.use("/api/v1", requireAuth, authenticatedLimiter);
app.use("/api/webhooks", webhookLimiter);
```

## API Versioning Strategy
```
Option 1: URL versioning (recommended for REST)
  /api/v1/users → /api/v2/users

Option 2: Header versioning
  Accept: application/vnd.myapp.v2+json

Rules:
- Support previous version for minimum 6 months
- Document all breaking changes in changelog
- Use deprecation headers on old versions
```

## Best Practices
- Validate ALL inputs with Zod schemas
- Use consistent error response format across all endpoints
- Implement request ID tracing for debugging
- Log all API calls with method, path, status, duration
- Use cursor-based pagination for large datasets
- Implement idempotency keys for POST/PATCH operations
- Set CORS headers explicitly — never use `origin: "*"` in production
- Document every endpoint with OpenAPI/Swagger
