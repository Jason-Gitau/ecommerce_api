import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    const frontendUrl = process.env.FRONTEND_URL;
    const env = process.env.NODE_ENV;
    this.logger.log(`EmailService init — NODE_ENV=${env}`);
    this.logger.log(`RESEND_API_KEY=${apiKey ? `set (starts: ${apiKey.slice(0, 8)}...)` : 'MISSING'}`);
    this.logger.log(`EMAIL_FROM=${from ?? 'MISSING (will use default)'}`);
    this.logger.log(`FRONTEND_URL=${frontendUrl ?? 'MISSING (will use http://localhost:5173)'}`);
  }

  private get isDev() {
    return process.env.NODE_ENV !== 'production';
  }

  private logDevEmail(to: string, subject: string, link: string) {
    this.logger.warn('═══════════════════════════════════════════');
    this.logger.warn('  DEV MODE — email not sent via Resend');
    this.logger.warn(`  To:      ${to}`);
    this.logger.warn(`  Subject: ${subject}`);
    this.logger.warn(`  Link:    ${link}`);
    this.logger.warn('═══════════════════════════════════════════');
  }

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
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/verify-email?token=${token}`;

    if (this.isDev) {
      this.logDevEmail(email, 'Verify your email address', link);
      return;
    }

    const client = this.getResendClient();
    if (!client) return;

    try {
      const from = process.env.EMAIL_FROM || 'E-Commerce API <onboarding@resend.dev>';
      const { data, error } = await client.emails.send({
        from,
        to: [email],
        subject: 'Verify your email address',
        html: `<p>Click <a href="${link}">here</a> to verify your email. Link expires in 1 hour.</p>`,
      });
      if (error) {
        this.logger.error(`Resend rejected verification email: ${JSON.stringify(error)}`);
        return;
      }
      this.logger.log(`Verification email sent to ${email} (id: ${data?.id})`);
    } catch (error) {
      this.logger.error(`Failed to send verification email: ${error.message}`);
    }
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/reset-password?token=${token}`;

    if (this.isDev) {
      this.logDevEmail(email, 'Reset your password', link);
      return;
    }

    const client = this.getResendClient();
    if (!client) return;

    try {
      const from = process.env.EMAIL_FROM || 'E-Commerce API <onboarding@resend.dev>';
      const { data, error } = await client.emails.send({
        from,
        to: [email],
        subject: 'Reset your password',
        html: `<p>Click <a href="${link}">here</a> to reset your password. Link expires in 1 hour.</p>`,
      });
      if (error) {
        this.logger.error(`Resend rejected reset email: ${JSON.stringify(error)}`);
        return;
      }
      this.logger.log(`Password reset email sent to ${email} (id: ${data?.id})`);
    } catch (error) {
      this.logger.error(`Failed to send reset email: ${error.message}`);
    }
  }
}
