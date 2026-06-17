# API Reference

This is the canonical backend API reference for the app. It is written for frontend work, so it focuses on:

- the actual route surface
- auth requirements
- request payloads
- response shapes
- behavior the React app needs to account for

## Base URL

- Local development: `http://localhost:3000/api`
- Swagger UI: `http://localhost:3000/api/docs` when Swagger is enabled

Every controller in this app is mounted under the global `/api` prefix.

## Cross-Cutting Behavior

### Authentication

- Most routes are protected by a global JWT guard.
- Routes marked `@Public()` do not require auth.
- Protected routes expect `Authorization: Bearer <accessToken>`.
- Login and refresh also set an `httpOnly` cookie named `refresh_token`.
- The cookie path is `/api/auth`.
- Frontend requests that rely on cookies should use `credentials: 'include'`.

### Response Envelope

Most JSON endpoints are wrapped by a global response interceptor:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Rules:

- If the service returns `{ data, pagination }`, the interceptor unwraps `data` and places `pagination` under `meta.pagination`.
- If the service returns a plain value, that value is returned as `data`.
- `StreamableFile` responses bypass the envelope and are returned raw.

### Validation

- Request DTOs use `class-validator` and `class-transformer`.
- Unknown fields are rejected.
- Invalid input returns a `400 Bad Request`.

### Pagination Shape

Paged endpoints return:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "pagination": {
      "total": 0,
      "page": 1,
      "limit": 10,
      "totalPages": 0
    }
  }
}
```

## Common Data Shapes

### User

Public user fields commonly returned by the API:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "Jane Doe",
  "role": "USER",
  "createdAt": "2026-06-11T10:00:00.000Z"
}
```

Admin-specific user fields can also include:

- `isBanned`
- `adminNotes`
- `updatedAt`
- `orderCount`
- `totalSpent`
- `lastOrderDate`

### Product

```json
{
  "id": "uuid",
  "name": "T-Shirt",
  "price": 24.99,
  "stock": 12
}
```

### Order

Orders are usually returned with nested items and products:

```json
{
  "id": "uuid",
  "userId": "uuid",
  "total": 49.98,
  "status": "PENDING",
  "createdAt": "2026-06-11T10:00:00.000Z",
  "items": [
    {
      "id": "uuid",
      "orderId": "uuid",
      "productId": "uuid",
      "quantity": 2,
      "priceAtTime": 24.99,
      "product": {
        "id": "uuid",
        "name": "T-Shirt",
        "price": 24.99,
        "stock": 10
      }
    }
  ]
}
```

### Payment Intent Result

```json
{
  "clientSecret": "pi_...",
  "paymentIntentId": "pi_..."
}
```

## Auth

Base path: `/api/auth`

### `POST /auth/register`

Public.

Creates a new user account and sends a verification email.

Request body:

```json
{
  "email": "user@example.com",
  "name": "Jane Doe",
  "password": "StrongPass123!"
}
```

Validation:

- `email` must be valid
- `name` minimum length: 3
- `password` minimum length: 8 and must satisfy the strength regex

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "Jane Doe",
      "role": "USER",
      "isEmailVerified": false,
      "createdAt": "2026-06-11T10:00:00.000Z"
    },
    "message": "Registration successful. Please check your email to verify your account."
  }
}
```

### `POST /auth/login`

Public.

Authenticates a user, sets the `refresh_token` cookie, and returns an access token.

Request body:

```json
{
  "email": "user@example.com",
  "password": "StrongPass123!"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "Jane Doe",
      "role": "USER"
    }
  }
}
```

### `POST /auth/verify-email`

Public.

Marks a user as verified using the token delivered by email.

Request body:

```json
{
  "token": "verification-token"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Email verified successfully"
  }
}
```

### `POST /auth/request-password-reset`

Public.

Triggers a password reset email if the account exists and is verified.

Request body:

```json
{
  "email": "user@example.com"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "success": true
  }
}
```

### `POST /auth/reset-password`

Public.

Resets the password using the token from the email.

Request body:

```json
{
  "token": "reset-token",
  "newPassword": "NewStrongPass123!"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Password reset successfully"
  }
}
```

### `POST /auth/refresh`

Protected by the global JWT guard.

Issues a new access token and rotates the refresh token cookie.

Important implementation note:

- As currently wired, this route still depends on a valid authenticated request because it is not marked `@Public()`.
- The browser should send credentials so the `refresh_token` cookie is included.

Response:

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ..."
  }
}
```

