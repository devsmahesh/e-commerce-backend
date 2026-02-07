import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  // Brand colors
  private readonly PRIMARY_COLOR = '#67033F';
  private readonly PRIMARY_FOREGROUND = '#FFFFFF';
  private readonly SECONDARY_COLOR = '#F89C1D';
  private readonly SECONDARY_FOREGROUND = '#0F172A';

  constructor(private configService: ConfigService) {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<string>('SMTP_PORT');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    // Log to console for visibility
    console.log('\n=== EMAIL SERVICE INITIALIZATION ===');
    console.log('SMTP_HOST:', smtpHost || 'NOT SET');
    console.log('SMTP_PORT:', smtpPort || 'NOT SET');
    console.log('SMTP_USER:', smtpUser || 'NOT SET');
    console.log('SMTP_PASS:', smtpPass ? '***SET***' : 'NOT SET');
    console.log('=====================================\n');

    // Only create transporter if SMTP config is provided
    if (smtpHost && smtpPort && smtpUser && smtpPass) {
      const port = parseInt(smtpPort, 10);
      if (isNaN(port)) {
        const errorMsg = `Invalid SMTP_PORT: ${smtpPort}. Must be a number.`;
        this.logger.error(errorMsg);
        console.error('❌ EMAIL ERROR:', errorMsg);
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const successMsg = `SMTP transporter configured: ${smtpHost}:${port}`;
      this.logger.log(successMsg);
      console.log('✅', successMsg);
    } else {
      const warnMsg = 'SMTP configuration not found. Email sending will be disabled. Please configure SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in your .env file.';
      this.logger.warn(warnMsg);
      console.warn('⚠️  EMAIL WARNING:', warnMsg);
      console.warn(`Current SMTP config - HOST: ${smtpHost ? '✓' : '✗'}, PORT: ${smtpPort ? '✓' : '✗'}, USER: ${smtpUser ? '✓' : '✗'}, PASS: ${smtpPass ? '✓' : '✗'}`);
    }
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const emailFrom = this.configService.get<string>('EMAIL_FROM') || 'noreply@ecommerce.com';
    const verificationUrl = `${frontendUrl}/verify-email/${token}`;
    const apiUrl = this.configService.get<string>('API_URL') || 'http://localhost:8000';
    const apiVerificationUrl = `${apiUrl}/api/v1/auth/verify-email/${token}`;
    const logoUrl = this.getLogoUrl();

    const mailOptions = {
      from: emailFrom,
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            ${this.getEmailHeader(logoUrl)}
            <h1 style="color: ${this.PRIMARY_COLOR}; margin-top: 0;">Welcome to Our E-commerce Platform!</h1>
            <p>Thank you for registering with us. To complete your registration, please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background-color: ${this.SECONDARY_COLOR}; color: ${this.SECONDARY_FOREGROUND}; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Verify Email Address</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: ${this.PRIMARY_COLOR};"><a href="${verificationUrl}" style="color: ${this.PRIMARY_COLOR};">${verificationUrl}</a></p>
            <p style="font-size: 12px; color: #666; margin-top: 30px;">
              <strong>Alternative API endpoint:</strong><br>
              ${apiVerificationUrl}
            </p>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              This verification link will expire in 24 hours. If you didn't create an account, please ignore this email.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to Our E-commerce Platform!
        
        Thank you for registering with us. To complete your registration, please verify your email address by visiting the following link:
        
        ${verificationUrl}
        
        Alternative API endpoint:
        ${apiVerificationUrl}
        
        This verification link will expire in 24 hours. If you didn't create an account, please ignore this email.
      `,
    };

    await this.sendEmail(mailOptions);
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const emailFrom = this.configService.get<string>('EMAIL_FROM') || 'noreply@ecommerce.com';
    const resetUrl = `${frontendUrl}/reset-password/${token}`;
    const apiUrl = this.configService.get<string>('API_URL') || 'http://localhost:8000';
    const logoUrl = this.getLogoUrl();

    const mailOptions = {
      from: emailFrom,
      to: email,
      subject: 'Reset Your Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            ${this.getEmailHeader(logoUrl)}
            <h1 style="color: ${this.PRIMARY_COLOR}; margin-top: 0;">Password Reset Request</h1>
            <p>You requested to reset your password. Click the button below to reset it:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: ${this.SECONDARY_COLOR}; color: ${this.SECONDARY_FOREGROUND}; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: ${this.PRIMARY_COLOR};"><a href="${resetUrl}" style="color: ${this.PRIMARY_COLOR};">${resetUrl}</a></p>
            <p style="font-size: 12px; color: #666; margin-top: 30px;">
              <strong>Token:</strong> ${token}<br>
              <strong>API Endpoint:</strong> ${apiUrl}/api/v1/auth/reset-password
            </p>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              This reset link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Reset Request
        
        You requested to reset your password. Visit the following link to reset it:
        
        ${resetUrl}
        
        Token: ${token}
        API Endpoint: ${apiUrl}/api/v1/auth/reset-password
        
        This reset link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
      `,
    };

    await this.sendEmail(mailOptions);
  }

  async sendOrderConfirmationEmail(
    email: string,
    orderData: {
      orderNumber: string;
      items: Array<{ name: string; quantity: number; price: number; total: number }>;
      subtotal: number;
      shipping: number;
      tax: number;
      discount: number;
      total: number;
      shippingAddress: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
      };
    },
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const emailFrom = this.configService.get<string>('EMAIL_FROM') || 'noreply@ecommerce.com';
    const orderUrl = `${frontendUrl}/orders/${orderData.orderNumber}`;
    const logoUrl = this.getLogoUrl();

    const itemsHtml = orderData.items
      .map(
        (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.total.toFixed(2)}</td>
      </tr>
    `,
      )
      .join('');

    const mailOptions = {
      from: emailFrom,
      to: email,
      subject: `Order Confirmation - ${orderData.orderNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Confirmation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            ${this.getEmailHeader(logoUrl)}
            <h1 style="color: ${this.PRIMARY_COLOR}; margin-top: 0;">Thank You for Your Order!</h1>
            <p>Your order has been received and is being processed.</p>
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h2 style="margin-top: 0; color: #333;">Order Details</h2>
              <p><strong>Order Number:</strong> ${orderData.orderNumber}</p>
              <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
                    <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
                    <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
              <div style="margin-top: 20px; padding-top: 15px; border-top: 2px solid #ddd;">
                <p style="text-align: right; margin: 5px 0;"><strong>Subtotal:</strong> $${orderData.subtotal.toFixed(2)}</p>
                ${orderData.shipping > 0 ? `<p style="text-align: right; margin: 5px 0;"><strong>Shipping:</strong> $${orderData.shipping.toFixed(2)}</p>` : ''}
                ${orderData.tax > 0 ? `<p style="text-align: right; margin: 5px 0;"><strong>Tax:</strong> $${orderData.tax.toFixed(2)}</p>` : ''}
                ${orderData.discount > 0 ? `<p style="text-align: right; margin: 5px 0; color: #28a745;"><strong>Discount:</strong> -$${orderData.discount.toFixed(2)}</p>` : ''}
                <p style="text-align: right; margin: 15px 0; font-size: 18px; font-weight: bold; border-top: 2px solid #ddd; padding-top: 10px;">
                  <strong>Total: $${orderData.total.toFixed(2)}</strong>
                </p>
              </div>
              <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
                <h3 style="margin-top: 0;">Shipping Address</h3>
                <p style="margin: 5px 0;">${orderData.shippingAddress.street}</p>
                <p style="margin: 5px 0;">${orderData.shippingAddress.city}, ${orderData.shippingAddress.state} ${orderData.shippingAddress.zipCode}</p>
                <p style="margin: 5px 0;">${orderData.shippingAddress.country}</p>
              </div>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${orderUrl}" style="background-color: ${this.SECONDARY_COLOR}; color: ${this.SECONDARY_FOREGROUND}; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Order</a>
            </div>
            <p style="font-size: 12px; color: #666; margin-top: 30px;">
              If you have any questions about your order, please contact our support team.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        Thank You for Your Order!
        
        Your order has been received and is being processed.
        
        Order Number: ${orderData.orderNumber}
        
        Order Details:
        ${orderData.items.map((item) => `${item.name} - Qty: ${item.quantity} - Price: $${item.price.toFixed(2)} - Total: $${item.total.toFixed(2)}`).join('\n')}
        
        Subtotal: $${orderData.subtotal.toFixed(2)}
        ${orderData.shipping > 0 ? `Shipping: $${orderData.shipping.toFixed(2)}\n` : ''}
        ${orderData.tax > 0 ? `Tax: $${orderData.tax.toFixed(2)}\n` : ''}
        ${orderData.discount > 0 ? `Discount: -$${orderData.discount.toFixed(2)}\n` : ''}
        Total: $${orderData.total.toFixed(2)}
        
        Shipping Address:
        ${orderData.shippingAddress.street}
        ${orderData.shippingAddress.city}, ${orderData.shippingAddress.state} ${orderData.shippingAddress.zipCode}
        ${orderData.shippingAddress.country}
        
        View your order: ${orderUrl}
      `,
    };

    await this.sendEmail(mailOptions);
  }

  async sendOrderStatusUpdateEmail(
    email: string,
    orderData: {
      orderNumber: string;
      status: string;
      trackingNumber?: string;
      cancellationReason?: string;
    },
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const emailFrom = this.configService.get<string>('EMAIL_FROM') || 'noreply@ecommerce.com';
    const orderUrl = `${frontendUrl}/orders/${orderData.orderNumber}`;

    const statusMessages: Record<string, { title: string; message: string; color: string }> = {
      paid: {
        title: 'Payment Received',
        message: 'Your payment has been received and your order is being processed.',
        color: '#007bff',
      },
      processing: {
        title: 'Order Processing',
        message: 'Your order is being prepared for shipment.',
        color: '#ffc107',
      },
      shipped: {
        title: 'Order Shipped',
        message: 'Your order has been shipped and is on its way!',
        color: '#17a2b8',
      },
      delivered: {
        title: 'Order Delivered',
        message: 'Your order has been delivered. Thank you for shopping with us!',
        color: '#28a745',
      },
      cancelled: {
        title: 'Order Cancelled',
        message: 'Your order has been cancelled.',
        color: '#dc3545',
      },
      refunded: {
        title: 'Order Refunded',
        message: 'Your order has been refunded.',
        color: '#6c757d',
      },
    };

    const statusInfo = statusMessages[orderData.status.toLowerCase()] || {
      title: 'Order Status Updated',
      message: `Your order status has been updated to: ${orderData.status}`,
      color: this.PRIMARY_COLOR,
    };

    const logoUrl = this.getLogoUrl();

    const mailOptions = {
      from: emailFrom,
      to: email,
      subject: `Order ${statusInfo.title} - ${orderData.orderNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Status Update</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            ${this.getEmailHeader(logoUrl)}
            <h1 style="color: ${this.PRIMARY_COLOR}; margin-top: 0;">${statusInfo.title}</h1>
            <p>${statusInfo.message}</p>
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Order Number:</strong> ${orderData.orderNumber}</p>
              <p><strong>Status:</strong> <span style="color: ${statusInfo.color}; font-weight: bold; text-transform: capitalize;">${orderData.status}</span></p>
              ${orderData.trackingNumber ? `<p><strong>Tracking Number:</strong> ${orderData.trackingNumber}</p>` : ''}
              ${orderData.cancellationReason ? `<p><strong>Cancellation Reason:</strong> ${orderData.cancellationReason}</p>` : ''}
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${orderUrl}" style="background-color: ${this.SECONDARY_COLOR}; color: ${this.SECONDARY_FOREGROUND}; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Order</a>
            </div>
            <p style="font-size: 12px; color: #666; margin-top: 30px;">
              If you have any questions about your order, please contact our support team.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        ${statusInfo.title}
        
        ${statusInfo.message}
        
        Order Number: ${orderData.orderNumber}
        Status: ${orderData.status}
        ${orderData.trackingNumber ? `Tracking Number: ${orderData.trackingNumber}\n` : ''}
        ${orderData.cancellationReason ? `Cancellation Reason: ${orderData.cancellationReason}\n` : ''}
        
        View your order: ${orderUrl}
      `,
    };

    await this.sendEmail(mailOptions);
  }

  async sendNewOrderNotificationToAdmin(
    adminEmail: string,
    orderData: {
      orderNumber: string;
      customerName: string;
      customerEmail: string;
      items: Array<{ name: string; quantity: number; price: number; total: number }>;
      subtotal: number;
      shipping: number;
      tax: number;
      discount: number;
      total: number;
      shippingAddress: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
      };
    },
  ): Promise<void> {
    const emailFrom = this.configService.get<string>('EMAIL_FROM') || 'noreply@ecommerce.com';
    const apiUrl = this.configService.get<string>('API_URL') || 'http://localhost:8000';
    const adminOrderUrl = `${apiUrl}/api/v1/admin/orders`;
    const logoUrl = this.getLogoUrl();

    const itemsHtml = orderData.items
      .map(
        (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.total.toFixed(2)}</td>
      </tr>
    `,
      )
      .join('');

    const mailOptions = {
      from: emailFrom,
      to: adminEmail,
      subject: `New Order Received - ${orderData.orderNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Order Notification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            ${this.getEmailHeader(logoUrl)}
            <h1 style="color: ${this.PRIMARY_COLOR}; margin-top: 0;">New Order Received!</h1>
            <p>A new order has been placed and requires your attention.</p>
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h2 style="margin-top: 0; color: #333;">Order Details</h2>
              <p><strong>Order Number:</strong> ${orderData.orderNumber}</p>
              <p><strong>Customer:</strong> ${orderData.customerName} (${orderData.customerEmail})</p>
              <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
                    <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
                    <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
              <div style="margin-top: 20px; padding-top: 15px; border-top: 2px solid #ddd;">
                <p style="text-align: right; margin: 5px 0;"><strong>Subtotal:</strong> $${orderData.subtotal.toFixed(2)}</p>
                ${orderData.shipping > 0 ? `<p style="text-align: right; margin: 5px 0;"><strong>Shipping:</strong> $${orderData.shipping.toFixed(2)}</p>` : ''}
                ${orderData.tax > 0 ? `<p style="text-align: right; margin: 5px 0;"><strong>Tax:</strong> $${orderData.tax.toFixed(2)}</p>` : ''}
                ${orderData.discount > 0 ? `<p style="text-align: right; margin: 5px 0; color: #28a745;"><strong>Discount:</strong> -$${orderData.discount.toFixed(2)}</p>` : ''}
                <p style="text-align: right; margin: 15px 0; font-size: 18px; font-weight: bold; border-top: 2px solid #ddd; padding-top: 10px;">
                  <strong>Total: $${orderData.total.toFixed(2)}</strong>
                </p>
              </div>
              <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
                <h3 style="margin-top: 0;">Shipping Address</h3>
                <p style="margin: 5px 0;">${orderData.shippingAddress.street}</p>
                <p style="margin: 5px 0;">${orderData.shippingAddress.city}, ${orderData.shippingAddress.state} ${orderData.shippingAddress.zipCode}</p>
                <p style="margin: 5px 0;">${orderData.shippingAddress.country}</p>
              </div>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${adminOrderUrl}" style="background-color: ${this.SECONDARY_COLOR}; color: ${this.SECONDARY_FOREGROUND}; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Orders Dashboard</a>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        New Order Received!
        
        A new order has been placed and requires your attention.
        
        Order Number: ${orderData.orderNumber}
        Customer: ${orderData.customerName} (${orderData.customerEmail})
        
        Order Details:
        ${orderData.items.map((item) => `${item.name} - Qty: ${item.quantity} - Price: $${item.price.toFixed(2)} - Total: $${item.total.toFixed(2)}`).join('\n')}
        
        Subtotal: $${orderData.subtotal.toFixed(2)}
        ${orderData.shipping > 0 ? `Shipping: $${orderData.shipping.toFixed(2)}\n` : ''}
        ${orderData.tax > 0 ? `Tax: $${orderData.tax.toFixed(2)}\n` : ''}
        ${orderData.discount > 0 ? `Discount: -$${orderData.discount.toFixed(2)}\n` : ''}
        Total: $${orderData.total.toFixed(2)}
        
        Shipping Address:
        ${orderData.shippingAddress.street}
        ${orderData.shippingAddress.city}, ${orderData.shippingAddress.state} ${orderData.shippingAddress.zipCode}
        ${orderData.shippingAddress.country}
        
        View orders dashboard: ${adminOrderUrl}
      `,
    };

    await this.sendEmail(mailOptions);
  }

  async sendOrderCancellationNotificationToAdmin(
    adminEmail: string,
    orderData: {
      orderNumber: string;
      customerName: string;
      customerEmail: string;
      previousStatus: string;
      cancellationReason?: string;
      paymentStatus: string;
      paymentMethod?: string;
      items: Array<{ name: string; quantity: number; price: number; total: number }>;
      subtotal: number;
      shipping: number;
      tax: number;
      discount: number;
      total: number;
      shippingAddress: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
      };
      orderDate: Date;
      cancelledAt: Date;
    },
  ): Promise<void> {
    const emailFrom = this.configService.get<string>('EMAIL_FROM') || 'noreply@ecommerce.com';
    const apiUrl = this.configService.get<string>('API_URL') || 'http://localhost:8000';
    const adminOrderUrl = `${apiUrl}/api/v1/admin/orders`;

    const itemsHtml = orderData.items
      .map(
        (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.total.toFixed(2)}</td>
      </tr>
    `,
      )
      .join('');

    const orderDateStr = new Date(orderData.orderDate).toLocaleString();
    const cancelledDateStr = new Date(orderData.cancelledAt).toLocaleString();
    const logoUrl = this.getLogoUrl();

    const mailOptions = {
      from: emailFrom,
      to: adminEmail,
      subject: `⚠️ Order Cancelled - ${orderData.orderNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Cancellation Notification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            ${this.getEmailHeader(logoUrl)}
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; border-left: 4px solid ${this.PRIMARY_COLOR}; margin-bottom: 20px;">
              <h1 style="color: ${this.PRIMARY_COLOR}; margin-top: 0;">⚠️ Order Cancelled</h1>
            <p style="font-size: 16px; font-weight: bold; color: #856404;">An order has been cancelled and requires your attention.</p>
          </div>
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ddd;">
            <h2 style="margin-top: 0; color: ${this.PRIMARY_COLOR}; border-bottom: 2px solid ${this.PRIMARY_COLOR}; padding-bottom: 10px;">Order Information</h2>
            <table style="width: 100%; margin: 15px 0;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 40%;">Order Number:</td>
                <td style="padding: 8px 0;">${orderData.orderNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Order Date:</td>
                <td style="padding: 8px 0;">${orderDateStr}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Cancelled At:</td>
                <td style="padding: 8px 0; color: #dc3545; font-weight: bold;">${cancelledDateStr}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Previous Status:</td>
                <td style="padding: 8px 0; text-transform: capitalize;">${orderData.previousStatus}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Payment Status:</td>
                <td style="padding: 8px 0; text-transform: capitalize; color: ${orderData.paymentStatus === 'paid' ? '#dc3545' : '#666'};">
                  ${orderData.paymentStatus} ${orderData.paymentStatus === 'paid' ? '⚠️ (Refund may be required)' : ''}
                </td>
              </tr>
              ${orderData.paymentMethod ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Payment Method:</td>
                <td style="padding: 8px 0;">${orderData.paymentMethod}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ddd;">
            <h2 style="margin-top: 0; color: ${this.PRIMARY_COLOR}; border-bottom: 2px solid ${this.PRIMARY_COLOR}; padding-bottom: 10px;">Customer Information</h2>
            <p style="margin: 5px 0;"><strong>Name:</strong> ${orderData.customerName}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:${orderData.customerEmail}" style="color: ${this.PRIMARY_COLOR};">${orderData.customerEmail}</a></p>
          </div>
          ${orderData.cancellationReason ? `
          <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${this.PRIMARY_COLOR};">
            <h3 style="margin-top: 0; color: #721c24;">Cancellation Reason</h3>
            <p style="margin: 0; color: #721c24; font-style: italic;">"${orderData.cancellationReason}"</p>
          </div>
          ` : ''}
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ddd;">
            <h2 style="margin-top: 0; color: ${this.PRIMARY_COLOR}; border-bottom: 2px solid ${this.PRIMARY_COLOR}; padding-bottom: 10px;">Order Details</h2>
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
              <thead>
                <tr style="background-color: #f8f9fa;">
                  <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
                  <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
                  <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
                  <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            <div style="margin-top: 20px; padding-top: 15px; border-top: 2px solid #ddd;">
              <p style="text-align: right; margin: 5px 0;"><strong>Subtotal:</strong> $${orderData.subtotal.toFixed(2)}</p>
              ${orderData.shipping > 0 ? `<p style="text-align: right; margin: 5px 0;"><strong>Shipping:</strong> $${orderData.shipping.toFixed(2)}</p>` : ''}
              ${orderData.tax > 0 ? `<p style="text-align: right; margin: 5px 0;"><strong>Tax:</strong> $${orderData.tax.toFixed(2)}</p>` : ''}
              ${orderData.discount > 0 ? `<p style="text-align: right; margin: 5px 0; color: #28a745;"><strong>Discount:</strong> -$${orderData.discount.toFixed(2)}</p>` : ''}
              <p style="text-align: right; margin: 15px 0; font-size: 18px; font-weight: bold; border-top: 2px solid #ddd; padding-top: 10px; color: #dc3545;">
                <strong>Total: $${orderData.total.toFixed(2)}</strong>
              </p>
            </div>
            <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
              <h3 style="margin-top: 0;">Shipping Address</h3>
              <p style="margin: 5px 0;">${orderData.shippingAddress.street}</p>
              <p style="margin: 5px 0;">${orderData.shippingAddress.city}, ${orderData.shippingAddress.state} ${orderData.shippingAddress.zipCode}</p>
              <p style="margin: 5px 0;">${orderData.shippingAddress.country}</p>
            </div>
          </div>
          ${orderData.paymentStatus === 'paid' ? `
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <h3 style="margin-top: 0; color: #856404;">⚠️ Action Required</h3>
            <p style="margin: 5px 0; color: #856404;">
              This order was paid. You may need to process a refund for the customer.
            </p>
          </div>
          ` : ''}
          <div style="text-align: center; margin: 30px 0;">
            <a href="${adminOrderUrl}" style="background-color: ${this.SECONDARY_COLOR}; color: ${this.SECONDARY_FOREGROUND}; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Orders Dashboard</a>
          </div>
          </div>
        </body>
        </html>
      `,
      text: `
        ⚠️ Order Cancelled
        
        An order has been cancelled and requires your attention.
        
        Order Information:
        Order Number: ${orderData.orderNumber}
        Order Date: ${orderDateStr}
        Cancelled At: ${cancelledDateStr}
        Previous Status: ${orderData.previousStatus}
        Payment Status: ${orderData.paymentStatus} ${orderData.paymentStatus === 'paid' ? '(Refund may be required)' : ''}
        ${orderData.paymentMethod ? `Payment Method: ${orderData.paymentMethod}\n` : ''}
        
        Customer Information:
        Name: ${orderData.customerName}
        Email: ${orderData.customerEmail}
        
        ${orderData.cancellationReason ? `Cancellation Reason: "${orderData.cancellationReason}"\n` : ''}
        
        Order Details:
        ${orderData.items.map((item) => `${item.name} - Qty: ${item.quantity} - Price: $${item.price.toFixed(2)} - Total: $${item.total.toFixed(2)}`).join('\n')}
        
        Subtotal: $${orderData.subtotal.toFixed(2)}
        ${orderData.shipping > 0 ? `Shipping: $${orderData.shipping.toFixed(2)}\n` : ''}
        ${orderData.tax > 0 ? `Tax: $${orderData.tax.toFixed(2)}\n` : ''}
        ${orderData.discount > 0 ? `Discount: -$${orderData.discount.toFixed(2)}\n` : ''}
        Total: $${orderData.total.toFixed(2)}
        
        Shipping Address:
        ${orderData.shippingAddress.street}
        ${orderData.shippingAddress.city}, ${orderData.shippingAddress.state} ${orderData.shippingAddress.zipCode}
        ${orderData.shippingAddress.country}
        
        ${orderData.paymentStatus === 'paid' ? '\n⚠️ Action Required: This order was paid. You may need to process a refund for the customer.\n' : ''}
        
        View orders dashboard: ${adminOrderUrl}
      `,
    };

    await this.sendEmail(mailOptions);
  }

  async sendContactFormNotificationToAdmin(
    adminEmail: string,
    contactData: {
      name: string;
      email: string;
      phone: string;
      subject: string;
      message: string;
      contactId: string;
      createdAt: Date;
    },
  ): Promise<void> {
    const emailFrom = this.configService.get<string>('EMAIL_FROM') || 'noreply@ecommerce.com';
    const apiUrl = this.configService.get<string>('API_URL') || 'http://localhost:8000';
    const adminContactUrl = `${apiUrl}/api/v1/admin/contacts`;
    const logoUrl = this.getLogoUrl();

    const mailOptions = {
      from: emailFrom,
      to: adminEmail,
      subject: `New Contact Form Submission - ${contactData.subject}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Contact Form Submission</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            ${this.getEmailHeader(logoUrl)}
            <h1 style="color: ${this.PRIMARY_COLOR}; margin-top: 0;">New Contact Form Submission</h1>
            <p>A new contact form has been submitted and requires your attention.</p>
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h2 style="margin-top: 0; color: #333;">Contact Information</h2>
              <table style="width: 100%; margin: 15px 0;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; width: 30%;">Name:</td>
                  <td style="padding: 8px 0;">${contactData.name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Email:</td>
                  <td style="padding: 8px 0;"><a href="mailto:${contactData.email}" style="color: ${this.PRIMARY_COLOR};">${contactData.email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Phone:</td>
                  <td style="padding: 8px 0;"><a href="tel:${contactData.phone}" style="color: ${this.PRIMARY_COLOR};">${contactData.phone}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Subject:</td>
                  <td style="padding: 8px 0;"><strong>${contactData.subject}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Submitted:</td>
                  <td style="padding: 8px 0;">${new Date(contactData.createdAt).toLocaleString()}</td>
                </tr>
              </table>
              <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
                <h3 style="margin-top: 0;">Message:</h3>
                <p style="margin: 0; white-space: pre-wrap;">${contactData.message}</p>
              </div>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${adminContactUrl}" style="background-color: ${this.SECONDARY_COLOR}; color: ${this.SECONDARY_FOREGROUND}; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Contact Submissions</a>
            </div>
            <p style="font-size: 12px; color: #666; margin-top: 30px;">
              Contact ID: ${contactData.contactId}
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        New Contact Form Submission
        
        A new contact form has been submitted and requires your attention.
        
        Contact Information:
        Name: ${contactData.name}
        Email: ${contactData.email}
        Phone: ${contactData.phone}
        Subject: ${contactData.subject}
        Submitted: ${new Date(contactData.createdAt).toLocaleString()}
        
        Message:
        ${contactData.message}
        
        Contact ID: ${contactData.contactId}
        
        View contact submissions: ${adminContactUrl}
      `,
    };

    await this.sendEmail(mailOptions);
  }

  async sendContactFormAutoReply(
    userEmail: string,
    contactData: {
      name: string;
      subject: string;
    },
  ): Promise<void> {
    const emailFrom = this.configService.get<string>('EMAIL_FROM') || 'noreply@ecommerce.com';
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const logoUrl = this.getLogoUrl();

    const mailOptions = {
      from: emailFrom,
      to: userEmail,
      subject: 'Thank You for Contacting Us',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Thank You for Contacting Us</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            ${this.getEmailHeader(logoUrl)}
            <h1 style="color: ${this.PRIMARY_COLOR}; margin-top: 0;">Thank You for Contacting Us!</h1>
            <p>Dear ${contactData.name},</p>
            <p>We have received your message regarding "<strong>${contactData.subject}</strong>" and appreciate you taking the time to reach out to us.</p>
            <p>Our team will review your inquiry and get back to you as soon as possible, typically within 24-48 hours during business days.</p>
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0;">What happens next?</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li>We'll review your message carefully</li>
                <li>Our team will prepare a detailed response</li>
                <li>You'll receive a reply at this email address</li>
              </ul>
            </div>
            <p>If you have any urgent questions, please feel free to contact us directly.</p>
            <p style="font-size: 12px; color: #666; margin-top: 30px;">
              This is an automated confirmation. Please do not reply to this email.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        Thank You for Contacting Us!
        
        Dear ${contactData.name},
        
        We have received your message regarding "${contactData.subject}" and appreciate you taking the time to reach out to us.
        
        Our team will review your inquiry and get back to you as soon as possible, typically within 24-48 hours during business days.
        
        What happens next?
        - We'll review your message carefully
        - Our team will prepare a detailed response
        - You'll receive a reply at this email address
        
        If you have any urgent questions, please feel free to contact us directly.
        
        This is an automated confirmation. Please do not reply to this email.
      `,
    };

    await this.sendEmail(mailOptions);
  }

  private getLogoUrl(): string {
    const logoUrl = process.env.LOGO_URL;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return logoUrl || `${frontendUrl}/logo.png`;
  }

  private getEmailHeader(logoUrl?: string): string {
    const logo = logoUrl || this.getLogoUrl();
    return `
      <div style="text-align: center; margin-bottom: 30px; padding: 20px 0; border-bottom: 2px solid ${this.PRIMARY_COLOR};">
        <img src="${logo}" alt="Logo" style="max-width: 200px; height: auto;" />
      </div>
    `;
  }

  getSmtpStatus(): {
    configured: boolean;
    host?: string;
    port?: number;
    user?: string;
    hasPassword: boolean;
  } {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<string>('SMTP_PORT');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    return {
      configured: !!(smtpHost && smtpPort && smtpUser && smtpPass && this.transporter),
      host: smtpHost,
      port: smtpPort ? parseInt(smtpPort, 10) : undefined,
      user: smtpUser,
      hasPassword: !!smtpPass,
    };
  }

  private async sendEmail(mailOptions: nodemailer.SendMailOptions): Promise<void> {
    console.log('\n=== ATTEMPTING TO SEND EMAIL ===');
    console.log('To:', mailOptions.to);
    console.log('Subject:', mailOptions.subject);
    
    if (!this.transporter) {
      const warnMsg = `Email not sent to ${mailOptions.to}. SMTP not configured. Email would have been: ${mailOptions.subject}`;
      this.logger.warn(warnMsg);
      console.error('❌ EMAIL NOT SENT:', warnMsg);
      console.log('===================================\n');
      return;
    }

    try {
      console.log('Sending email via SMTP...');
      const info = await this.transporter.sendMail(mailOptions);
      const successMsg = `Email sent successfully to ${mailOptions.to}. MessageId: ${info.messageId}`;
      this.logger.log(successMsg);
      console.log('✅', successMsg);
      console.log('===================================\n');
    } catch (error) {
      const errorMsg = `Failed to send email to ${mailOptions.to}`;
      this.logger.error(errorMsg, error);
      console.error('❌ EMAIL SEND FAILED:', errorMsg);
      console.error('Error:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('Stack:', error.stack);
      }
      console.log('===================================\n');
      throw error;
    }
  }
}

