import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { join } from 'path';
import * as express from 'express';
import { AppModule } from './app.module';

// Helper function to get content type based on file extension
function getContentType(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop();
  const contentTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return contentTypes[ext || ''] || 'application/octet-stream';
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // Required for payment webhooks (e.g., Razorpay)
  });

  // Security - Configure Helmet to allow image requests
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:', 'http:'],
        },
      },
    }),
  );

  // CORS - Allow requests from frontend and Vercel image optimization
  const allowedOrigins = [
    'http://localhost:3000',
    'https://runiche.vercel.app',
    // Allow Vercel image optimization service
    /^https:\/\/.*\.vercel\.app$/,
    /^https:\/\/.*\.vercel\.app\/_next\/image$/,
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or image optimization services)
      // This is important for Next.js image optimization which may not send an origin header
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin matches allowed patterns
      const isAllowed = allowedOrigins.some((allowedOrigin) => {
        if (typeof allowedOrigin === 'string') {
          return origin === allowedOrigin;
        }
        if (allowedOrigin instanceof RegExp) {
          return allowedOrigin.test(origin);
        }
        return false;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        // For production, you might want to log this and restrict further
        // For now, allow to support various image optimization services
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
  });

  // Compression
  app.use(compression());

  // Serve static files (for local image storage) - BEFORE global prefix
  // This allows accessing uploaded images via /uploads/categories/filename.jpg
  // Files in public/uploads/ are served at /uploads/ (not under /api/v1)
  // Using Express static middleware directly for better control
  const uploadsPath = join(process.cwd(), 'public', 'uploads');
  
  // Log the uploads path for debugging
  console.log(`📁 Uploads directory: ${uploadsPath}`);
  
  // Use Express static middleware - this must be registered before setGlobalPrefix
  // Add logging middleware to debug requests
  app.use('/uploads', (req, res, next) => {
    console.log(`📥 Static file request: ${req.method} ${req.path}`);
    next();
  });

  app.use(
    '/uploads',
    express.static(uploadsPath, {
      setHeaders: (res, path) => {
        console.log(`📤 Serving file: ${path}`);
        if (path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', getContentType(path));
        }
      },
      // Don't redirect, just return 404 if file not found
      redirect: false,
    }),
  );

  // Global prefix (applied after static files)
  // Exclude /uploads routes from the global prefix using regex pattern
  app.setGlobalPrefix('api/v1', {
    exclude: ['/uploads(.*)'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('E-commerce API')
    .setDescription('Production-ready E-commerce Backend API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('products', 'Product catalog')
    .addTag('categories', 'Categories')
    .addTag('cart', 'Shopping cart')
    .addTag('orders', 'Order management')
    .addTag('payments', 'Payment processing')
    .addTag('reviews', 'Product reviews')
    .addTag('coupons', 'Coupon management')
    .addTag('admin', 'Admin dashboard')
    .addTag('analytics', 'Analytics & reports')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap();

