import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: async () => {
        const redisUrl = process.env.REDIS_URL;
        
        if (!redisUrl) {
          console.warn('Redis URL not configured, Redis features will be disabled');
          return null;
        }

        let retryCount = 0;
        const maxRetries = 3;
        let connectionFailed = false;
        let errorLogged = false;

        const client = new Redis(redisUrl, {
          retryStrategy: (times) => {
            retryCount++;
            if (retryCount > maxRetries) {
              if (!connectionFailed) {
                console.warn(
                  `Redis connection failed after ${maxRetries} attempts. ` +
                  'Redis features will be disabled. ' +
                  'To enable Redis, ensure Redis is running or remove REDIS_URL from your environment.'
                );
                connectionFailed = true;
              }
              return null; // Stop retrying
            }
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          enableOfflineQueue: false, // Don't queue commands when disconnected
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        });

        // Suppress error logging after first error to prevent spam
        client.on('error', (err) => {
          if (!errorLogged && !connectionFailed) {
            console.error('Redis Client Error:', err.message);
            errorLogged = true;
          }
        });

        client.on('connect', () => {
          console.log('Redis Client Connected');
          errorLogged = false;
          connectionFailed = false;
          retryCount = 0;
        });

        return client;
      },
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule {}

