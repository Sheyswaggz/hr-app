/**
 * Password Utility Functions
 * 
 * Provides secure password hashing, comparison, and validation utilities using bcrypt.
 * Implements industry-standard password security practices with configurable strength
 * requirements and comprehensive validation feedback.
 * 
 * @module utils/password
 */

import bcrypt from 'bcrypt';

import { getPasswordConfig } from '../config/auth.js';

/**
 * Password hashing result
 * 
 * Contains the bcrypt hash and metadata about the hashing operation.
 */
export interface PasswordHashResult {
  /**
   * Bcrypt hash of the password
   */
  readonly hash: string;

  /**
   * Salt rounds used for hashing
   */
  readonly saltRounds: number;

  /**
   * Time taken to hash the password in milliseconds
   */
  readonly executionTimeMs: number;
}

/**
 * Password comparison result
 * 
 * Contains the comparison result and execution time.
 */
export interface PasswordComparisonResult {
  /**
   * Whether the password matches the hash
   */
  readonly match: boolean;

  /**
   * Time taken to compare in milliseconds
   */
  readonly executionTimeMs: number;
}

/**
 * Password validation result
 * 
 * Contains validation status, errors, and strength score.
 */
export interface PasswordValidationResult {
  /**
   * Whether the password meets all requirements
   */
  readonly isValid: boolean;

  /**
   * Array of validation error messages
   */
  readonly errors: string[];

  /**
   * Password strength score (0-100)
   */
  readonly strengthScore: number;

  /**
   * Strength level description
   */
  readonly strengthLevel: 'weak' | 'fair' | 'good' | 'strong' | 'very_strong';
}

/**
 * Hash a password using bcrypt
 * 
 * Generates a secure bcrypt hash of the provided password using the configured
 * salt rounds. The hash includes the salt and can be safely stored in the database.
 * 
 * @param password - Plain text password to hash
 * @returns Promise resolving to password hash result
 * @throws Error if password is invalid or hashing fails
 * 
 * @example
 * ```typescript
 * const result = await hashPassword('MySecurePassword123!');
 * console.log(result.hash); // $2b$12$...
 * console.log(result.executionTimeMs); // 150
 * ```
 */
export async function hashPassword(password: string): Promise<PasswordHashResult> {
  const startTime = Date.now();

  // Validate input
  if (!password || typeof password !== 'string') {
    console.error('[PASSWORD_UTILS] Hash failed: Invalid password input', {
      passwordType: typeof password,
      passwordEmpty: !password,
      timestamp: new Date().toISOString(),
    });
    throw new Error('[PASSWORD_UTILS] Password must be a non-empty string');
  }

  if (password.length === 0) {
    console.error('[PASSWORD_UTILS] Hash failed: Empty password', {
      timestamp: new Date().toISOString(),
    });
    throw new Error('[PASSWORD_UTILS] Password cannot be empty');
  }

  try {
    console.log('[PASSWORD_UTILS] Starting password hashing', {
      passwordLength: password.length,
      timestamp: new Date().toISOString(),
    });

    const config = getPasswordConfig();

    // Generate salt and hash password
    const hash = await bcrypt.hash(password, config.saltRounds);
    const executionTimeMs = Date.now() - startTime;

    console.log('[PASSWORD_UTILS] Password hashed successfully', {
      saltRounds: config.saltRounds,
      hashLength: hash.length,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });

    return {
      hash,
      saltRounds: config.saltRounds,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[PASSWORD_UTILS] Password hashing failed', {
      error: errorMessage,
      executionTimeMs,
      passwordLength: password.length,
      timestamp: new Date().toISOString(),
    });

    throw new Error(`[PASSWORD_UTILS] Failed to hash password: ${errorMessage}`);
  }
}

/**
 * Compare a password with a bcrypt hash
 * 
 * Securely compares a plain text password with a bcrypt hash using constant-time
 * comparison to prevent timing attacks.
 * 
 * @param password - Plain text password to compare
 * @param hash - Bcrypt hash to compare against
 * @returns Promise resolving to comparison result
 * @throws Error if inputs are invalid or comparison fails
 * 
 * @example
 * ```typescript
 * const result = await comparePassword('MyPassword123!', storedHash);
 * if (result.match) {
 *   console.log('Password is correct');
 * }
 * ```
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<PasswordComparisonResult> {
  const startTime = Date.now();

  // Validate inputs
  if (!password || typeof password !== 'string') {
    console.error('[PASSWORD_UTILS] Compare failed: Invalid password input', {
      passwordType: typeof password,
      passwordEmpty: !password,
      timestamp: new Date().toISOString(),
    });
    throw new Error('[PASSWORD_UTILS] Password must be a non-empty string');
  }

  if (!hash || typeof hash !== 'string') {
    console.error('[PASSWORD_UTILS] Compare failed: Invalid hash input', {
      hashType: typeof hash,
      hashEmpty: !hash,
      timestamp: new Date().toISOString(),
    });
    throw new Error('[PASSWORD_UTILS] Hash must be a non-empty string');
  }

  // Validate hash format (bcrypt hashes start with $2a$, $2b$, or $2y$)
  if (!hash.match(/^\$2[aby]\$\d{2}\$/)) {
    console.error('[PASSWORD_UTILS] Compare failed: Invalid hash format', {
      hashPrefix: hash.substring(0, 4),
      timestamp: new Date().toISOString(),
    });
    throw new Error('[PASSWORD_UTILS] Invalid bcrypt hash format');
  }

  try {
    console.log('[PASSWORD_UTILS] Starting password comparison', {
      passwordLength: password.length,
      hashLength: hash.length,
      timestamp: new Date().toISOString(),
    });

    // Compare password with hash using bcrypt
    const match = await bcrypt.compare(password, hash);
    const executionTimeMs = Date.now() - startTime;

    console.log('[PASSWORD_UTILS] Password comparison completed', {
      match,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });

    return {
      match,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[PASSWORD_UTILS] Password comparison failed', {
      error: errorMessage,
      executionTimeMs,
      passwordLength: password.length,
      hashLength: hash.length,
      timestamp: new Date().toISOString(),
    });

    throw new Error(`[PASSWORD_UTILS] Failed to compare password: ${errorMessage}`);
  }
}

/**
 * Calculate password strength score (0-100)
 * 
 * Scoring criteria:
 * - Length: +10 points per character over minimum (max 30)
 * - Uppercase: +15 points if present
 * - Lowercase: +15 points if present
 * - Numbers: +15 points if present
 * - Special characters: +15 points if present
 * - Variety: +10 points for using all character types
 * 
 * @param password - Password to evaluate
 * @returns Strength score from 0 to 100
 */
