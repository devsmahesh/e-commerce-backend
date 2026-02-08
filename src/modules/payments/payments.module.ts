import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RazorpayService } from './razorpay.service';
import { PaymentEventService } from './payment-event.service';
import { PaymentsController } from './payments.controller';
import { OrdersModule } from '../orders/orders.module';
import { PaymentEvent, PaymentEventSchema } from './schemas/payment-event.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';

@Module({
  imports: [
    forwardRef(() => OrdersModule),
    MongooseModule.forFeature([
      { name: PaymentEvent.name, schema: PaymentEventSchema },
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [RazorpayService, PaymentEventService],
  exports: [RazorpayService, PaymentEventService],
})
export class PaymentsModule {}

