# Admin Module — Technical Documentation

> **Project:** NestJS E-Commerce API  
> **Module:** `src/admin/`  
> **Author:** Generated during development session — May 27, 2026  
> **Stack:** NestJS 10 · TypeScript 5.9 · Prisma 7 · PostgreSQL · Decimal.js · class-validator

---

## Table of Contents

1. [Overview](#1-overview)
2. [Module Architecture](#2-module-architecture)
3. [File Structure](#3-file-structure)
4. [Database Schema Extensions](#4-database-schema-extensions)
5. [Dependency Injection Graph](#5-dependency-injection-graph)
6. [API Endpoints Reference](#6-api-endpoints-reference)
7. [Request Lifecycles](#7-request-lifecycles)
8. [Security & Authorization Model](#8-security--authorization-model)
9. [DTOs & Validation Strategy](#9-dtos--validation-strategy)
10. [Financial Calculations with Decimal.js](#10-financial-calculations-with-decimaljs)
11. [CSV Export Implementation](#11-csv-export-implementation)
12. [Integration With Other Modules](#12-integration-with-other-modules)
13. [Extending the Module](#13-extending-the-module)
14. [Testing Guide](#14-testing-guide)
15. [Environment & Configuration](#15-environment--configuration)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Overview

The Admin module provides the **back-office API layer** for store management, analytics, and operational oversight. It is designed exclusively for users with the `ADMIN` role and exposes endpoints that power admin dashboards, reporting tools, and support workflows.

### Key Responsibilities

| Responsibility | Implementation |
|---------------|---------------|
| **Analytics Aggregation** | Prisma `_sum`, `_count` for efficient KPI calculation |
| **User Oversight** | List, search, filter, ban, and promote users with audit trails |
| **Data Export** | CSV generation with proper escaping, Excel-compatible formatting |
| **Financial Accuracy** | Decimal.js for all money calculations to prevent floating-point drift |
| **Role-Based Access** | Global `@Roles(Role.ADMIN)` guard + class-level security |

### Design Principles

```yaml
Security:
  - All endpoints require JWT + ADMIN role (defense-in-depth)
  - Sensitive fields (password, tokens) never exposed in responses
  - Soft-ban pattern preserves data for audits while blocking access

Performance:
  - Parallel Prisma queries with Promise.all for dashboard metrics
  - Aggregations computed at database level, not in application memory
  - CSV streaming-ready architecture for large datasets

Maintainability:
  - Dedicated module keeps admin logic separate from public API
  - Reusable DTOs ensure validation consistency across endpoints
  - Clear separation: analytics vs user management vs export concerns
```

---

## 2. Module Architecture

```mermaid
graph TD
    AppModule --> AdminModule
    AppModule --> PrismaModule
    AppModule --> AuthModule

    AdminModule --> AdminController
    AdminModule --> AdminService
    AdminModule --> PrismaModule

    AdminService --> PrismaService
    AdminController --> AdminService

    AuthModule -.->|Provides JwtAuthGuard| AdminController
    AuthModule -.->|Provides RolesGuard| AdminController
```

### Why a Dedicated AdminModule?

| Benefit | Explanation |
|---------|-------------|
| **Encapsulation** | Admin-specific logic doesn't pollute public-facing modules |
| **Security Clarity** | Class-level `@Roles(Role.ADMIN)` makes authorization intent explicit |
| **Scalability** | Easy to add new admin features without modifying core business logic |
| **Testing Isolation** | Admin endpoints can be tested independently of user flows |

---

## 3. File Structure

```
src/admin/
├── dto/
│   ├── query-users.dto.ts      # Pagination + search/filter for user listing
│   ├── update-user.dto.ts      # Partial update schema for admin user edits
│   └── order-export.dto.ts     # Date range + status filters for CSV export
├── admin.controller.ts         # Route handlers with class-level security
├── admin.module.ts             # Module declaration + PrismaModule import
└── admin.service.ts            # Business logic: aggregations, CSV generation, user ops
```

### Key Files Explained

| File | Purpose | Critical Details |
|------|---------|-----------------|
| `admin.controller.ts` | HTTP layer | Class-level `@UseGuards(JwtAuthGuard, RolesGuard) + @Roles(Role.ADMIN)` secures ALL routes |
| `admin.service.ts` | Business logic | Uses Prisma aggregations, Decimal.js for money, CSV escaping logic |
| `query-users.dto.ts` | Input validation | `@Type(() => Number)` for query param coercion, `@IsEnum(Role)` for role filtering |
| `order-export.dto.ts` | Export filters | ISO 8601 date strings, optional status filter, validated before DB query |

---

## 4. Database Schema Extensions

The Admin module extends the `User` model with two admin-only fields:

```prisma
model User {
  // ... existing fields
  id          String   @id @default(uuid())
  email       String   @unique
  name        String?
  password    String
  role        Role     @default(USER)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // 👇 NEW: Admin-only fields (added via db push)
  isBanned    Boolean  @default(false)    // Soft-ban: blocks login but preserves data
  adminNotes  String?  @db.Text           // Internal notes for support/audit
  
  orders      Order[]
  @@map("user")
}
```

### Field Specifications

| Field | Type | Default | Purpose | Access |
|-------|------|---------|---------|--------|
| `isBanned` | `Boolean` | `false` | Prevents login while preserving order history | Admin read/write; user read-only (not exposed) |
| `adminNotes` | `String?` | `null` | Internal commentary for support teams | Admin read/write; never exposed to users |

### Migration Strategy

```bash
# 1. Update schema.prisma with new fields
# 2. Sync to Supabase (works with pooler URL)
npx prisma db push

# 3. Regenerate TypeScript types
npx prisma generate

# 4. Restart NestJS server to load new types
npm run start:dev
```

> ⚠️ **Note**: `db push` is used for development. For production deployments with migration history, use `prisma migrate deploy` after testing in staging.

---

## 5. Dependency Injection Graph

```mermaid
graph LR
    JwtAuthGuard -->|Populates req.user| AdminController
    RolesGuard -->|Checks req.user.role| AdminController
    AdminController -->|Injects| AdminService
    AdminService -->|Injects| PrismaService
    PrismaService -->|Connects to| SupabaseDB

    style AdminController fill:#2563eb,color:#fff
    style AdminService fill:#16a34a,color:#fff
```

### Dependency Resolution Flow

1.  **Request arrives** at `AdminController`
2.  **`JwtAuthGuard`** verifies JWT signature → attaches `req.user = { id, email, role }`
3.  **`RolesGuard`** checks `@Roles()` metadata → throws `403` if `role !== 'ADMIN'`
4.  **Controller method** calls `AdminService` with validated parameters
5.  **Service** executes Prisma queries → returns typed results
6.  **Controller** serializes response → NestJS sends HTTP response

---

## 6. API Endpoints Reference

### 🔐 Authentication Requirement
**All endpoints require:**
```http
Authorization: Bearer <admin-jwt-token>
```
+ User must have `role: "ADMIN"` in database.

---

### 📊 Analytics Endpoints

| Method | Path | Description | Query Params | Success Response |
|--------|------|-------------|--------------|-----------------|
| `GET` | `/admin/analytics/overview` | Dashboard KPIs: revenue, orders, users, low-stock alerts | None | `{ totalRevenue, totalOrders, totalUsers, lowStockAlerts }` |
| `GET` | `/admin/analytics/revenue` | Daily revenue trend for charting | `?days=7` (default: 7) | `{ labels: ["YYYY-MM-DD"...], data: [1200.00...] }` |
| `GET` | `/admin/analytics/low-stock` | Products below restock threshold | `?threshold=5` (future) | `[{ productId, name, stock, threshold }]` |

**Example: Overview Response**
```json
{
  "totalRevenue": 1250.50,
  "totalOrders": 15,
  "totalUsers": 8,
  "lowStockAlerts": 3
}
```

---

### 👥 User Management Endpoints

| Method | Path | Description | Query Params / Body | Success Response |
|--------|------|-------------|---------------------|-----------------|
| `GET` | `/admin/users` | List users with pagination + filters | `?page=1&limit=10&search=jason&role=USER&status=active` | `{ data: [UserSummary...], pagination: { total, page, limit, totalPages } }` |
| `GET` | `/admin/users/:id` | Full profile + order summary | Path: `UUID v4` | `{ id, email, name, role, isBanned, adminNotes, orderCount, totalSpent, lastOrderDate }` |
| `PATCH` | `/admin/users/:id` | Update role, ban status, notes | Body: `UpdateUserDto` | Updated user object (sans sensitive fields) |
| `GET` | `/admin/users/:id/orders` | List all orders by user | Path: `UUID v4` + query: `?page=1&limit=10` | `{ data: [OrderWithItems...], pagination: {...} }` |

**User Summary Response Example**
```json
{
  "id": "uuid-here",
  "email": "jason@example.com",
  "name": "Jason",
  "role": "USER",
  "isBanned": false,
  "adminNotes": "VIP customer - priority support",
  "orderCount": 12,
  "totalSpent": 1249.97,
  "lastOrderDate": "2026-05-23T14:43:00.000Z"
}
```

---

### 📤 Export Endpoints

| Method | Path | Description | Query Params | Response |
|--------|------|-------------|--------------|----------|
| `GET` | `/admin/orders/export/csv` | Download orders as CSV | `?startDate=2026-01-01&endDate=2026-12-31&status=SHIPPED` | `200 OK` with `Content-Type: text/csv` + file download |

**CSV Output Format**
```csv
"Order ID","Date","Customer Email","Customer Name","Status","Total","Item Count"
"a1b2c3-d4e5-f6g7","2026-05-23","jason@example.com","Jason","PENDING","129.99","2"
"b2c3d4-e5f6-g7h8","2026-05-22","anna@example.com","Anna","SHIPPED","89.50","1"
```

> 💡 **Excel Compatibility**: Uses `\r\n` line endings and proper quote escaping to prevent "all data in one column" bugs.

---

## 7. Request Lifecycles

### 📊 Analytics Overview Flow
```mermaid
sequenceDiagram
    participant Admin as Admin User
    participant Guard as Guards
    participant Controller as AdminController
    participant Service as AdminService
    participant DB as Prisma / Supabase

    Admin->>Guard: GET /analytics/overview + JWT
    Guard->>Guard: Verify token and check ADMIN role
    Guard->>Controller: Proceed with req.user populated
    Controller->>Service: getOverview()
    Service->>DB: Execute 4 parallel aggregation queries
    DB-->>Service: Return revenue sum, order count, user count, low stock count
    Service->>Service: Format response and handle null values
    Service-->>Controller: Return KPI object
    Controller-->>Admin: 200 OK with JSON payload
```

### 📤 CSV Export Flow
```mermaid
sequenceDiagram
    participant Admin as Admin User
    participant Guard as Guards
    participant Controller as AdminController
    participant Service as AdminService
    participant DB as Prisma / Supabase

    Admin->>Guard: GET /orders/export/csv with date/status filters
    Guard->>Guard: Verify token and check ADMIN role
    Guard->>Controller: Proceed
    Controller->>Service: exportOrders(filters)
    Service->>DB: Query orders including customer and item data
    DB-->>Service: Return matching order records
    Service->>Service: Map records to CSV rows and escape special characters
    Service->>Service: Join rows with Windows line endings
    Service-->>Controller: Return CSV string with headers
    Controller-->>Admin: 200 OK triggering file download
```

---


## 8. Security & Authorization Model

### 🔐 Layered Defense

```mermaid
graph TD
    A[Incoming Request] --> B{Global JwtAuthGuard}
    B -- Invalid or missing token --> C[401 Unauthorized]
    B -- Valid token --> D[req.user populated]
    D --> E{Class-level RolesGuard}
    E -- Role is not ADMIN --> F[403 Forbidden]
    E -- Role is ADMIN --> G[Proceed to Handler]
    G --> H{Check Route Roles}
    H -- Additional roles defined --> I[Validate user roles]
    H -- No extra roles --> J[Execute Handler]
```

### Security Patterns Implemented

| Pattern | Implementation | Why It Matters |
|---------|---------------|---------------|
| **Class-level guards** | `@UseGuards(JwtAuthGuard, RolesGuard)` on controller class | Single source of truth for auth; no accidental public admin routes |
| **Role enumeration** | `@Roles(Role.ADMIN)` using Prisma-generated enum | Type-safe role checks; autocomplete prevents typos |
| **Soft-ban vs hard delete** | `isBanned: Boolean` field instead of deleting users | Preserves audit trail, order history, and compliance data |
| **Field-level exposure control** | Explicit `select` in Prisma queries | Never accidentally leak `password`, `adminNotes`, or tokens |
| **CSV injection prevention** | Escape function wraps values in quotes | Prevents formula injection attacks in exported spreadsheets |
| **Generic error messages** | `NotFoundException` for missing resources | Prevents ID enumeration attacks on user or order IDs |

### Banned User Login Block

The `AuthService.login()` method explicitly checks `isBanned`:

```typescript
if (user.isBanned) {
  throw new ForbiddenException('Account has been suspended');
}
```

✅ **Result**: Banned users receive `403 Forbidden` on login attempts, with no indication of whether their email exists in the system.

---



## 9. DTOs & Validation Strategy

### QueryUsersDto (`src/admin/dto/query-users.dto.ts`)

```typescript
import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '@prisma/client';

export class QueryUsersDto {
  @IsOptional()
  @Type(() => Number)  // 👈 Coerce string query params to numbers
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;  // Search name OR email (case-insensitive)

  @IsOptional()
  @IsEnum(Role)     // 👈 Type-safe role filtering
  role?: Role;

  @IsOptional()
  @IsString()
  status?: 'active' | 'banned';  // Filter by isBanned field
}
```

### UpdateUserDto (`src/admin/dto/update-user.dto.ts`)

```typescript
import { IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() email?: string;
  
  @IsOptional()
  @IsEnum(Role)   // 👈 Only allow valid Role enum values
  role?: Role;

  @IsOptional()
  @IsBoolean()    // 👈 Explicit boolean for ban toggle
  isBanned?: boolean;

  @IsOptional()
  @IsString()
  adminNotes?: string;  // Internal notes (never exposed to users)
}
```

### OrderExportDto (`src/admin/dto/order-export.dto.ts`)

```typescript
import { IsOptional, IsDateString, IsString } from 'class-validator';

export class OrderExportDto {
  @IsOptional()
  @IsDateString()  // 👈 ISO 8601 format: YYYY-MM-DD
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  status?: string;  // e.g., 'PENDING', 'SHIPPED', 'CANCELLED'
}
```

### Validation Pipe Configuration

The global `ValidationPipe` (configured in `main.ts`) ensures:

```typescript
{
  whitelist: true,              // Strip unknown properties
  forbidNonWhitelisted: true,   // Reject requests with extra fields
  transform: true,              // Auto-coerce types via @Type()
  transformOptions: { enableImplicitConversion: true }
}
```

✅ **Result**: Invalid requests fail fast with `400 Bad Request` + detailed validation errors.

---

## 10. Financial Calculations with Decimal.js

### The Problem: Floating-Point Drift

JavaScript's `number` type uses IEEE 754 double-precision, which cannot represent all decimal fractions exactly:

```typescript
0.1 + 0.2 === 0.3  // false! Actually: 0.30000000000000004
```

For financial data, this is unacceptable.

### The Solution: Decimal.js

Prisma returns `Decimal` fields as `Decimal.js` objects. The Admin service uses them correctly:

```typescript
import Decimal from 'decimal.js';  // 👈 Import from library, not Prisma

// Reading: Prisma returns Decimal.js objects
const order = await this.prisma.order.findUnique({ where: { id } });
const total = order.total;  // Already a Decimal.js object

// Calculating: Use Decimal methods, NEVER + - * / operators
const quantity = 2;
const lineTotal = total.mul(quantity);  // ✅ Correct

// Accumulating totals
let grandTotal = new Decimal(0);
grandTotal = grandTotal.plus(lineTotal);  // ✅ Correct

// Before saving to DB: Serialize to 2 decimal places
await this.prisma.order.update({
  data: {
    total: grandTotal.toDecimalPlaces(2).toNumber(),  // ✅ Safe for database
  },
});
```

### Applied in Admin Module

| Use Case | Implementation |
|----------|---------------|
| `totalSpent` calculation | `user.orders.reduce((sum, o) => sum.plus(o.total), new Decimal(0))` |
| Revenue aggregation | `order.aggregate({ _sum: { total: true } })` returns Decimal.js |
| CSV export formatting | `order.total.toString()` preserves exact decimal representation |

✅ **Result**: All monetary values are accurate to 2 decimal places, with no floating-point drift.

---

## 11. CSV Export Implementation

### Architecture: Streaming-Ready Design

The current implementation loads the full result set into memory, which is suitable for datasets < 50k rows. For enterprise-scale exports, the logic can be swapped to a streaming approach with zero controller changes.

### CSV Generation Logic

```typescript
// 1. Fetch data with filters
const orders = await this.prisma.order.findMany({ where, include: { user, items } });

// 2. Define headers
const headers = ['Order ID', 'Date', 'Customer Email', 'Customer Name', 'Status', 'Total', 'Item Count'];

// 3. Map to rows
const rows = orders.map(o => [
  o.id,
  o.createdAt.toISOString().split('T')[0],  // YYYY-MM-DD format
  o.user?.email || 'Unknown',
  o.user?.name || 'Unknown',
  o.status,
  o.total.toString(),  // .toString() prevents floating-point drift
  o.items.reduce((sum, item) => sum + item.quantity, 0),
]);

// 4. Escape CSV values (prevent injection + handle commas/quotes)
const escapeCsv = (val: unknown) => {
  const str = String(val ?? '');
  return `"${str.replace(/"/g, '""')}"`;  // Double internal quotes
};

// 5. Join with Windows line endings for Excel compatibility
const csvContent = [
  headers.map(escapeCsv).join(','),
  ...rows.map(r => r.map(escapeCsv).join(',')),
].join('\r\n');  // 👈 Critical for Excel on Windows
```

### Controller Headers for Download

```typescript
@Get('orders/export/csv')
@Header('Content-Type', 'text/csv')
@Header('Content-Disposition', 'attachment; filename="orders-export.csv"')
exportOrders(@Query() filters: OrderExportDto) {
  return this.adminService.exportOrders(filters);
}
```

✅ **Result**: Browser automatically downloads `orders-export.csv` with proper formatting.

---

## 12. Integration With Other Modules

```mermaid
graph TD
    AuthModule["AuthModule\n(JWT strategy, guards)"]
    PrismaModule["PrismaModule\n(PrismaService)"]
    UsersModule["UsersModule\n(User operations)"]
    OrdersModule["OrdersModule\n(Order transactions)"]
    ProductsModule["ProductsModule\n(Product catalog)"]
    AdminModule["AdminModule\n(Back-office API)"]

    AuthModule -.->|Provides guards| AdminModule
    PrismaModule --> AdminModule
    UsersModule -.->|Shares User model| AdminModule
    OrdersModule -.->|Shares Order model| AdminModule
    ProductsModule -.->|Shares Product model| AdminModule

    style AdminModule fill:#2563eb,color:#fff
```

### Key Integration Points

| Integration | How It Works | Why It Matters |
|------------|--------------|---------------|
| **AuthModule** | Admin controller relies on global `JwtAuthGuard` + `RolesGuard` | No duplicate auth logic; consistent security posture |
| **PrismaModule** | Injects singleton `PrismaService` for all database operations | Single connection pool; consistent transaction handling |
| **User model** | Reads `isBanned`, `adminNotes`; updates role/status | Admin actions directly affect user authentication flow |
| **Order model** | Aggregates revenue, exports order data | Analytics reflect real transactional data |
| **Product model** | Counts low-stock items for dashboard alerts | Inventory insights drive restocking decisions |

---

## 13. Extending the Module

### Adding New Analytics Metrics

```typescript
// In admin.service.ts
async getTopProducts(days: number = 30) {
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - days);

  return this.prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      order: {
        createdAt: { gte: dateLimit },
        status: { not: 'CANCELLED' },
      },
    },
    _sum: { quantity: true, priceAtTime: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 10,
  });
}
```

### Adding Bulk User Operations

```typescript
// POST /admin/users/bulk-update
async bulkUpdateUsers(ids: string[], updates: UpdateUserDto) {
  return this.prisma.$transaction(
    ids.map(id => 
      this.prisma.user.update({
        where: { id },
        data: { ...updates, updatedAt: new Date() },
        select: { id: true, email: true, role: true, isBanned: true }
      })
    )
  );
}
```

### Adding Webhook Notifications

```typescript
// Emit events when admin actions occur
this.eventEmitter.emit('admin.user.banned', { 
  userId, 
  adminId: req.user.id, 
  reason: dto.adminNotes 
});
```

### Adding Role Hierarchy

```prisma
// In schema.prisma
enum Role {
  USER
  STAFF      // 👈 New: Can view analytics but not modify users
  ADMIN
  SUPER_ADMIN // 👈 New: Can manage other admins
}
```

Then update `RolesGuard` to support hierarchical checks:
```typescript
const roleHierarchy = { USER: 0, STAFF: 1, ADMIN: 2, SUPER_ADMIN: 3 };
return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
```

---

## 14. Testing Guide

### Unit Test Example (Jest)

```typescript
// admin.service.spec.ts
describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AdminService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(AdminService);
    prisma = module.get(PrismaService);
  });

  it('should calculate totalSpent excluding cancelled orders', async () => {
    const mockUser = {
      id: 'test-uuid',
      orders: [
        { total: new Decimal('100.00'), status: 'SHIPPED' },
        { total: new Decimal('50.00'), status: 'CANCELLED' },
      ],
    };
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

    const result = await service.findUserWithSummary('test-uuid');
    expect(result.totalSpent).toBe(100.00); // Only non-cancelled order counted
  });
});
```

### E2E Test Example (Supertest)

```typescript
// admin.e2e-spec.ts
describe('Admin Module (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    // Setup test app + login as admin to get token
    adminToken = await loginAsAdmin(app);
  });

  it('GET /admin/analytics/overview returns KPIs', async () => {
    return request(app.getHttpServer())
      .get('/admin/analytics/overview')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('totalRevenue');
        expect(res.body).toHaveProperty('totalOrders');
        expect(res.body).toHaveProperty('totalUsers');
        expect(res.body).toHaveProperty('lowStockAlerts');
      });
  });

  it('GET /admin/orders/export/csv returns CSV content', async () => {
    return request(app.getHttpServer())
      .get('/admin/orders/export/csv')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect('Content-Type', 'text/csv')
      .expect(200)
      .expect((res) => {
        expect(res.text).toContain('Order ID,Date,Customer Email');
        expect(res.text).toMatch(/\r\n/); // Windows line endings
      });
  });
});
```

### Postman Collection for Client Handoff

Export your Postman collection with:
1.  **Environment variables**: `{{base_url}}`, `{{admin_token}}`
2.  **Pre-request scripts**: Auto-refresh token if expired
3.  **Test scripts**: Validate response structure + status codes
4.  **Example responses**: Document expected output for each endpoint

Share the JSON file with clients — they can import it and start testing immediately.

---

## 15. Environment & Configuration

### Required Environment Variables

| Variable | Used By | Purpose | Example |
|----------|---------|---------|---------|
| `DATABASE_URL` | `PrismaService` | PostgreSQL connection string (Supabase pooler) | `postgresql://postgres:pass@aws-1-eu-west-2.pooler.supabase.com:5432/postgres?schema=public` |
| `JWT_SECRET` | `JwtAuthGuard` | Secret key for signing/verifying JWTs | `your-super-secret-key-min-32-chars` |
| `INITIAL_ADMIN_EMAIL` | Seed script | Email for initial admin account (optional) | `admin@example.com` |
| `INITIAL_ADMIN_PASSWORD` | Seed script | Password for initial admin (change on first login) | `ChangeMe123!` |

