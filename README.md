# 🛒 NestJS E-Commerce REST API

A production-ready e-commerce REST API built with **NestJS**, **Prisma**, and **PostgreSQL** (Supabase). Features JWT authentication, full product CRUD, order management with stock control, and a clean modular architecture.

note: Find technical documentation here: [API reference](docs/API_REFERENCE.md)
---

## ✨ Features

- 🔐 JWT Authentication (register, login, protected routes)
- 📦 Products — full CRUD with pagination
- 🛒 Orders — place orders, stock validation, atomic transactions
- 👤 Users — profile management, role-based access
- ✅ Input validation via `class-validator` DTOs
- 🐳 Docker-ready — swap Supabase for local Postgres in one `.env` change
- 📄 Clean modular NestJS architecture

---

## 🏗️ Architecture Overview

```mermaid
graph TD
    Client["🖥️ Client (Postman / Frontend)"]

    Client -->|HTTP Request| Guard["🔐 JwtAuthGuard"]
    Guard -->|valid token| Auth["AuthModule\n/auth/register\n/auth/login"]
    Guard -->|valid token| Products["ProductsModule\n/products"]
    Guard -->|valid token| Orders["OrdersModule\n/orders"]
    Guard -->|valid token| Users["UsersModule\n/users/me"]
    Guard -->|invalid token| Err401["401 Unauthorized"]

    Auth --> ORM["Prisma"]
    Products --> ORM
    Orders --> ORM
    Users --> ORM

    ORM --> DB[("🗄️ PostgreSQL\nSupabase / Docker")]
```

---

## 🗂️ Module Structure

```mermaid
graph LR
    subgraph AuthModule
        AC["auth.controller.ts"]
        AS["auth.service.ts"]
        JWTs["jwt.strategy.ts"]
        JWTg["jwt-auth.guard.ts"]
        LDto["login.dto.ts"]
    end

    subgraph UsersModule
        UC["users.controller.ts"]
        US["users.service.ts"]
        UE["user.entity.ts"]
    end

    subgraph ProductsModule
        PC["products.controller.ts"]
        PS["products.service.ts"]
        PE["product.entity.ts"]
        PDto["create-product.dto.ts"]
    end

    subgraph OrdersModule
        OC["orders.controller.ts"]
        OS["orders.service.ts"]
        OE["order.entity.ts"]
        OIE["order-item.entity.ts"]
        ODto["create-order.dto.ts"]
    end

    AuthModule -->|imports| UsersModule
    OrdersModule -->|imports| UsersModule
    OrdersModule -->|imports| ProductsModule
```

---

## 🗄️ Database Schema

```mermaid
erDiagram
    users {
        uuid id PK
        string name
        string email
        string password
        enum role
        timestamp createdAt
    }

    products {
        uuid id PK
        string name
        string description
        decimal price
        int stock
        timestamp createdAt
    }

    orders {
        uuid id PK
        uuid userId FK
        enum status
        decimal total
        timestamp createdAt
    }

    order_items {
        uuid id PK
        uuid orderId FK
        uuid productId FK
        int quantity
        decimal priceAtTime
    }

    users ||--o{ orders : "places"
    orders ||--o{ order_items : "contains"
    products ||--o{ order_items : "referenced in"
```

---

## 🔐 Auth Flow

```mermaid
sequenceDiagram
    participant Client
    participant Controller
    participant AuthService
    participant UsersService
    participant DB
    participant JwtService

    Client->>Controller: POST /auth/login { email, password }
    Controller->>AuthService: validateUser(email, password)
    AuthService->>UsersService: findByEmail(email)
    UsersService->>DB: SELECT * FROM users WHERE email = ?
    DB-->>UsersService: user row
    UsersService-->>AuthService: user entity
    AuthService->>AuthService: bcrypt.compare(password, hash)
    alt valid
        AuthService->>JwtService: sign({ sub: id, email })
        JwtService-->>Controller: access_token
        Controller-->>Client: 200 { access_token }
    else invalid
        AuthService-->>Controller: throw UnauthorizedException
        Controller-->>Client: 401 Unauthorized
    end
```

---

## 🛒 Place Order Flow

```mermaid
sequenceDiagram
    participant Client
    participant Guard
    participant OrdersService
    participant ProductsService
    participant DB

    Client->>Guard: POST /orders + Bearer token
    Guard->>Guard: Verify JWT
    Guard->>OrdersService: create(userId, items[])

    loop for each item
        OrdersService->>ProductsService: findOne(productId)
        ProductsService->>DB: SELECT product
        DB-->>ProductsService: product
        OrdersService->>OrdersService: check stock >= quantity
    end

    alt any item out of stock
        OrdersService-->>Client: 400 Bad Request
    else all in stock
        OrdersService->>DB: BEGIN TRANSACTION
        OrdersService->>DB: INSERT INTO orders
        OrdersService->>DB: INSERT INTO order_items
        OrdersService->>DB: UPDATE products SET stock = stock - qty
        OrdersService->>DB: COMMIT
        DB-->>Client: 201 Created { order }
    end
```

---

## 📁 Project Structure

