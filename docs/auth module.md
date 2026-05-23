# 🔐 Authentication Module — Technical Documentation

> **Status:** ✅ Production-Ready  
> **Last Updated:** May 2026  
> **Tech Stack:** NestJS 10, Prisma 7, Supabase (PostgreSQL), Passport.js, JWT

---

## 📋 Overview

The Auth module provides secure user authentication and authorization for the e-commerce API. It implements industry-standard practices including password hashing, JWT token management, and role-based access control (RBAC) foundations.

### Key Features
- ✅ User registration with password strength validation
- ✅ Secure login with bcrypt password comparison
- ✅ JWT access tokens with configurable expiration
- ✅ Global route protection with selective public endpoints
- ✅ Type-safe database operations via Prisma
- ✅ Input validation with `class-validator`

---

## 🏗️ Architecture & Design Decisions

### Module Structure
```
src/auth/
├── auth.module.ts          # Module configuration & dependency injection
├── auth.controller.ts      # HTTP route handlers (REST endpoints)
├── auth.service.ts         # Business logic (hashing, token signing)
├── jwt.strategy.ts         # Passport strategy for token validation
├── dto/
│   ├── register.dto.ts     # Registration input validation schema
│   └── login.dto.ts        # Login input validation schema
```

### Why This Structure?
| Decision | Rationale |
|----------|-----------|
| **Service-Controller separation** | Controllers handle HTTP concerns; services handle business logic. Enables testing and reusability. |
| **DTOs with `class-validator`** | Automatic request validation before logic executes. Prevents invalid data from reaching the database. |
| **Passport.js + JwtStrategy** | Industry-standard, extensible auth strategy. Easy to add OAuth, refresh tokens, or 2FA later. |
| **Global guard + `@Public()` decorator** | Secure-by-default: all routes protected unless explicitly marked public. Reduces accidental exposure. |
| **Prisma for data access** | Type-safe queries, auto-generated TypeScript types, and easy migrations. |

---

## 🔑 Authentication Flow

### 1. Registration (`POST /auth/register`)
```mermaid
sequenceDiagram
    participant Client
    participant Controller
    participant Service
    participant Database

    Client->>Controller: POST /auth/register {email, name, password}
    Controller->>Service: authService.register(dto)
    Service->>Database: Find user by email
    alt User exists
        Database-->>Service: User found
        Service-->>Controller: BadRequestException
        Controller-->>Client: 400 Bad Request
    else User doesn't exist
        Database-->>Service: null
        Service->>Service: bcrypt.hash(password, 10)
        Service->>Database: Create user with hashed password
        Database-->>Service: New user (without password)
        Service->>Service: jwtService.sign({ sub: user.id, email })
        Service-->>Controller: { user, access_token }
        Controller-->>Client: 201 Created
    end
```

### 2. Login (`POST /auth/login`)
```mermaid
sequenceDiagram
    participant Client
    participant Controller
    participant Service
    participant Database

    Client->>Controller: POST /auth/login {email, password}
    Controller->>Service: authService.login(dto)
    Service->>Database: Find user by email
    alt User not found
        Database-->>Service: null
        Service-->>Controller: UnauthorizedException
        Controller-->>Client: 401 Invalid credentials
    else User found
        Database-->>Service: User (with hashed password)
        Service->>Service: bcrypt.compare(password, user.password)
        alt Password mismatch
            Service-->>Controller: UnauthorizedException
            Controller-->>Client: 401 Invalid credentials
        else Password matches
            Service->>Service: jwtService.sign({ sub: user.id, email })
            Service-->>Controller: { user (sanitized), access_token }
            Controller-->>Client: 200 OK
        end
    end
```

### 3. Protected Route Access
```mermaid
sequenceDiagram
    participant Client
    participant Guard
    participant Strategy
    participant Service
    participant Controller

    Client->>Guard: GET /users/me + Authorization: Bearer <token>
    Guard->>Strategy: Extract & decode JWT
    Strategy->>Service: validateUser(payload.sub)
    Service->>Database: Find user by ID
    Database-->>Service: User object
    Service-->>Strategy: Validated user
    Strategy-->>Guard: Attach user to req.user
    Guard->>Controller: Proceed with authenticated request
    Controller->>Service: usersService.findOne(req.user.id)
    Service->>Database: Fetch user profile
    Database-->>Service: User data
    Service-->>Controller: Profile object
    Controller-->>Client: 200 OK + user profile
```

---

## 🌐 API Endpoints

### Public Endpoints (No Authentication Required)

| Method | Endpoint | Description | Request Body | Success Response |
|--------|----------|-------------|--------------|-----------------|
| `POST` | `/auth/register` | Register a new user | `{ email, name, password }` | `201 Created` + `{ user, access_token }` |
| `POST` | `/auth/login` | Authenticate and receive JWT | `{ email, password }` | `200 OK` + `{ user, access_token }` |

### Protected Endpoints (Requires JWT)

| Method | Endpoint | Description | Headers | Success Response |
|--------|----------|-------------|---------|-----------------|
| `GET` | `/users/me` | Get current user's profile | `Authorization: Bearer <token>` | `200 OK` + user object |
| `PATCH` | `/users/me` | Update current user's profile | `Authorization: Bearer <token>` + `{ name?, email? }` | `200 OK` + updated user |

