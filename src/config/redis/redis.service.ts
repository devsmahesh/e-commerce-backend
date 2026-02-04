import { Injectable, Inject, Optional } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  constructor(@Optional() @Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  private isConnected(): boolean {
    return this.redis && this.redis.status === 'ready';
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected()) return null;
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.isConnected()) return;
    try {
      const stringValue = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, stringValue);
      } else {
        await this.redis.set(key, stringValue);
      }
    } catch (error) {
      // Silently fail if Redis is unavailable
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected()) return;
    try {
      await this.redis.del(key);
    } catch (error) {
      // Silently fail if Redis is unavailable
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected()) return false;
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      return false;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected()) return [];
    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      return [];
    }
  }

  async flushPattern(pattern: string): Promise<void> {
    if (!this.isConnected()) return;
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      // Silently fail if Redis is unavailable
    }
  }
}