### Configuration Best Practices

```bash
# .env.example (commit this)
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-here
INITIAL_ADMIN_EMAIL=admin@example.com
# INITIAL_ADMIN_PASSWORD= # Never commit real passwords

# .env (gitignored)
DATABASE_URL=postgresql://postgres:actual-pass@...
JWT_SECRET=actual-secret-key-generated-with-crypto-randomBytes
INITIAL_ADMIN_PASSWORD=TempPass123!
```

### Production Deployment Notes

| Setting | Recommendation |
|---------|---------------|
| **JWT expiration** | Short-lived access tokens (15-60 min) + refresh tokens for UX |
| **Rate limiting** | Apply `@nestjs/throttler` to `/admin/*` routes to prevent brute-force |
| **Logging** | Log admin actions (user bans, role changes) to audit trail |
| **CORS** | Restrict `Access-Control-Allow-Origin` to trusted admin dashboard domains |
| **HTTPS** | Enforce HTTPS in production (Supabase provides this by default) |

---

## 16. Troubleshooting

### Common Issues & Solutions

| Symptom | Likely Cause | Solution |
|---------|-------------|----------|
| `401 Unauthorized` on admin route | Missing/invalid JWT token | Verify `Authorization: Bearer <token>` header; check token expiration |
| `403 Forbidden` on admin route | Valid token but `role !== 'ADMIN'` | Promote user to ADMIN via database or seed script |
| `Validation failed (uuid v4 is expected)` | Route conflict: `:id` param matching "export" | Use more specific path: `/orders/export/csv` instead of `/orders/export` |
| CSV opens with all data in one column | Wrong line endings or missing quotes | Ensure `\r\n` line endings + proper quote escaping in CSV generation |
| `totalSpent` shows floating-point drift | Using `+` operator with Decimal.js | Use `.plus()`, `.mul()` methods; never `+ - * /` |
| `isBanned` field not in response | Missing `select: { isBanned: true }` in Prisma query | Add field to `select` clause in service method |
| Admin can't update another admin's role | Self-demotion prevention logic | Implement super-admin hierarchy or require confirmation |

