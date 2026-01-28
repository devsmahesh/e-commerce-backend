# E-commerce Backend API - cURL Requests

## Base URL
```
http://localhost:8000/api/v1
```

## Authentication Token
Replace `<YOUR_TOKEN>` with your JWT access token obtained from login/register endpoints.
Replace `<ADMIN_TOKEN>` with an admin user's JWT token.

---

## 1. Health Check

### Get Health Status
```bash
curl -X GET http://localhost:8000/api/v1
```

---

## 2. Authentication (`/auth`)

### Register User
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890"
  }'
```

### Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

### Refresh Token
```bash
curl -X POST http://localhost:8000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your_refresh_token_here"
  }'
```

### Verify Email
```bash
curl -X GET http://localhost:8000/api/v1/auth/verify-email/EMAIL_VERIFICATION_TOKEN
```

### Forgot Password
```bash
curl -X POST http://localhost:8000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

### Reset Password
```bash
curl -X POST http://localhost:8000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "reset_token_here",
    "password": "NewSecurePass123!"
  }'
```

### Logout
```bash
curl -X POST http://localhost:8000/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -d '{
    "refreshToken": "your_refresh_token_here"
  }'
```

---

## 3. Users (`/users`)

### Get Profile
```bash
curl -X GET http://localhost:8000/api/v1/users/profile \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

### Update Profile
```bash
curl -X PUT http://localhost:8000/api/v1/users/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890"
  }'
```

### Get Addresses
```bash
curl -X GET http://localhost:8000/api/v1/users/addresses \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

### Add Address
```bash
curl -X POST http://localhost:8000/api/v1/users/addresses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -d '{
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA",
    "label": "Home",
    "isDefault": true
  }'
```

### Update Address
```bash
curl -X PUT http://localhost:8000/api/v1/users/addresses/ADDRESS_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -d '{
    "street": "456 Oak Ave",
    "city": "Los Angeles",
    "state": "CA",
    "zipCode": "90001",
    "country": "USA",
    "label": "Work",
    "isDefault": false
  }'
```

### Delete Address
```bash
curl -X DELETE http://localhost:8000/api/v1/users/addresses/ADDRESS_ID \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

### Get Wishlist
```bash
curl -X GET http://localhost:8000/api/v1/users/wishlist \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

### Add to Wishlist
```bash
curl -X POST http://localhost:8000/api/v1/users/wishlist/PRODUCT_ID \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

### Remove from Wishlist
```bash
curl -X DELETE http://localhost:8000/api/v1/users/wishlist/PRODUCT_ID \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

---

## 4. Products (`/products`)

### Get All Products (with filters)
```bash
curl -X GET "http://localhost:8000/api/v1/products?page=1&limit=10&search=laptop&categoryId=CATEGORY_ID&minPrice=100&maxPrice=1000&minRating=4&inStock=true&isFeatured=true&sortBy=price&sortOrder=asc"
```

### Get Product by ID
```bash
curl -X GET http://localhost:8000/api/v1/products/PRODUCT_ID
```

### Get Product by Slug
```bash
curl -X GET http://localhost:8000/api/v1/products/slug/product-slug-name
```

### Create Product (Admin)
```bash
curl -X POST http://localhost:8000/api/v1/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "name": "Product Name",
    "description": "Product description",
    "price": 99.99,
    "stock": 100,
    "categoryId": "CATEGORY_ID",
    "images": ["https://example.com/image1.jpg"],
    "tags": ["tag1", "tag2"],
    "isFeatured": true,
    "isActive": true
  }'
```

### Update Product (Admin)
```bash
curl -X PUT http://localhost:8000/api/v1/products/PRODUCT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "name": "Updated Product Name",
    "price": 149.99,
    "stock": 50
  }'
```

### Delete Product (Admin)
```bash
curl -X DELETE http://localhost:8000/api/v1/products/PRODUCT_ID \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

---

## 5. Categories (`/categories`)

### Get All Categories
```bash
curl -X GET "http://localhost:8000/api/v1/categories?includeInactive=false"
```

### Get Category by ID
```bash
curl -X GET http://localhost:8000/api/v1/categories/CATEGORY_ID
```

### Get Category by Slug
```bash
curl -X GET http://localhost:8000/api/v1/categories/slug/category-slug-name
```

### Create Category (Admin)
```bash
curl -X POST http://localhost:8000/api/v1/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "name": "Category Name",
    "description": "Category description",
    "slug": "category-slug",
    "image": "https://example.com/category-image.jpg",
    "isActive": true
  }'
```

### Update Category (Admin)
```bash
curl -X PUT http://localhost:8000/api/v1/categories/CATEGORY_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "name": "Updated Category Name",
    "description": "Updated description"
  }'
```

### Delete Category (Admin)
```bash
curl -X DELETE http://localhost:8000/api/v1/categories/CATEGORY_ID \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

---

## 6. Cart (`/cart`)

### Get Cart
```bash
curl -X GET http://localhost:8000/api/v1/cart \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

### Add to Cart
```bash
curl -X POST http://localhost:8000/api/v1/cart/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -d '{
    "productId": "PRODUCT_ID",
    "quantity": 2
  }'
```

### Update Cart Item
```bash
curl -X PUT http://localhost:8000/api/v1/cart/items/PRODUCT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -d '{
    "quantity": 3
  }'
```

### Remove from Cart
```bash
curl -X DELETE http://localhost:8000/api/v1/cart/items/PRODUCT_ID \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

### Clear Cart
```bash
curl -X DELETE http://localhost:8000/api/v1/cart/clear \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

---

## 7. Orders (`/orders`)

### Create Order
```bash
curl -X POST http://localhost:8000/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -d '{
    "shippingAddress": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA"
    },
    "couponId": "COUPON_ID",
    "shippingCost": 10.00
  }'
