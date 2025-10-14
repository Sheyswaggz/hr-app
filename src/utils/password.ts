import { type PasswordValidationResult } from '../types/auth.js';
import { getPasswordPolicyConfig } from '../config/auth.js';
import bcrypt from 'bcrypt';

export async function hashPassword(password: string): Promise<string> {
  const config = getPasswordPolicyConfig();
  return bcrypt.hash(password, config.saltRounds);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePassword(password: string): PasswordValidationResult {
  const config = getPasswordPolicyConfig();
  const errors: string[] = [];

  if (password.length < config.minLength) {
    errors.push(`Password must be at least ${config.minLength} characters`);
  }

  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (config.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (config.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}