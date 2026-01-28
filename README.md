# E-commerce Backend API

Production-ready, scalable E-commerce backend built with NestJS, MongoDB, and Stripe.

## Features

- 🔐 JWT Authentication with Refresh Tokens
- 👥 User Management & Profiles
- 🛍️ Product Catalog with Search & Filters
- 🛒 Shopping Cart
- 📦 Order Management
- 💳 Stripe Payment Integration
- 🎫 Coupon System
- ⭐ Product Reviews
- 📊 Admin Dashboard & Analytics
- 🚀 Redis Caching
- 📸 Image Upload (AWS S3/Cloudinary)
- 📚 Swagger API Documentation

## Tech Stack

- **Framework:** NestJS (Node.js, TypeScript)
- **Database:** MongoDB (Mongoose)
- **Cache:** Redis
- **Authentication:** JWT (Access + Refresh Tokens)
- **Payments:** Stripe
- **Storage:** AWS S3 / Cloudinary
- **Documentation:** Swagger/OpenAPI

## Prerequisites

- Node.js (v18 or higher)
- MongoDB
- Redis (optional but recommended)
- Stripe Account

## Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Update .env with your configuration
```

## Environment Variables

See `.env.example` for all required environment variables.

## Running the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## Docker

```bash
# Build and run with Docker Compose
docker-compose up -d
```

## API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:3000/api/docs`

## Database Seeding

```bash
npm run seed
```

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Project Structure

```
src/
├── config/          # Configuration files
├── common/          # Shared utilities, guards, interceptors
├── modules/         # Feature modules
│   ├── auth/        # Authentication
│   ├── users/       # User management
│   ├── products/    # Product catalog
│   ├── categories/  # Categories
│   ├── cart/        # Shopping cart
│   ├── orders/      # Order management
│   ├── payments/    # Stripe integration
│   ├── reviews/     # Product reviews
│   ├── coupons/     # Coupon system
│   ├── admin/       # Admin dashboard
│   └── analytics/   # Analytics & reports
├── database/        # Database schemas & seeds
└── main.ts          # Application entry point
```

## License

MIT

