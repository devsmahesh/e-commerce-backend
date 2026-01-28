import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../modules/auth/schemas/user.schema';
import { Category, CategoryDocument } from '../modules/categories/schemas/category.schema';
import { Product, ProductDocument } from '../modules/products/schemas/product.schema';
import { Coupon, CouponDocument, CouponType } from '../modules/coupons/schemas/coupon.schema';
import * as bcrypt from 'bcrypt';
import { Role } from '../common/decorators/roles.decorator';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const categoryModel = app.get<Model<CategoryDocument>>(getModelToken(Category.name));
  const productModel = app.get<Model<ProductDocument>>(getModelToken(Product.name));
  const couponModel = app.get<Model<CouponDocument>>(getModelToken(Coupon.name));

  console.log('🌱 Starting database seeding...');

  // Clear existing data
  await userModel.deleteMany({});
  await categoryModel.deleteMany({});
  await productModel.deleteMany({});
  await couponModel.deleteMany({});

  // Create Admin User
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const admin = await userModel.create({
    email: 'admin@example.com',
    password: adminPassword,
    firstName: 'Admin',
    lastName: 'User',
    role: Role.Admin,
    isEmailVerified: true,
    isActive: true,
  });
  console.log('✅ Admin user created:', admin.email);

  // Create Test User
  const userPassword = await bcrypt.hash('User123!', 10);
  const user = await userModel.create({
    email: 'user@example.com',
    password: userPassword,
    firstName: 'Test',
    lastName: 'User',
    role: Role.User,
    isEmailVerified: true,
    isActive: true,
  });
  console.log('✅ Test user created:', user.email);

  // Create Categories
  const categories = await categoryModel.insertMany([
    {
      name: 'Electronics',
      slug: 'electronics',
      description: 'Electronic devices and gadgets',
      isActive: true,
      order: 1,
    },
    {
      name: 'Clothing',
      slug: 'clothing',
      description: 'Fashion and apparel',
      isActive: true,
      order: 2,
    },
    {
      name: 'Books',
      slug: 'books',
      description: 'Books and literature',
      isActive: true,
      order: 3,
    },
    {
      name: 'Home & Garden',
      slug: 'home-garden',
      description: 'Home improvement and gardening',
      isActive: true,
      order: 4,
    },
  ]);
  console.log(`✅ Created ${categories.length} categories`);

  // Create Products
  const products = await productModel.insertMany([
    {
      name: 'Smartphone Pro Max',
      slug: 'smartphone-pro-max',
      description: 'Latest generation smartphone with advanced features',
      images: ['https://via.placeholder.com/500'],
      price: 999.99,
      compareAtPrice: 1199.99,
      stock: 50,
      categoryId: categories[0]._id,
      tags: ['mobile', 'smartphone', 'tech'],
      isActive: true,
      isFeatured: true,
      sku: 'SPM-001',
      weight: 200,
      specifications: {
        screen: '6.7 inch',
        storage: '256GB',
        ram: '8GB',
      },
    },
    {
      name: 'Wireless Headphones',
      slug: 'wireless-headphones',
      description: 'Premium wireless headphones with noise cancellation',
      images: ['https://via.placeholder.com/500'],
      price: 199.99,
      stock: 100,
      categoryId: categories[0]._id,
      tags: ['audio', 'headphones', 'wireless'],
      isActive: true,
      isFeatured: true,
      sku: 'WH-001',
      weight: 250,
    },
    {
      name: 'Cotton T-Shirt',
      slug: 'cotton-t-shirt',
      description: 'Comfortable 100% cotton t-shirt',
      images: ['https://via.placeholder.com/500'],
      price: 29.99,
      compareAtPrice: 39.99,
      stock: 200,
      categoryId: categories[1]._id,
      tags: ['clothing', 'casual', 'cotton'],
      isActive: true,
      sku: 'TS-001',
      weight: 150,
    },
    {
      name: 'JavaScript: The Definitive Guide',
      slug: 'javascript-definitive-guide',
      description: 'Comprehensive guide to JavaScript programming',
      images: ['https://via.placeholder.com/500'],
      price: 49.99,
      stock: 75,
      categoryId: categories[2]._id,
      tags: ['programming', 'javascript', 'education'],
      isActive: true,
      sku: 'BK-001',
      weight: 800,
    },
    {
      name: 'Garden Tool Set',
      slug: 'garden-tool-set',
      description: 'Complete set of gardening tools',
      images: ['https://via.placeholder.com/500'],
      price: 79.99,
      stock: 30,
      categoryId: categories[3]._id,
      tags: ['garden', 'tools', 'outdoor'],
      isActive: true,
      sku: 'GT-001',
      weight: 2000,
    },
  ]);
  console.log(`✅ Created ${products.length} products`);

  // Create Coupons
  const coupons = await couponModel.insertMany([
    {
      code: 'WELCOME10',
      description: '10% off for new customers',
      type: CouponType.Percentage,
      value: 10,
      minPurchase: 50,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      usageLimit: 1000,
      isActive: true,
    },
    {
      code: 'SAVE20',
      description: '$20 off on orders over $100',
      type: CouponType.Fixed,
      value: 20,
      minPurchase: 100,
      maxDiscount: 20,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      usageLimit: 500,
      isActive: true,
    },
    {
      code: 'SUMMER25',
      description: '25% off summer collection',
      type: CouponType.Percentage,
      value: 25,
      minPurchase: 75,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      usageLimit: 200,
      isActive: true,
      applicableCategories: [categories[1]._id.toString()],
    },
  ]);
  console.log(`✅ Created ${coupons.length} coupons`);

  console.log('🎉 Database seeding completed!');
  console.log('\n📝 Login credentials:');
  console.log('Admin: admin@example.com / Admin123!');
  console.log('User: user@example.com / User123!');

  await app.close();
}

bootstrap().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});

