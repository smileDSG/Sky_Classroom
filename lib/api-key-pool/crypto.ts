/**
 * API Key Pool — AES-256-GCM Encryption
 *
 * Encrypts API keys before DB storage. The secret comes from
 * env var API_KEY_POOL_SECRET (64-char hex = 32 bytes).
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getSecret(): Buffer {
  const hex = process.env.API_KEY_POOL_SECRET;
  if (!hex || hex.length !== 64) {
    throw new Error('API_KEY_POOL_SECRET must be a 64-char hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

/** Encrypt plaintext → "iv:tag:ciphertext" (all hex-encoded) */
export function encrypt(plain: string): string {
  const key = getSecret();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plain, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/** Decrypt "iv:tag:ciphertext" → plaintext */
export function decrypt(encoded: string): string {
  const key = getSecret();
  const parts = encoded.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/** Mask an API key for display: show first 4 and last 4 chars */
export function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}${'*'.repeat(key.length - 8)}${key.slice(-4)}`;
}