### `POST /auth/logout`

Protected.

Revokes the stored refresh token and clears the cookie.

Response:

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

## Users

Base path: `/api/users`

### `GET /users/me`

Protected.

Returns the authenticated user profile.

Response:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Jane Doe",
    "role": "USER",
    "createdAt": "2026-06-11T10:00:00.000Z"
  }
}
```

### `PATCH /users/me`

Protected.

Updates the authenticated user profile.

Request body:

```json
{
  "email": "new-email@example.com",
  "name": "Jane D."
}
```

Only `email` and `name` are applied by the service.

Response:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "new-email@example.com",
    "name": "Jane D.",
    "role": "USER",
    "createdAt": "2026-06-11T10:00:00.000Z"
  }
}
```

## Products

Base path: `/api/products`

### `GET /products`

Public.

Returns a paginated product list.

Query params:

- `page` default `1`
- `limit` default `10`
- `minPrice`
- `maxPrice`
- `inStock` (`true` or `false`)
- `search`

Example:

`/api/products?page=1&limit=12&search=shirt&inStock=true`

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "T-Shirt",
      "price": 24.99,
      "stock": 12
    }
  ],
  "meta": {
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 12,
      "totalPages": 1
    }
  }
}
```

### `GET /products/:id`

Public.

Returns a single product by UUID.

Response:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "T-Shirt",
    "price": 24.99,
    "stock": 12
  }
}
```

### `POST /products`

Admin only.

Creates a product.

Request body:

```json
{
  "name": "T-Shirt",
  "price": 24.99,
  "stock": 12
}
```

Notes:

- `stock` is optional and defaults to `0`.
- `price` must be `>= 0`.

### `PATCH /products/:id`

Admin only.

Updates a product.

Request body:

```json
{
  "name": "Updated Name",
  "price": 29.99,
  "stock": 8
}
```

### `DELETE /products/:id`

Admin only.

Deletes a product.

## Orders

Base path: `/api/orders`

### `POST /orders`

Protected.

Creates an order for the authenticated user.

Request body:

```json
{
  "items": [
    {
      "productId": "uuid",
      "quantity": 2
    }
  ]
}
```

Validation:

- `items` must be an array
- at least one item is required
- each `productId` must be a valid UUID v4
- each `quantity` must be an integer `>= 1`

Behavior:

- Validates product existence
- Validates stock before creating the order
- Uses a transaction
- Decrements product stock atomically
- Returns the created order with nested items and products

Response:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "total": 49.98,
    "status": "PENDING",
    "items": [
      {
        "id": "uuid",
        "productId": "uuid",
        "quantity": 2,
        "priceAtTime": 24.99,
        "product": {
          "id": "uuid",
          "name": "T-Shirt",
          "price": 24.99,
          "stock": 10
        }
      }
    ]
  }
}
```

### `GET /orders`

Protected.

Returns the authenticated user’s orders, paginated.

Query params:

- `page` default `1`
- `limit` default `10`

Response:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "pagination": {
      "total": 0,
      "page": 1,
      "limit": 10,
      "totalPages": 0
    }
  }
}
```

### `GET /orders/:id`

Protected.

Returns one order for the authenticated user.

Notes:

- The server returns `404` if the order does not exist.
- The server also returns `404` if the order belongs to another user.

## Payments

Base path: `/api/payments`

### `POST /payments/intent`

Protected.

Creates a Stripe PaymentIntent for a pending order.

Request body:

```json
{
  "orderId": "uuid"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "clientSecret": "pi_secret_...",
    "paymentIntentId": "pi_..."
  }
}
```

Implementation notes:

- The order must exist.
- The order must still be in `PENDING` status.
- The amount is converted to Stripe cents internally.
- Current implementation does not check order ownership in this service.

### `POST /payments/refund/:orderId`

Admin only.

Refunds the successful payment for the given order and marks the order as `REFUNDED`.

