/**
 * Password hashing utilities.
 * Uses bcryptjs (pure JS, works in serverless/edge).
 */

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/** Hash a plaintext password */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Verify a plaintext password against a hash */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