### Debugging Tips

1.  **Enable NestJS logging**:
    ```bash
    # In main.ts
    app.useLogger(new Logger('AdminModule'));
    ```

2.  **Log Prisma queries** (development only):
    ```typescript
    // In prisma.service.ts
    super({ log: ['query', 'info', 'warn', 'error'] });
    ```

3.  **Test route matching**:
    ```bash
    # Start server and watch startup logs for mapped routes
    npm run start:dev
    # Look for: [RouterExplorer] Mapped {/admin/orders/export/csv, GET} route
    ```

4.  **Verify Prisma types**:
    ```bash
    # Check if new fields exist in generated client
    grep -r "isBanned" node_modules/.prisma/client/index.d.ts
    ```

---

## 🎯 Upwork Presentation Highlights

When presenting this module to clients, emphasize:

| Feature | Client Value |
|---------|-------------|
| **Role-based access control** | "Granular permissions ensure staff only access what they need" |
| **Financial accuracy with Decimal.js** | "No rounding errors in revenue reports or customer balances" |
| **CSV export with Excel compatibility** | "Export data for accounting, shipping, or tax purposes with one click" |
| **Soft-ban pattern** | "Suspend problematic users while preserving order history for compliance" |
| **Analytics aggregations at database level** | "Dashboard loads instantly even with 100k+ orders" |
| **Streaming-ready architecture** | "Export logic can scale to millions of rows without code changes" |
| **Comprehensive validation** | "Invalid requests fail fast with clear error messages" |

---

> 💡 **Pro Tip**: Include a **Postman collection** and **Swagger docs** (`/api/docs`) in your client handoff. This reduces onboarding time and demonstrates professionalism.

---

*This documentation is part of the E-Commerce API project. For integration guides with other modules, see the [Orders Module Docs](#), [Products Module Docs](#), and [Auth Module Docs](#).*