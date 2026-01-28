# E-commerce Backend API Documentation

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <access_token>
```

## API Endpoints

### Authentication (`/auth`)

#### Register
- **POST** `/auth/register`
- **Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890"
}
```

#### Login
- **POST** `/auth/login`
- **Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```
- **Response:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "user": {...},
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

#### Refresh Token
- **POST** `/auth/refresh`
- **Body:**
```json
{
  "refreshToken": "..."
}
```

#### Verify Email
- **GET** `/auth/verify-email/:token`

#### Forgot Password
- **POST** `/auth/forgot-password`
- **Body:**
```json
{
  "email": "user@example.com"
}
```

#### Reset Password
- **POST** `/auth/reset-password`
- **Body:**
```json
{
  "token": "...",
  "password": "NewSecurePass123!"
}
```

#### Logout
- **POST** `/auth/logout`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "refreshToken": "..."
}
```

---

### Users (`/users`)

#### Get Profile
- **GET** `/users/profile`
- **Headers:** `Authorization: Bearer <token>`

#### Update Profile
- **PUT** `/users/profile`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890"
}
```

#### Get Addresses
- **GET** `/users/addresses`
- **Headers:** `Authorization: Bearer <token>`

#### Add Address
- **POST** `/users/addresses`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "street": "123 Main St",
  "city": "New York",
  "state": "NY",
  "zipCode": "10001",
  "country": "USA",
  "label": "Home",
  "isDefault": true
}
```

#### Update Address
- **PUT** `/users/addresses/:addressId`
- **Headers:** `Authorization: Bearer <token>`

#### Delete Address
- **DELETE** `/users/addresses/:addressId`
- **Headers:** `Authorization: Bearer <token>`

#### Get Wishlist
- **GET** `/users/wishlist`
- **Headers:** `Authorization: Bearer <token>`

#### Add to Wishlist
- **POST** `/users/wishlist/:productId`
- **Headers:** `Authorization: Bearer <token>`

#### Remove from Wishlist
- **DELETE** `/users/wishlist/:productId`
- **Headers:** `Authorization: Bearer <token>`

---

### Products (`/products`)

#### Get All Products
- **GET** `/products`
- **Query Parameters:**
  - `page` (default: 1)
  - `limit` (default: 10)
  - `search` - Search term
  - `categoryId` - Filter by category
  - `tags` - Array of tags
  - `minPrice` - Minimum price
  - `maxPrice` - Maximum price
  - `minRating` - Minimum rating (1-5)
  - `inStock` - Filter in stock items (true/false)
  - `isFeatured` - Filter featured products (true/false)
  - `sortBy` - Sort field (price, rating, createdAt, salesCount)
  - `sortOrder` - Sort order (asc, desc)

#### Get Product by ID
- **GET** `/products/:id`

#### Get Product by Slug
- **GET** `/products/slug/:slug`

#### Create Product (Admin)
- **POST** `/products`
- **Headers:** `Authorization: Bearer <admin_token>`

#### Update Product (Admin)
- **PUT** `/products/:id`
- **Headers:** `Authorization: Bearer <admin_token>`

#### Delete Product (Admin)
- **DELETE** `/products/:id`
- **Headers:** `Authorization: Bearer <admin_token>`

---

### Categories (`/categories`)

#### Get All Categories
- **GET** `/categories`
- **Query:** `includeInactive` (true/false)

#### Get Category by ID
- **GET** `/categories/:id`

#### Get Category by Slug
- **GET** `/categories/slug/:slug`

#### Create Category (Admin)
- **POST** `/categories`
- **Headers:** `Authorization: Bearer <admin_token>`

#### Update Category (Admin)
- **PUT** `/categories/:id`
- **Headers:** `Authorization: Bearer <admin_token>`

#### Delete Category (Admin)
- **DELETE** `/categories/:id`
- **Headers:** `Authorization: Bearer <admin_token>`

---

### Cart (`/cart`)

#### Get Cart
- **GET** `/cart`
- **Headers:** `Authorization: Bearer <token>`

#### Add to Cart
- **POST** `/cart/items`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "productId": "...",
  "quantity": 2
}
```

#### Update Cart Item
- **PUT** `/cart/items/:productId`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "quantity": 3
}
```

#### Remove from Cart
- **DELETE** `/cart/items/:productId`
- **Headers:** `Authorization: Bearer <token>`

#### Clear Cart
- **DELETE** `/cart/clear`
- **Headers:** `Authorization: Bearer <token>`

