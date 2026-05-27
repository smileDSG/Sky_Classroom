/**
 * Email service using Resend.
 *
 * Requires RESEND_API_KEY env var.
 * Falls back to console logging if key is not set.
 */

import { Resend } from 'resend';
import { createLogger } from '@/lib/logger';

const log = createLogger('Email');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || 'Sky Classroom <noreply@skyclassroom.com>';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    log.warn('RESEND_API_KEY not set, email not sent. Content:');
    log.warn(`To: ${to} | Subject: ${subject}`);
    log.warn(html);
    return;
  }

  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
    log.info(`Email sent to ${to}: ${subject}`);
  } catch (err) {
    log.error('Failed to send email:', err);
    throw err;
  }
}

/** Send email verification link */
export async function sendVerificationEmail(to: string, token: string) {
  const verifyUrl = `${BASE_URL}/auth/verify-email?token=${token}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #7c3aed;">Verify your email</h2>
      <p>Thanks for signing up for Sky Classroom! Please verify your email address by clicking the button below:</p>
      <a href="${verifyUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">
        Verify Email
      </a>
      <p style="color: #666; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
      <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
    </div>
  `;
  await sendEmail(to, 'Verify your Sky Classroom email', html);
}

/** Send password reset link */
export async function sendPasswordResetEmail(to: string, token: string) {
  const resetUrl = `${BASE_URL}/auth/reset-password?token=${token}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #7c3aed;">Reset your password</h2>
      <p>You requested a password reset for your Sky Classroom account. Click the button below to set a new password:</p>
      <a href="${resetUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">
        Reset Password
      </a>
      <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
      <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
    </div>
  `;
  await sendEmail(to, 'Reset your Sky Classroom password', html);
}
