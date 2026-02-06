import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product, ProductSchema } from './schemas/product.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import { Category, CategorySchema } from '../categories/schemas/category.schema';
import { RedisModule } from '../../config/redis/redis.module';
import { RedisService } from '../../config/redis/redis.service';
import { FileUploadService } from '../../common/services/file-upload.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
    RedisModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService, RedisService, FileUploadService],
  exports: [ProductsService],
})
export class ProductsModule {}

