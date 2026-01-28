import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product, ProductSchema } from './schemas/product.schema';
import { RedisModule } from '../../config/redis/redis.module';
import { RedisService } from '../../config/redis/redis.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
    ]),
    RedisModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService, RedisService],
  exports: [ProductsService],
})
export class ProductsModule {}

