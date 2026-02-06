import { Module, forwardRef } from '@nestjs/common';
import { RazorpayService } from './razorpay.service';
import { PaymentsController } from './payments.controller';
import { OrdersModule } from '../orders/orders.module';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [forwardRef(() => OrdersModule), CartModule],
  controllers: [PaymentsController],
  providers: [RazorpayService],
  exports: [RazorpayService],
})
export class PaymentsModule {}

