import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

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
            <h1 style="color: #007bff; margin-top: 0;">Welcome to Our E-commerce Platform!</h1>
            <p>Thank you for registering with us. To complete your registration, please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Verify Email Address</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #007bff;">${verificationUrl}</p>
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
            <h1 style="color: #dc3545; margin-top: 0;">Password Reset Request</h1>
            <p>You requested to reset your password. Click the button below to reset it:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #dc3545;">${resetUrl}</p>
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

