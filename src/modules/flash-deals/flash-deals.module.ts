import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FlashDealsService } from './flash-deals.service';
import { FlashDealsController } from './flash-deals.controller';
import { FlashDeal, FlashDealSchema } from './schemas/flash-deal.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FlashDeal.name, schema: FlashDealSchema },
    ]),
  ],
  controllers: [FlashDealsController],
  providers: [FlashDealsService],
  exports: [FlashDealsService],
})
export class FlashDealsModule {}

