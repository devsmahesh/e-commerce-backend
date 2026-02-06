import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

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

  // Global prefix - all routes are under /api/v1
  // Note: Images are now served from Cloudinary, not local file system
  app.setGlobalPrefix('api/v1');

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