```
src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── jwt.strategy.ts
│   ├── jwt-auth.guard.ts
│   └── dto/
│       ├── login.dto.ts
│       └── register.dto.ts
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── entities/
│   │   └── user.entity.ts
│   └── dto/
│       └── update-user.dto.ts
├── products/
│   ├── products.module.ts
│   ├── products.controller.ts
│   ├── products.service.ts
│   ├── entities/
│   │   └── product.entity.ts
│   └── dto/
│       ├── create-product.dto.ts
│       └── update-product.dto.ts
├── orders/
│   ├── orders.module.ts
│   ├── orders.controller.ts
│   ├── orders.service.ts
│   ├── entities/
│   │   ├── order.entity.ts
│   │   └── order-item.entity.ts
│   └── dto/
│       └── create-order.dto.ts
└── main.ts
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A [Supabase](https://supabase.com) account (free tier works fine)

### 1. Clone and install

```bash
git clone https://github.com/your-username/nestjs-ecommerce-api.git
cd nestjs-ecommerce-api
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Database
DATABASE_URL=postgresql://postgres:your-password@db.xxxxxxxxxxxx.supabase.co:5432/postgres
# Optional: use a direct connection for Prisma CLI tasks like migrations
DIRECT_URL=postgresql://postgres:your-password@db.xxxxxxxxxxxx.supabase.co:5432/postgres

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d
```

### 3. Run the app

```bash
# development
npm run start:dev

# production
npm run build
npm run start:prod
```

The API will be running at `http://localhost:3000`.

---

## 🐳 Switch to Local Docker Postgres

When you're ready to run Postgres locally, it's a single `.env` change:

```bash
# Start Postgres in Docker
docker run --name pg-ecommerce \
  -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_DB=ecommerce \
  -p 5432:5432 \
  -d postgres
```

Update `.env`:

```env
DATABASE_URL=postgresql://postgres:secret@localhost:5432/ecommerce
DIRECT_URL=postgresql://postgres:secret@localhost:5432/ecommerce
```

No code changes needed — just restart the app.

---

## 📡 API Endpoints

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | ❌ | Register a new user |
| POST | `/auth/login` | ❌ | Login and receive JWT |

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/me` | ✅ | Get own profile |
| PATCH | `/users/me` | ✅ | Update own profile |

### Products

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/products` | ✅ | List all products (paginated) |
| GET | `/products/:id` | ✅ | Get a single product |
| POST | `/products` | ✅ Admin | Create a product |
| PATCH | `/products/:id` | ✅ Admin | Update a product |
| DELETE | `/products/:id` | ✅ Admin | Delete a product |

> Query params for pagination: `?page=1&limit=10`

### Orders

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/orders` | ✅ | Place a new order |
| GET | `/orders` | ✅ | Get own orders |
| GET | `/orders/:id` | ✅ | Get a single order with items |

---

## 🔑 Authentication

All protected routes require a `Bearer` token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Get the token from `POST /auth/login`.

---

## 📦 Request & Response Examples

### Register

```http
POST /auth/register
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securepassword"
}
```

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Place an Order

```http
POST /orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    { "productId": "uuid-here", "quantity": 2 },
    { "productId": "uuid-here", "quantity": 1 }
  ]
}
```

```json
{
  "id": "order-uuid",
  "status": "pending",
  "total": 149.97,
  "items": [
    { "productId": "...", "quantity": 2, "priceAtTime": 49.99 },
    { "productId": "...", "quantity": 1, "priceAtTime": 49.99 }
  ],
  "createdAt": "2026-05-23T10:00:00.000Z"
}
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| [NestJS](https://nestjs.com) | Framework |
| [Prisma](https://www.prisma.io/docs) | ORM |
| [PostgreSQL](https://postgresql.org) | Database |
| [Supabase](https://supabase.com) | Hosted Postgres (dev) |
| [Docker](https://docker.com) | Local Postgres (prod) |
| [JWT](https://jwt.io) | Authentication |
| [bcrypt](https://github.com/kelektiv/node.bcrypt.js) | Password hashing |
| [class-validator](https://github.com/typestack/class-validator) | DTO validation |

---

## 🧪 Testing with Postman

1. Import the collection (add link here)
2. Set `base_url` variable to `http://localhost:3000`
3. Run `POST /auth/register` first
4. Copy the `access_token` from the response
5. Set it as the `token` variable in your collection
6. All other requests will use it automatically

---

## 🏗️ System Architecture

- Global guard: `JwtAuthGuard` via `APP_GUARD` in `AppModule`
- Public routes: Use `@Public()` decorator from `src/common/decorators`
- Validation: Global `ValidationPipe` with `whitelist: true`
- Pagination envelope: Always `{ data, pagination: { total, page, limit, totalPages } }`
- Money fields: Use Prisma `Decimal @db.Decimal(10,2)` + `Decimal.js` in services
- UUIDs: All IDs are `String @default(uuid())`, never `Int`
- Table mapping: All models use `@@map("lowercase")` for PostgreSQL compatibility

---


## 📌 Key Design Decisions

**Why `priceAtTime` on order items?**
Product prices change. By storing the price at the moment of purchase on each order item, historical orders always reflect what the customer actually paid — not the current price.

**Why transactions on order creation?**
Stock deduction and order creation happen together atomically. If anything fails mid-way, the entire operation rolls back — no phantom stock deductions, no orphaned orders.

**Why export `UsersService` from `UsersModule`?**
NestJS's DI system is module-scoped. Without `exports: [UsersService]`, the `AuthModule` cannot inject it. This is the most common beginner mistake.

---

## 📄 License

MIT
