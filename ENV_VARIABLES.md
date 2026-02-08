# Environment Variables Reference

Copy these variables to your `.env` file in the root directory.

## Required Variables

```env
# ============================================
# SERVER CONFIGURATION
# ============================================
PORT=3000
NODE_ENV=development

# ============================================
# MONGODB DATABASE (REQUIRED)
# ============================================
MONGO_URI=mongodb://localhost:27017/ecommerce

# ============================================
# JWT AUTHENTICATION (REQUIRED)
# ============================================
# Generate strong secrets for production:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_ACCESS_SECRET=your-super-secret-access-key-change-in-production-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production-min-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ============================================
# RAZORPAY PAYMENT INTEGRATION (Optional)
# ============================================
# Get your keys from: https://dashboard.razorpay.com/app/keys
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
# Get webhook secret from: https://dashboard.razorpay.com/app/webhooks
# Optional, but recommended for webhook verification
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

## Optional Variables

```env
# ============================================
# REDIS CACHE (Optional but Recommended)
# ============================================
# Redis is used for caching product listings and improving performance
# The app will work without Redis, but caching will be disabled
REDIS_URL=redis://localhost:6379

# ============================================
# EMAIL CONFIGURATION (Optional - for email verification & password reset)
# ============================================
# Resend API Key (get from https://resend.com)
RESEND_API_KEY=re_your_api_key_here
# Sign up at https://resend.com and get your API key from the dashboard

EMAIL_FROM=noreply@ecommerce.com
# Note: The EMAIL_FROM address must be verified in your Resend account
# You can verify domains or use the default Resend domain for testing

# ============================================
# FRONTEND URL (for email links and CORS)
# ============================================
FRONTEND_URL=http://localhost:3000

# ============================================
# RATE LIMITING
# ============================================
THROTTLE_TTL=60
THROTTLE_LIMIT=10
```

## Quick Setup

### 1. Create `.env` file in root directory

```bash
touch .env
```

### 2. Copy the required variables above

### 3. Generate JWT secrets (run in terminal):

```bash
node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

### 4. MongoDB:
- Local: `mongodb://localhost:27017/ecommerce`
- MongoDB Atlas: `mongodb+srv://username:password@cluster.mongodb.net/ecommerce`

### 5. Redis (Optional):
- Local: `redis://localhost:6379`
- Redis Cloud: `redis://username:password@host:port`

## Minimum Required Variables

For basic functionality, you only need:

```env
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/ecommerce
JWT_ACCESS_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars
```

## About Image Storage

**Product images are stored as URLs** in the database. You can:
- Use placeholder images (like `https://via.placeholder.com/500`)
- Host images on your frontend server
- Use any free image hosting service (Imgur, etc.)
- Add your own file upload service later if needed

The backend doesn't handle file uploads by default - you just pass image URLs when creating products.

## Production Checklist

Before deploying to production:

- [ ] Change all default/example values
- [ ] Use strong, randomly generated JWT secrets
- [ ] Set `NODE_ENV=production`
- [ ] Use secure MongoDB connection string
- [ ] Configure proper CORS with `FRONTEND_URL`
- [ ] Set up email service (Resend) if needed
- [ ] Set up Redis for caching (recommended)
- [ ] Review rate limiting settings
- [ ] Never commit `.env` file to git
