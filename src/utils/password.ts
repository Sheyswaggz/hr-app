/**
 * Password Utility Module
 * 
 * Provides secure password hashing, comparison, and validation functionality.
 * Uses bcrypt for password hashing with configurable salt rounds.
 * Implements comprehensive password strength validation.
 * 
 * @module utils/password
 */

import bcrypt from 'bcrypt';
import { getPasswordConfig } from '../config/auth.js';

/**
 * Hash a password using bcrypt
 * 
 * @param password - Plain text password to hash
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const config = getPasswordConfig();
  return bcrypt.hash(password, config.saltRounds);
}

/**
 * Compare a plain text password with a hashed password
 * 
 * @param password - Plain text password
 * @param hash - Hashed password to compare against
 * @returns True if passwords match, false otherwise
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Password validation result interface
 */
export interface PasswordValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly strengthScore: number;
}

/**
 * Calculate password strength score (0-5)
 * 
 * @param password - Password to evaluate
 * @returns Strength score from 0 (very weak) to 5 (very strong)
 */
function calculatePasswordStrength(password: string): number {
  let score = 0;

  // Length scoring
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;

  // Character variety scoring
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;

  // Cap at 5
  return Math.min(score, 5);
}

/**
 * Validate password against configured requirements
 * 
 * @param password - Password to validate
 * @returns Validation result with errors if any
 */
export function validatePassword(password: string): PasswordValidationResult {
  const config = getPasswordConfig();
  const errors: string[] = [];

  if (password.length < config.minLength) {
    errors.push(`Password must be at least ${config.minLength} characters long`);
  }

  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (config.requireNumber && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (
    config.requireSpecialChar &&
    !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  ) {
    errors.push('Password must contain at least one special character');
  }

  const strengthScore = calculatePasswordStrength(password);

  return {
    isValid: errors.length === 0,
    errors,
    strengthScore,
  };
}