---

### Orders (`/orders`)

#### Create Order
- **POST** `/orders`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "shippingAddress": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA"
  },
  "couponId": "...",
  "shippingCost": 10.00
}
```

#### Get User Orders
- **GET** `/orders`
- **Headers:** `Authorization: Bearer <token>`

#### Get All Orders (Admin)
- **GET** `/orders/admin`
- **Headers:** `Authorization: Bearer <admin_token>`

#### Get Order by ID
- **GET** `/orders/:id`
- **Headers:** `Authorization: Bearer <token>`

#### Get Order by Order Number
- **GET** `/orders/order-number/:orderNumber`
- **Headers:** `Authorization: Bearer <token>`

#### Update Order Status (Admin)
- **PUT** `/orders/:id/status`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Body:**
```json
{
  "status": "shipped",
  "trackingNumber": "TRACK123456"
}
```

---

### Payments (`/payments`)

#### Create Checkout Session
- **POST** `/payments/checkout`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "orderId": "...",
  "successUrl": "https://yoursite.com/success",
  "cancelUrl": "https://yoursite.com/cancel"
}
```

#### Stripe Webhook
- **POST** `/payments/webhook`
- **Headers:** `stripe-signature: ...`
- **Note:** This endpoint is public and handles Stripe webhook events

---

### Reviews (`/reviews`)

#### Get All Reviews
- **GET** `/reviews`
- **Query:** `productId`, `approvedOnly` (true/false)

#### Get Review by ID
- **GET** `/reviews/:id`

#### Create Review
- **POST** `/reviews`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "productId": "...",
  "rating": 5,
  "comment": "Great product!"
}
```

#### Approve Review (Admin)
- **POST** `/reviews/:id/approve`
- **Headers:** `Authorization: Bearer <admin_token>`

#### Reject Review (Admin)
- **POST** `/reviews/:id/reject`
- **Headers:** `Authorization: Bearer <admin_token>`

#### Delete Review
- **DELETE** `/reviews/:id`
- **Headers:** `Authorization: Bearer <token>`

---

### Coupons (`/coupons`)

#### Get All Coupons
- **GET** `/coupons`
- **Query:** `includeInactive` (true/false)

#### Get Coupon by ID
- **GET** `/coupons/:id`

#### Get Coupon by Code
- **GET** `/coupons/code/:code`

#### Create Coupon (Admin)
- **POST** `/coupons`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Body:**
```json
{
  "code": "SAVE20",
  "description": "$20 off",
  "type": "fixed",
  "value": 20,
  "minPurchase": 100,
  "expiresAt": "2024-12-31T00:00:00Z",
  "usageLimit": 1000
}
```

#### Update Coupon (Admin)
- **PUT** `/coupons/:id`
- **Headers:** `Authorization: Bearer <admin_token>`

#### Delete Coupon (Admin)
- **DELETE** `/coupons/:id`
- **Headers:** `Authorization: Bearer <admin_token>`

---

### Admin (`/admin`)

#### Get Dashboard Stats
- **GET** `/admin/dashboard`
- **Headers:** `Authorization: Bearer <admin_token>`

#### Get All Users
- **GET** `/admin/users`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Query:** `page`, `limit`

#### Update User Status
- **PUT** `/admin/users/:id/status`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Body:**
```json
{
  "isActive": true
}
```

---

### Analytics (`/analytics`)

All endpoints require Admin authentication.

#### Get Revenue Stats
- **GET** `/analytics/revenue`
- **Query:** `startDate`, `endDate`

#### Get Daily Revenue
- **GET** `/analytics/daily-revenue`
- **Query:** `days` (default: 30)

#### Get Monthly Sales
- **GET** `/analytics/monthly-sales`
- **Query:** `months` (default: 12)

#### Get Best Selling Products
- **GET** `/analytics/best-selling`
- **Query:** `limit` (default: 10)

#### Get User Growth
- **GET** `/analytics/user-growth`
- **Query:** `days` (default: 30)

#### Get Top Categories
- **GET** `/analytics/top-categories`
- **Query:** `limit` (default: 10)

---

## Response Format

All responses follow this format:

```json
{
  "success": true,
  "message": "Success message",
  "data": {...}
}
```

Error responses:

```json
{
  "success": false,
  "message": "Error message",
  "error": "Error type",
  "statusCode": 400,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/endpoint"
}
```

## Swagger Documentation

Interactive API documentation is available at:
```
http://localhost:3000/api/docs
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error

