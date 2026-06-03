

# 📦 AI CONTEXT BRIEF: NestJS E-Commerce API

## 1. System Overview & Tech Stack
| Component | Version/Tool |
|-----------|--------------|
| Framework | NestJS 10, TypeScript 5.9 |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma 7 (`@prisma/client@7.8.0`) |
| Auth | `@nestjs/jwt`, `passport-jwt`, `bcrypt` |
| Validation | `class-validator` + `class-transformer` |
| API Prefix | `/api` (set in `main.ts`) |
| Docs | Swagger at `/api/docs` |

## 2. Architectural Conventions (STRICT)
✅ **Follow these exactly. Do not deviate.**
- **Module Structure**: `src/<module>/` → `dto/`, `<module>.module.ts`, `<module>.service.ts`, `<module>.controller.ts`
- **Global Guards**: `JwtAuthGuard` + `RolesGuard` applied globally via `APP_GUARD`. Use `@Public()` to skip auth. Use `@Roles(Role.X)` for RBAC.
- **Routing Order**: Define **specific routes BEFORE parameterized routes** (`/export/csv` before `/:id`) to avoid NestJS routing conflicts.
- **Pagination Envelope**: Always return `{ data: [...], pagination: { total, page, limit, totalPages } }`
- **Error Handling**: Use NestJS HTTP exceptions (`NotFoundException`, `BadRequestException`, `ForbiddenException`). Never throw generic `Error`.
- **IDs**: `String @id @default(uuid())` everywhere. Validate with `ParseUUIDPipe({ version: '4' })`.
- **Money Fields**: `Decimal @db.Decimal(10,2)`. Use `import Decimal from 'decimal.js';`. **NEVER** use `+ - * /` on money. Always use `.plus()`, `.mul()`, `.toDecimalPlaces(2).toNumber()`.

## 3. Database & Prisma Rules
- **Table Mapping**: All models use `@@map("lowercase")` for PostgreSQL compatibility.
- **Service Injection**: Every module that queries DB must `imports: [PrismaModule]`.
- **Schema Sync**: Use `npx prisma db push` for dev. Use `npx prisma migrate dev` only when migration history is required.
- **Relations**: Always `include` nested relations when needed. Never `select` sensitive fields (`password`, `adminNotes`, tokens).
- **Enums**: Import from `@prisma/client` (e.g., `import { Role } from '@prisma/client'`).

## 4. Security & Auth Patterns
- **Registration**: Hardcodes `role: Role.USER`. Client-supplied roles are ignored.
- **Banned Users**: `AuthService.login()` checks `user.isBanned` → throws `ForbiddenException`.
- **Field Exposure**: Explicit `select` in all Prisma queries. Never return `*`.
- **Generic Errors**: Use `"Invalid credentials"` or `"Resource not found"` to prevent ID/email enumeration.
- **CSV Exports**: Escape quotes, wrap values, use `\r\n` line endings for Excel compatibility.

## 5. API Design Standards
| Pattern | Example |
|---------|---------|
| Public Read | `@Public() @Get()` |
| Protected Write | `@Post()` (relies on global guard) |
| Role-Restricted | `@UseGuards(RolesGuard) @Roles(Role.ADMIN)` |
| Query Validation | `@Query() query: QueryDto` with `@Type(() => Number)` |
| UUID Validation | `@Param('id', ParseUUIDPipe({ version: '4' }))` |
| DTO Inheritance | `UpdateDto extends PartialType(CreateDto)` |

## 6. Existing Module Map
```
src/
├── common/          # Shared: @Public(), JwtAuthGuard, RolesGuard, ValidationPipe config
├── auth/            # Register, login, JWT strategy
├── users/           # Profile CRUD (scoped to req.user)
├── products/        # Public catalog + admin CRUD
├── orders/          # Atomic transactions, priceAtTime, ownership enforcement
├── admin/           # Analytics, user oversight, CSV exports (role-locked)
├── prisma/          # PrismaModule + PrismaService singleton
└── app.module.ts    # Wires all modules, applies APP_GUARD
```
**Cross-Module Dependencies**:
- `OrdersModule` imports `ProductsModule` to validate stock before transaction.
- `AdminModule` imports `PrismaModule` directly.
- All modules share the same `PrismaService` connection pool.

## 7. AI Instructions & Constraints
🚫 **NEVER DO THIS**:
- Modify `common/`, `app.module.ts`, `main.ts`, or `prisma/` unless explicitly requested.
- Use `@UseGuards(JwtAuthGuard)` on controllers (it's global).
- Return passwords, tokens, or sensitive fields in API responses.
- Use floating-point math for money (`price + tax` ❌ → `price.plus(tax)` ✅).
- Place parameterized routes (`/:id`) before specific routes (`/export`).

✅ **ALWAYS DO THIS**:
- Return **complete file contents**, not snippets.
- Explicitly import every decorator, pipe, guard, and enum.
- Use `decimal.js` for financial logic.
- Add JSDoc comments to public methods.
- Explain architectural decisions in 1-2 sentences.

## 8. Output Format Requirements
```markdown
### 📁 File: `src/<module>/<file>.ts`
```typescript
// Full file content here
```

### 🔑 Key Implementation Notes
- [Point 1]
- [Point 2]

### 🧪 Test Command
```bash
curl -X POST http://localhost:3000/api/<route> ...
```
```

---

## 📋 How to Use This Brief

When prompting a new AI, structure your request like this:

```text
📦 CONTEXT: I am building a NestJS e-commerce API. Read the full system context from AI_HANDOVER.md.

🎯 TASK: Build the `Reviews` module. Users can leave reviews on products. Admins can moderate/delete them.

✅ REQUIREMENTS:
- Follow ALL architectural conventions in the brief.
- Do NOT modify existing modules or core configs.
- Return complete file contents for all new files.
- Include DTOs, service, controller, and module.
- Explain any Prisma schema changes needed.

🚫 CONSTRAINTS: Strictly follow security, validation, and routing rules documented above.
```

---
