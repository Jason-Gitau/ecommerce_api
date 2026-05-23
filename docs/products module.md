
# 📦 Products Module (`src/products`)

This module handles the core catalog functionality for the e-commerce API. It is responsible for product creation, modification, dynamic filtering, and high-performance paginated retrieval.

## 📂 Module Structure

```text
src/products/
├── dto/
│   ├── create-product.dto.ts    # Validation for POST creation
│   ├── update-product.dto.ts    # Validation for PATCH updates (PartialType)
│   └── query-products.dto.ts    # Transformation & validation for GET filters
├── products.controller.ts       # Route definitions and access control
├── products.service.ts          # Business logic and Prisma DB operations
└── products.module.ts           # Dependency injection wiring

```

---

## 🏗 Technical Decisions & Patterns

### 1. Advanced DTO Transformation (`query-products.dto.ts`)

Handling `GET` request query parameters requires strict type casting because Express/NestJS receives all URL query parameters as strings.

* **The Problem:** Prisma expects numbers for prices (`minPrice`, `maxPrice`) and integers for pagination (`page`, `limit`), but the network sends them as strings (e.g., `?limit=10`).
* **The Solution:** We implemented `class-transformer` alongside `class-validator`.
* **Implementation:** We use `@Type(() => Number)` to implicitly cast strings to numbers before validation occurs. We use a custom `@Transform(({ value }) => value === 'true')` to safely parse boolean strings for the `inStock` filter.

### 2. High-Performance Pagination (`products.service.ts`)

Returning thousands of products in a single request crashes clients and spikes database compute.

* **The Pattern:** We implemented cursor-less offset pagination (`skip` and `take`).
* **Performance Optimization:** To return both the current page of data and the total metadata (for frontend pagination components), we must run two queries: `count()` and `findMany()`. Instead of awaiting them sequentially, we execute them concurrently using `Promise.all()`. This effectively halves the database transaction time.

### 3. Dynamic Query Building

The `findAll` method supports dynamic, optional filtering without hardcoding complex SQL strings.

* **Implementation:** We construct a `Prisma.ProductWhereInput` object dynamically.
* **Features:** * `search`: Uses `contains` with `mode: 'insensitive'` for case-agnostic text searching.
* `minPrice` / `maxPrice`: Dynamically appends `>=` (`gte`) and `<=` (`lte`) operators only if the values are provided in the request.
* `inStock`: Toggles between `{ gt: 0 }` (available) and `{ equals: 0 }` (out of stock).



### 4. Hybrid Access Control (`products.controller.ts`)

This module integrates with the application's global `JwtAuthGuard` using a hybrid protection strategy.

* **Read Operations (`GET`):** Explicitly tagged with the `@Public()` decorator. These routes bypass the global JWT guard, allowing unauthenticated guests to browse the catalog and view product details.
* **Write Operations (`POST`, `PATCH`, `DELETE`):** Rely on the default global security posture. Because they lack the `@Public()` decorator, they automatically require a valid Bearer token.
* *Note for future scalability:* These write operations are primed to receive a custom `@Roles('ADMIN')` guard to prevent standard users from modifying inventory.

---

## 📡 API Endpoints

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/products` | **Public** | Fetch all products. Supports pagination (`?page=1&limit=10`) and filtering (`?search=x&minPrice=y`). |
| `GET` | `/api/products/:id` | **Public** | Fetch a single product by its UUID. Throws `404` if not found. |
| `POST` | `/api/products` | Protected | Create a new product. Requires `name` and `price`. `stock` defaults to 0. |
| `PATCH` | `/api/products/:id` | Protected | Update specific fields of an existing product. |
| `DELETE` | `/api/products/:id` | Protected | Delete a product from the database. |

---