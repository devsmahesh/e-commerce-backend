import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => {
        // If data already has success field, return as is
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // Check if this is a Razorpay order response (has 'id' field starting with 'order_')
        // Razorpay orders should be returned directly without wrapping
        if (
          data &&
          typeof data === 'object' &&
          'id' in data &&
          typeof data.id === 'string' &&
          data.id.startsWith('order_')
        ) {
          return data as any;
        }

        // Check if this is an order response (has 'orderNumber' field)
        // Orders should be returned directly without wrapping so frontend can access id and orderNumber
        if (
          data &&
          typeof data === 'object' &&
          'orderNumber' in data &&
          'id' in data
        ) {
          return data as any;
        }

        return {
          success: true,
          message: 'Success',
          data,
        };
      }),
    );
  }
}

