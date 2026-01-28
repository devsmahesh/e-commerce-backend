# Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- MongoDB installed and running
- Redis installed (optional but recommended)
- Stripe account (for payments)

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=development

MONGO_URI=mongodb://localhost:27017/ecommerce

JWT_ACCESS_SECRET=your-super-secret-access-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

REDIS_URL=redis://localhost:6379

STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

FRONTEND_URL=http://localhost:3000
```

### 3. Start MongoDB

```bash
# Using MongoDB service
mongod

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:7
```

### 4. Start Redis (Optional)

```bash
# Using Redis service
redis-server

# Or using Docker
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

### 5. Seed Database (Optional)

```bash
npm run seed
```

This will create:
- Admin user: `admin@example.com` / `Admin123!`
- Test user: `user@example.com` / `User123!`
- Sample categories, products, and coupons

### 6. Start Development Server

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`

### 7. Access Swagger Documentation

Visit `http://localhost:3000/api/docs` for interactive API documentation.

## Using Docker

### Start all services with Docker Compose

```bash
docker-compose up -d
```

This will start:
- NestJS API (port 3000)
- MongoDB (port 27017)
- Redis (port 6379)

### Stop all services

```bash
docker-compose down
```

## Testing the API

### 1. Register a new user

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'
```

Save the `accessToken` from the response.

### 3. Get products

```bash
curl http://localhost:3000/api/v1/products
```

### 4. Add to cart (requires authentication)

```bash
curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "productId": "PRODUCT_ID",
    "quantity": 2
  }'
```

## Project Structure

```
src/
├── config/          # Configuration (Redis, etc.)
├── common/          # Shared utilities
│   ├── decorators/ # Custom decorators
│   ├── filters/    # Exception filters
│   ├── guards/     # Auth & role guards
│   ├── interceptors/ # Request/response interceptors
│   └── middleware/ # Custom middleware
├── database/        # Database seeds
├── modules/        # Feature modules
│   ├── auth/       # Authentication
│   ├── users/      # User management
│   ├── products/   # Products
│   ├── categories/ # Categories
│   ├── cart/       # Shopping cart
│   ├── orders/     # Orders
│   ├── payments/   # Stripe payments
│   ├── reviews/    # Product reviews
│   ├── coupons/    # Coupons
│   ├── admin/      # Admin dashboard
│   └── analytics/  # Analytics
└── main.ts         # Application entry point
```

## Common Commands

```bash
# Development
npm run start:dev

# Production build
npm run build
npm run start:prod

# Testing
npm run test
npm run test:watch
npm run test:cov

# Linting
npm run lint

# Database seeding
npm run seed
```

## Next Steps

1. Configure Stripe webhooks in your Stripe dashboard
2. Set up email service for verification emails
3. Configure AWS S3 or Cloudinary for image uploads
4. Set up production environment variables
5. Configure CORS for your frontend domain
6. Set up monitoring and logging

## Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is running
- Check `MONGO_URI` in `.env` file

### Redis Connection Error
- Redis is optional - the app will work without it (caching disabled)
- Ensure Redis is running if you want caching

### Port Already in Use
- Change `PORT` in `.env` file
- Or stop the process using port 3000

### Stripe Webhook Issues
- Ensure `STRIPE_WEBHOOK_SECRET` is set correctly
- Use Stripe CLI for local testing: `stripe listen --forward-to localhost:3000/api/v1/payments/webhook`

## Support

For issues or questions, refer to:
- API Documentation: `http://localhost:3000/api/docs`
- README.md for detailed information
- API_DOCUMENTATION.md for endpoint details