Response is the raw Stripe refund object wrapped by the API envelope.

## Stripe Webhooks

Base path: `/api/payments/webhooks`

### `POST /payments/webhooks/stripe`

Public.

Receives raw Stripe webhook events.

Important:

- The route must receive the raw body for signature verification.
- The required header is `stripe-signature`.

Supported event types:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`

Response:

```json
{
  "success": true,
  "data": {
    "received": true
  }
}
```

## Admin

Base path: `/api/admin`

All admin routes require:

- a valid JWT
- the `ADMIN` role

### Analytics

#### `GET /admin/analytics/overview`

Returns aggregate metrics.

Response:

```json
{
  "success": true,
  "data": {
    "totalRevenue": 0,
    "totalOrders": 0,
    "totalUsers": 0,
    "lowStockAlerts": 0
  }
}
```

#### `GET /admin/analytics/revenue`

Returns revenue grouped by date for charting.

Query params:

- `days` optional, defaults to `7`

Response:

```json
{
  "success": true,
  "data": {
    "labels": ["2026-06-10", "2026-06-11"],
    "data": [120.5, 98]
  }
}
```

#### `GET /admin/analytics/low-stock`

Placeholder endpoint.

Current response:

```json
{
  "success": true,
  "data": {
    "message": "Low stock endpoint coming soon"
  }
}
```

### User Management

#### `GET /admin/users`

Returns a paginated user list.

Query params:

- `page` default `1`
- `limit` default `10`
- `search`
- `role` (`USER` or `ADMIN`)
- `status` (`active` or `banned`)

Response:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "pagination": {
      "total": 0,
      "page": 1,
      "limit": 10,
      "totalPages": 0
    }
  }
}
```

User rows include:

- `id`
- `email`
- `name`
- `role`
- `isBanned`
- `createdAt`

#### `GET /admin/users/:id`

Returns a user summary plus recent order information.

Response includes:

- `id`
- `email`
- `name`
- `role`
- `isBanned`
- `adminNotes`
- `createdAt`
- `updatedAt`
- `orderCount`
- `totalSpent`
- `lastOrderDate`

#### `PATCH /admin/users/:id`

Updates a user record.

Request body:

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "role": "ADMIN",
  "isBanned": false,
  "adminNotes": "Support note"
}
```

#### `GET /admin/users/:id/orders`

Returns paginated orders for a user.

Query params:

- `page` default `1`
- `limit` default `10`

### Orders

#### `GET /admin/orders`

Returns all orders, paginated.

Query params:

- `page` default `1`
- `limit` default `10`

#### `GET /admin/orders/:id`

Returns any order by ID.

#### `PATCH /admin/orders/:id/status`

Updates order status.

Request body:

```json
{
  "status": "SHIPPED"
}
```

Allowed values come from the Prisma `OrderStatus` enum:

- `PENDING`
- `PAID`
- `CONFIRMED`
- `SHIPPED`
- `DELIVERED`
- `CANCELLED`
- `REFUNDED`
- `FAILED`

### CSV Export

#### `GET /admin/orders/export/csv`

Returns a CSV file download.

Query params:

- `startDate` in ISO date format
- `endDate` in ISO date format
- `status`

Response headers:

- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="orders-export.csv"`

This endpoint returns a raw file stream, not the normal JSON envelope.

## Health

Base path: `/api/health`

### `GET /health`

Public.

Checks application and database connectivity.

Response:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "connected",
    "uptime": 1234.56
  }
}
```

If the database check fails:

```json
{
  "success": true,
  "data": {
    "status": "error",
    "database": "disconnected",
    "error": "DB connection failed"
  }
}
```

## Root

### `GET /`

Returns the app hello string.

Response:

```json
{
  "success": true,
  "data": "Hello World!"
}
```

## Frontend Integration Notes

- Use `credentials: 'include'` for login, refresh, logout, and any browser flow that relies on `refresh_token`.
- Store the access token in memory or another frontend-safe state, then send it as a bearer token.
- Use the `meta.pagination` object for all list views with pagination.
- Handle `404` for unauthorized order access, because the API intentionally hides ownership details.
- Handle raw CSV downloads separately from JSON parsing.