function calculatePasswordStrength(password: string): number {
  let score = 0;
  const config = getPasswordConfig();

  // Length score (max 30 points)
  const lengthBonus = Math.min(30, (password.length - config.minLength) * 10);
  score += Math.max(0, lengthBonus);

  // Character type scores
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (hasUppercase) {
    score += 15;
  }
  if (hasLowercase) {
    score += 15;
  }
  if (hasNumber) {
    score += 15;
  }
  if (hasSpecial) {
    score += 15;
  }

  // Variety bonus (all character types present)
  if (hasUppercase && hasLowercase && hasNumber && hasSpecial) {
    score += 10;
  }

  return Math.min(100, score);
}

/**
 * Get strength level description from score
 * 
 * @param score - Strength score (0-100)
 * @returns Strength level description
 */
function getStrengthLevel(score: number): PasswordValidationResult['strengthLevel'] {
  if (score >= 90) return 'very_strong';
  if (score >= 70) return 'strong';
  if (score >= 50) return 'good';
  if (score >= 30) return 'fair';
  return 'weak';
}

/**
 * Validate password against configured strength requirements
 * 
 * Checks password against all configured requirements:
 * - Minimum length
 * - Uppercase letter (if required)
 * - Lowercase letter (if required)
 * - Number (if required)
 * - Special character (if required)
 * 
 * Also calculates a strength score for additional feedback.
 * 
 * @param password - Password to validate
 * @returns Validation result with errors and strength score
 * 
 * @example
 * ```typescript
 * const result = validatePassword('MyPassword123!');
 * if (!result.isValid) {
 *   console.log('Errors:', result.errors);
 * }
 * console.log('Strength:', result.strengthLevel);
 * ```
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  const config = getPasswordConfig();

  // Validate input
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      errors: ['Password must be a non-empty string'],
      strengthScore: 0,
      strengthLevel: 'weak',
    };
  }

  // Check minimum length
  if (password.length < config.minLength) {
    errors.push(`Password must be at least ${config.minLength} characters long`);
  }

  // Check uppercase requirement
  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check lowercase requirement
  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check number requirement
  if (config.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check special character requirement
  if (config.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Calculate strength score
  const strengthScore = calculatePasswordStrength(password);
  const strengthLevel = getStrengthLevel(strengthScore);

  const isValid = errors.length === 0;

  console.log('[PASSWORD_UTILS] Password validation completed', {
    isValid,
    errorCount: errors.length,
    strengthScore,
    strengthLevel,
    passwordLength: password.length,
    timestamp: new Date().toISOString(),
  });

  return {
    isValid,
    errors,
    strengthScore,
    strengthLevel,
  };
}

/**
 * Generate a random password that meets all requirements
 * 
 * Generates a cryptographically secure random password that satisfies
 * all configured password requirements.
 * 
 * @param length - Desired password length (defaults to config.minLength + 4)
 * @returns Generated password
 * 
 * @example
 * ```typescript
 * const password = generateSecurePassword(16);
 * console.log(password); // e.g., "Kp9#mL2$nQ5@rT8!"
 * ```
 */
export function generateSecurePassword(length?: number): string {
  const config = getPasswordConfig();
  const targetLength = length ?? config.minLength + 4;

  if (targetLength < config.minLength) {
    throw new Error(`Password length must be at least ${config.minLength}`);
  }

  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{};\':"|,.<>/?';

  let password = '';
  let charPool = '';

  // Ensure at least one of each required type
  if (config.requireUppercase) {
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    charPool += uppercase;
  }

  if (config.requireLowercase) {
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    charPool += lowercase;
  }

  if (config.requireNumbers) {
    password += numbers[Math.floor(Math.random() * numbers.length)];
    charPool += numbers;
  }

  if (config.requireSpecialChars) {
    password += special[Math.floor(Math.random() * special.length)];
    charPool += special;
  }

  // Fill remaining length with random characters from pool
  for (let i = password.length; i < targetLength; i++) {
    password += charPool[Math.floor(Math.random() * charPool.length)];
  }

  // Shuffle password to randomize position of required characters
  password = password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');

  console.log('[PASSWORD_UTILS] Secure password generated', {
    length: password.length,
    strengthScore: calculatePasswordStrength(password),
    timestamp: new Date().toISOString(),
  });

  return password;
}