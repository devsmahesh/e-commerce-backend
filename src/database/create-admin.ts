import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../modules/auth/schemas/user.schema';
import * as bcrypt from 'bcrypt';
import { Role } from '../common/decorators/roles.decorator';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));

  // Get admin details from command line arguments or use defaults
  const email = process.argv[2] || 'admin@example.com';
  const password = process.argv[3] || 'Admin123!';
  const firstName = process.argv[4] || 'Admin';
  const lastName = process.argv[5] || 'User';

  console.log('🔐 Creating admin account...');

  // Check if admin already exists
  const existingUser = await userModel.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    console.log(`❌ User with email ${email} already exists.`);
    console.log('   To update the user to admin, use the admin API endpoint.');
    await app.close();
    process.exit(1);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create admin user
  const admin = await userModel.create({
    email: email.toLowerCase(),
    password: hashedPassword,
    firstName,
    lastName,
    role: Role.Admin,
    isEmailVerified: true,
    isActive: true,
  });

  console.log('✅ Admin account created successfully!');
  console.log(`   Email: ${admin.email}`);
  console.log(`   Name: ${admin.firstName} ${admin.lastName}`);
  console.log(`   Role: ${admin.role}`);
  console.log(`   Password: ${password} (please change this after first login)`);

  await app.close();
}

bootstrap().catch((error) => {
  console.error('❌ Failed to create admin account:', error);
  process.exit(1);
});

