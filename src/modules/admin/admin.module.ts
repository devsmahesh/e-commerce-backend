import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Coupon, CouponSchema } from '../coupons/schemas/coupon.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import { Banner, BannerSchema } from './schemas/banner.schema';
import { Category, CategorySchema } from '../categories/schemas/category.schema';
import { ContactModule } from '../contact/contact.module';
import { FileUploadService } from '../../common/services/file-upload.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Coupon.name, schema: CouponSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: Banner.name, schema: BannerSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
    ContactModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, FileUploadService],
})
export class AdminModule {}

