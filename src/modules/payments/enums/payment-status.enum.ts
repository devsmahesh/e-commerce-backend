/**
 * Payment Status Enum
 * 
 * Represents the payment state of an order.
 * Database is the source of truth, webhooks confirm final state.
 */
export enum PaymentStatus {
  /** Initial state - order created but payment not initiated */
  PENDING = 'PENDING',
  
  /** Razorpay order created, awaiting payment */
  CREATED = 'CREATED',
  
  /** Payment verification pending (client-side verification, not final) */
  VERIFICATION_PENDING = 'VERIFICATION_PENDING',
  
  /** Payment successfully captured and confirmed via webhook */
  PAID = 'PAID',
  
  /** Payment failed */
  FAILED = 'FAILED',
  
  /** Full refund processed */
  REFUNDED = 'REFUNDED',
  
  /** Partial refund processed */
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

