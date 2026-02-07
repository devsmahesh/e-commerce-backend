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
  const adminPassword = await bcrypt.hash('Mahesh@12three', 10);
  const admin = await userModel.create({
    email: 'mj726788@gmail.com',
    password: adminPassword,
    firstName: 'Admin',
    lastName: 'User',
    role: Role.Admin,
    isEmailVerified: true,
    isActive: true,
  });
  console.log('✅ Admin user created:', admin.email);

  // // Create Test User
  // const userPassword = await bcrypt.hash('User123!', 10);
  // const user = await userModel.create({
  //   email: 'user@example.com',
  //   password: userPassword,
  //   firstName: 'Test',
  //   lastName: 'User',
  //   role: Role.User,
  //   isEmailVerified: true,
  //   isActive: true,
  // });
  // console.log('✅ Test user created:', user.email);

  // Create Categories
  const categories = await categoryModel.insertMany([
    {
      name: 'Ghee',
      slug: 'ghee',
      description: 'Premium cow and buffalo ghee products',
      isActive: true,
      order: 5,
    },
  ]);
  console.log(`✅ Created ${categories.length} categories`);

  // Create Products
  const products = await productModel.insertMany([
    {
      name: 'Premium Cow Ghee - 500g',
      slug: 'premium-cow-ghee-500g',
      description: 'Pure, authentic cow ghee made from fresh cream. Rich in flavor and nutrients.',
      images: ['https://via.placeholder.com/500'],
      price: 599.99,
      compareAtPrice: 699.99,
      stock: 100,
      categoryId: categories[4]._id,
      tags: ['ghee', 'cow', 'premium', 'organic'],
      isActive: true,
      isFeatured: true,
      sku: 'GHEE-COW-500',
      weight: 500,
      gheeType: 'cow',
      purity: 99.9,
      origin: 'Punjab, India',
      shelfLife: '12 months',
      brand: 'Premium Ghee Co',
    },
    {
      name: 'Premium Buffalo Ghee - 1kg',
      slug: 'premium-buffalo-ghee-1kg',
      description: 'Rich and creamy buffalo ghee with authentic taste. Perfect for cooking and traditional recipes.',
      images: ['https://via.placeholder.com/500'],
      price: 1199.99,
      compareAtPrice: 1399.99,
      stock: 50,
      categoryId: categories[4]._id,
      tags: ['ghee', 'buffalo', 'premium'],
      isActive: true,
      isFeatured: true,
      sku: 'GHEE-BUF-1000',
      weight: 1000,
      gheeType: 'buffalo',
      purity: 99.5,
      origin: 'Gujarat, India',
      shelfLife: '12 months',
      brand: 'Premium Ghee Co',
    },
    {
      name: 'Mixed Ghee - 500g',
      slug: 'mixed-ghee-500g',
      description: 'Blend of cow and buffalo ghee for balanced flavor and nutrition.',
      images: ['https://via.placeholder.com/500'],
      price: 549.99,
      stock: 75,
      categoryId: categories[4]._id,
      tags: ['ghee', 'mixed'],
      isActive: true,
      sku: 'GHEE-MIX-500',
      weight: 500,
      gheeType: 'mixed',
      purity: 99.0,
      origin: 'Rajasthan, India',
      shelfLife: '12 months',
      brand: 'Premium Ghee Co',
    },
  ]);
  console.log(`✅ Created ${products.length} products`);


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