---

## 🔒 Security Implementation

### Password Security
```typescript
// Password hashing with bcrypt (10 salt rounds)
const hashedPassword = await bcrypt.hash(plainPassword, 10);

// Password verification
const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
```
- ✅ **Never store plain-text passwords**
- ✅ **Use adaptive hashing (bcrypt) to resist brute-force attacks**
- ✅ **Generic error messages** to prevent email enumeration attacks

### JWT Token Management
```typescript
// Token signing
const token = jwtService.sign(
  { sub: user.id, email: user.email }, // Payload
  { expiresIn: '7d' } // Expiration
);

// Token verification (handled by Passport/JwtStrategy)
// Automatically validates signature, expiration, and attaches user to request
```
- ✅ **Short-lived tokens** (7 days) reduce exposure window
- ✅ **Standard `sub` claim** for user ID (RFC 7519 compliant)
- ✅ **Secret stored in environment variables** (never in code)

### Input Validation
```typescript
// RegisterDto example
export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Password too weak',
  })
  password: string;
}
```
- ✅ **Whitelist validation**: Only defined fields are accepted (`whitelist: true`)
- ✅ **Strong password requirements**: Minimum length, uppercase, lowercase, number/special char
- ✅ **Automatic sanitization**: Extra fields are stripped before processing

### Data Exposure Control
```typescript
// Never return sensitive fields in API responses
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    name: true,
    role: true,
    createdAt: true,
    // password is NEVER selected
  },
});
```
- ✅ **Explicit field selection** prevents accidental data leaks
- ✅ **`@Exclude()` decorator** (via `class-transformer`) as backup protection

---

## ⚙️ Environment Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase pooler) | `postgresql://postgres:pass@aws-1-eu-west-2.pooler.supabase.com:5432/postgres?schema=public` | ✅ |
| `JWT_SECRET` | Secret key for signing JWTs (min 32 chars recommended) | `your-super-secret-key-change-in-production` | ✅ |

> 🔐 **Security Note**: Never commit `.env` to version control. Use `.env.example` for documentation.

---

## 🧪 Testing with Postman

### 1. Register a New User
```http
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "name": "Test User",
  "password": "SecurePass123!"
}
```

**Expected Response (201 Created):**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "test@example.com",
    "name": "Test User",
    "role": "USER",
    "createdAt": "2026-05-23T..."
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 2. Login to Get a Token
```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "SecurePass123!"
}
```

### 3. Access Protected Route
```http
GET http://localhost:3000/api/users/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Test Unauthorized Access (Should Fail)
```http
GET http://localhost:3000/api/users/me
```
**Expected Response:** `401 Unauthorized`

---

## 🔄 Error Handling

| Scenario | HTTP Status | Response Body |
|----------|-------------|---------------|
| Email already registered | `400 Bad Request` | `{ "message": "Email already registered" }` |
| Invalid credentials | `401 Unauthorized` | `{ "message": "Invalid credentials" }` |
| Missing/invalid JWT | `401 Unauthorized` | `{ "message": "Unauthorized" }` |
| User not found | `404 Not Found` | `{ "message": "User with ID X not found" }` |
| Validation error | `400 Bad Request` | `{ "message": ["email must be an email", "password too weak"] }` |

> 💡 **Pro Tip**: Generic "Invalid credentials" messages prevent attackers from enumerating valid emails.

---

## 🚀 Deployment Considerations

### Production Checklist
- [ ] **Rotate `JWT_SECRET`** to a cryptographically secure random string (use `crypto.randomBytes(32)`)
- [ ] **Set token expiration** appropriate to your use case (shorter for high-security apps)
- [ ] **Enable HTTPS** in production (Supabase provides this by default)
- [ ] **Rate-limit auth endpoints** to prevent brute-force attacks (consider `@nestjs/throttler`)
- [ ] **Log auth events** (logins, failed attempts) for security monitoring
- [ ] **Implement refresh tokens** for better UX without compromising security (future enhancement)

### Scaling Notes
- **Stateless JWTs** scale horizontally — no session storage required
- **Supabase connection pooling** handles concurrent connections efficiently
- **Prisma connection management** via `onModuleInit`/`onModuleDestroy` ensures clean shutdowns

---

## 🔮 Future Enhancements

| Feature | Priority | Description |
|---------|----------|-------------|
| Refresh tokens | High | Issue short-lived access tokens + long-lived refresh tokens for seamless re-auth |
| Email verification | Medium | Send confirmation email on registration; require verification before login |
| Password reset flow | Medium | "Forgot password" with time-limited reset tokens |
| Role-based access control (RBAC) | High | Extend `JwtAuthGuard` to check `req.user.role` for admin-only endpoints |
| Two-factor authentication (2FA) | Low | TOTP-based 2FA for high-security accounts |
| OAuth2 social login | Low | Google, GitHub, etc. via `passport-google-oauth20`, etc. |

---

## 📚 References & Further Reading

- [NestJS Authentication](https://docs.nestjs.com/security/authentication)
- [Passport.js Documentation](https://www.passportjs.org/)
- [JWT RFC 7519](https://datatracker.ietf.org/doc/html/rfc7519)
- [Prisma Authentication Guide](https://www.prisma.io/docs/guides/database/auth)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

---
