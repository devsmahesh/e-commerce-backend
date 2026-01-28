import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      success: true,
      message: 'E-commerce API is running',
      data: {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      },
    };
  }
}

