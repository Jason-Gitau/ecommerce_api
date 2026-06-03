import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;

  private getResendClient() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY is not set. Email sending is disabled.');
      return null;
    }

    if (!this.resend) {
      this.resend = new Resend(apiKey);
    }

    return this.resend;
  }

  async sendVerificationEmail(email: string, token: string) {
    const client = this.getResendClient();
    if (!client) return;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const link = `${frontendUrl}/verify-email?token=${token}`;
    try {
      await client.emails.send({
        from: 'E-Commerce API <onboarding@resend.dev>',
        to: [email],
        subject: 'Verify your email address',
        html: `<p>Click <a href="${link}">here</a> to verify your email. Link expires in 1 hour.</p>`,
      });
      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email: ${error.message}`);
      // In prod: push to error tracking (Sentry) or retry queue
    }
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const client = this.getResendClient();
    if (!client) return;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const link = `${frontendUrl}/reset-password?token=${token}`;
    try {
      await client.emails.send({
        from: 'E-Commerce API <onboarding@resend.dev>',
        to: [email],
        subject: 'Reset your password',
        html: `<p>Click <a href="${link}">here</a> to reset your password. Link expires in 1 hour.</p>`,
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send reset email: ${error.message}`);
    }
  }
}
