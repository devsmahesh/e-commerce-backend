import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentEvent, PaymentEventDocument } from './schemas/payment-event.schema';

/**
 * PaymentEventService
 * 
 * Manages webhook event idempotency.
 * Ensures each Razorpay webhook event is processed only once.
 */
@Injectable()
export class PaymentEventService {
  private readonly logger = new Logger(PaymentEventService.name);

  constructor(
    @InjectModel(PaymentEvent.name)
    private paymentEventModel: Model<PaymentEventDocument>,
  ) {}

  /**
   * Check if an event has already been processed.
   * Returns the existing event if found, null otherwise.
   */
  async findEventById(eventId: string): Promise<PaymentEventDocument | null> {
    return this.paymentEventModel.findOne({ eventId }).exec();
  }

  /**
   * Store a new webhook event.
   * Throws error if eventId already exists (idempotency check).
   */
  async createEvent(
    eventId: string,
    type: string,
    payload: Record<string, any>,
  ): Promise<PaymentEventDocument> {
    try {
      const event = new this.paymentEventModel({
        eventId,
        type,
        payload,
        processed: false,
      });
      return await event.save();
    } catch (error: any) {
      // MongoDB duplicate key error (E11000)
      if (error.code === 11000) {
        this.logger.warn(`Event ${eventId} already exists. This is expected for webhook retries.`);
        // Return existing event
        const existingEvent = await this.findEventById(eventId);
        if (existingEvent) {
          return existingEvent;
        }
      }
      throw error;
    }
  }

  /**
   * Mark an event as processed.
   */
  async markAsProcessed(eventId: string, error?: string): Promise<void> {
    const update: any = {
      processed: true,
      processedAt: new Date(),
    };

    if (error) {
      update.error = error;
    }

    await this.paymentEventModel.updateOne(
      { eventId },
      { $set: update },
    ).exec();
  }

  /**
   * Increment retry count for failed event processing.
   */
  async incrementRetryCount(eventId: string): Promise<void> {
    await this.paymentEventModel.updateOne(
      { eventId },
      { $inc: { retryCount: 1 } },
    ).exec();
  }

  /**
   * Get unprocessed events (for retry mechanism).
   */
  async getUnprocessedEvents(limit = 100): Promise<PaymentEventDocument[]> {
    return this.paymentEventModel
      .find({ processed: false })
      .sort({ createdAt: 1 })
      .limit(limit)
      .exec();
  }
}

