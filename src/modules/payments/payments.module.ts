import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';
import { PaymentsController } from './payments.controller';
import { OrdersModule } from '../orders/orders.module';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [OrdersModule, CartModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, RazorpayService],
  exports: [PaymentsService, RazorpayService],
})
export class PaymentsModule {}