```

### Get User Orders
```bash
curl -X GET http://localhost:8000/api/v1/orders \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

### Get All Orders (Admin)
```bash
curl -X GET http://localhost:8000/api/v1/orders/admin \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### Get Order by ID
```bash
curl -X GET http://localhost:8000/api/v1/orders/ORDER_ID \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

### Get Order by Order Number
```bash
curl -X GET http://localhost:8000/api/v1/orders/order-number/ORDER_NUMBER \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

### Update Order Status (Admin)
```bash
curl -X PUT http://localhost:8000/api/v1/orders/ORDER_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "status": "shipped",
    "trackingNumber": "TRACK123456"
  }'
```

---

## 8. Payments (`/payments`)

### Create Checkout Session
```bash
curl -X POST http://localhost:8000/api/v1/payments/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -d '{
    "orderId": "ORDER_ID",
    "successUrl": "https://yoursite.com/success",
    "cancelUrl": "https://yoursite.com/cancel"
  }'
```

### Stripe Webhook (Public)
```bash
curl -X POST http://localhost:8000/api/v1/payments/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: STRIPE_SIGNATURE" \
  -d '{
    "type": "checkout.session.completed",
    "data": {
      "object": {
        "id": "session_id",
        "metadata": {
          "orderId": "ORDER_ID"
        }
      }
    }
  }'
```

---

## 9. Reviews (`/reviews`)

### Get All Reviews
```bash
curl -X GET "http://localhost:8000/api/v1/reviews?productId=PRODUCT_ID&approvedOnly=true"
```

### Get Review by ID
```bash
curl -X GET http://localhost:8000/api/v1/reviews/REVIEW_ID
```

### Create Review
```bash
curl -X POST http://localhost:8000/api/v1/reviews \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -d '{
    "productId": "PRODUCT_ID",
    "rating": 5,
    "comment": "Great product!"
  }'
```

### Approve Review (Admin)
```bash
curl -X POST http://localhost:8000/api/v1/reviews/REVIEW_ID/approve \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### Reject Review (Admin)
```bash
curl -X POST http://localhost:8000/api/v1/reviews/REVIEW_ID/reject \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### Delete Review
```bash
curl -X DELETE http://localhost:8000/api/v1/reviews/REVIEW_ID \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

---

## 10. Coupons (`/coupons`)

### Get All Coupons
```bash
curl -X GET "http://localhost:8000/api/v1/coupons?includeInactive=false"
```

### Get Coupon by ID
```bash
curl -X GET http://localhost:8000/api/v1/coupons/COUPON_ID
```

### Get Coupon by Code
```bash
curl -X GET http://localhost:8000/api/v1/coupons/code/SAVE20
```

### Create Coupon (Admin)
```bash
curl -X POST http://localhost:8000/api/v1/coupons \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "code": "SAVE20",
    "description": "$20 off",
    "type": "fixed",
    "value": 20,
    "minPurchase": 100,
    "expiresAt": "2024-12-31T00:00:00Z",
    "usageLimit": 1000
  }'
```

### Update Coupon (Admin)
```bash
curl -X PUT http://localhost:8000/api/v1/coupons/COUPON_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "value": 25,
    "minPurchase": 150
  }'
```

### Delete Coupon (Admin)
```bash
curl -X DELETE http://localhost:8000/api/v1/coupons/COUPON_ID \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

---

## 11. Admin (`/admin`)

### Get Dashboard Stats
```bash
curl -X GET http://localhost:8000/api/v1/admin/dashboard \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### Get All Users
```bash
curl -X GET "http://localhost:8000/api/v1/admin/users?page=1&limit=10" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### Update User Status
```bash
curl -X PUT http://localhost:8000/api/v1/admin/users/USER_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "isActive": true
  }'
```

---

## 12. Analytics (`/analytics`)

### Get Revenue Stats
```bash
curl -X GET "http://localhost:8000/api/v1/analytics/revenue?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### Get Daily Revenue
```bash
curl -X GET "http://localhost:8000/api/v1/analytics/daily-revenue?days=30" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### Get Monthly Sales
```bash
curl -X GET "http://localhost:8000/api/v1/analytics/monthly-sales?months=12" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### Get Best Selling Products
```bash
curl -X GET "http://localhost:8000/api/v1/analytics/best-selling?limit=10" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### Get User Growth
```bash
curl -X GET "http://localhost:8000/api/v1/analytics/user-growth?days=30" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### Get Top Categories
```bash
curl -X GET "http://localhost:8000/api/v1/analytics/top-categories?limit=10" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

---

## Notes

1. **Authentication**: Most endpoints require JWT authentication. Include the token in the `Authorization` header as `Bearer <token>`.

2. **Admin Endpoints**: Endpoints marked as "(Admin)" require an admin user token.

3. **Replace Placeholders**:
   - `<YOUR_TOKEN>` - Your JWT access token
   - `<ADMIN_TOKEN>` - Admin user's JWT token
   - `PRODUCT_ID`, `CATEGORY_ID`, `ORDER_ID`, etc. - Actual IDs from your database

4. **Base URL**: If running on a different port or domain, replace `http://localhost:8000` accordingly.

5. **Query Parameters**: For GET requests with query parameters, make sure to URL-encode special characters.

6. **Windows PowerShell**: If using PowerShell on Windows, use single quotes for JSON strings or escape double quotes:
   ```powershell
   curl -X POST http://localhost:8000/api/v1/auth/login `
     -H "Content-Type: application/json" `
     -d '{\"email\":\"user@example.com\",\"password\":\"SecurePass123!\"}'
   ```

7. **Testing**: You can use tools like Postman, Insomnia, or HTTPie as alternatives to cURL.

