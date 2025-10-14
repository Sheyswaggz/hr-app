/**
 * Password Utility Module
 * 
 * Provides secure password hashing, comparison, and validation utilities using bcrypt.
 * Implements password strength validation according to configurable security requirements.
 * 
 * @module utils/password
 */

import bcrypt from 'bcrypt';

import { getAuthConfig } from '../config/auth.js';

/**
 * Password validation result interface
 */
export interface PasswordValidationResult {
  /**
   * Whether the password meets all requirements
   */
  readonly isValid: boolean;

  /**
   * Array of validation errors (empty if valid)
   */
  readonly errors: string[];

  /**
   * Password strength score (0-100)
   */
  readonly strength: number;
}

/**
 * Password hashing result interface
 */
export interface PasswordHashResult {
  /**
   * Whether hashing was successful
   */
  readonly success: boolean;

  /**
   * Hashed password (undefined if failed)
   */
  readonly hash?: string;

  /**
   * Error message (undefined if successful)
   */
  readonly error?: string;

  /**
   * Time taken to hash in milliseconds
   */
  readonly executionTimeMs: number;
}

/**
 * Password comparison result interface
 */
export interface PasswordComparisonResult {
  /**
   * Whether passwords match
   */
  readonly isMatch: boolean;

  /**
   * Whether comparison was successful (false indicates error)
   */
  readonly success: boolean;

  /**
   * Error message (undefined if successful)
   */
  readonly error?: string;

  /**
   * Time taken to compare in milliseconds
   */
  readonly executionTimeMs: number;
}

/**
 * Hash a password using bcrypt
 * 
 * @param {string} password - Plain text password to hash
 * @returns {Promise<PasswordHashResult>} Hashing result with hash or error
 * 
 * @example
 * const result = await hashPassword('MySecureP@ssw0rd');
 * if (result.success) {
 *   console.log('Hash:', result.hash);
 * } else {
 *   console.error('Error:', result.error);
 * }
 */
export async function hashPassword(password: string): Promise<PasswordHashResult> {
  const startTime = Date.now();

  try {
    // Validate input
    if (typeof password !== 'string') {
      console.error('[PASSWORD_HASH] Invalid input type:', {
        type: typeof password,
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        error: 'Password must be a string',
        executionTimeMs: Date.now() - startTime,
      };
    }

    if (password.length === 0) {
      console.error('[PASSWORD_HASH] Empty password provided:', {
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        error: 'Password cannot be empty',
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Get salt rounds from configuration
    const config = getAuthConfig();
    const saltRounds = config.password.saltRounds;

    console.log('[PASSWORD_HASH] Starting password hashing:', {
      saltRounds,
      passwordLength: password.length,
      timestamp: new Date().toISOString(),
    });

    // Generate salt and hash password
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(password, salt);

    const executionTimeMs = Date.now() - startTime;

    console.log('[PASSWORD_HASH] Password hashed successfully:', {
      saltRounds,
      executionTimeMs,
      hashLength: hash.length,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      hash,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[PASSWORD_HASH] Password hashing failed:', {
      error: errorMessage,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      error: `Password hashing failed: ${errorMessage}`,
      executionTimeMs,
    };
  }
}

/**
 * Compare a plain text password with a hashed password
 * 
 * @param {string} password - Plain text password to compare
 * @param {string} hash - Hashed password to compare against
 * @returns {Promise<PasswordComparisonResult>} Comparison result
 * 
 * @example
 * const result = await comparePassword('MySecureP@ssw0rd', hashedPassword);
 * if (result.success && result.isMatch) {
 *   console.log('Password matches!');
 * } else if (result.success) {
 *   console.log('Password does not match');
 * } else {
 *   console.error('Comparison error:', result.error);
 * }
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<PasswordComparisonResult> {
  const startTime = Date.now();

  try {
    // Validate inputs
    if (typeof password !== 'string') {
      console.error('[PASSWORD_COMPARE] Invalid password type:', {
        type: typeof password,
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        isMatch: false,
        error: 'Password must be a string',
        executionTimeMs: Date.now() - startTime,
      };
    }

    if (typeof hash !== 'string') {
      console.error('[PASSWORD_COMPARE] Invalid hash type:', {
        type: typeof hash,
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        isMatch: false,
        error: 'Hash must be a string',
        executionTimeMs: Date.now() - startTime,
      };
    }

    if (password.length === 0) {
      console.error('[PASSWORD_COMPARE] Empty password provided:', {
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        isMatch: false,
        error: 'Password cannot be empty',
        executionTimeMs: Date.now() - startTime,
      };
    }

    if (hash.length === 0) {
      console.error('[PASSWORD_COMPARE] Empty hash provided:', {
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        isMatch: false,
        error: 'Hash cannot be empty',
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Validate hash format (bcrypt hashes start with $2a$, $2b$, or $2y$)
    if (!hash.startsWith('$2a$') && !hash.startsWith('$2b$') && !hash.startsWith('$2y$')) {
      console.error('[PASSWORD_COMPARE] Invalid hash format:', {
        hashPrefix: hash.substring(0, 4),
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        isMatch: false,
        error: 'Invalid bcrypt hash format',
        executionTimeMs: Date.now() - startTime,
      };
    }

    console.log('[PASSWORD_COMPARE] Starting password comparison:', {
      passwordLength: password.length,
      hashLength: hash.length,
      timestamp: new Date().toISOString(),
    });

    // Compare password with hash
    const isMatch = await bcrypt.compare(password, hash);

    const executionTimeMs = Date.now() - startTime;

    console.log('[PASSWORD_COMPARE] Password comparison completed:', {
      isMatch,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      isMatch,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[PASSWORD_COMPARE] Password comparison failed:', {
      error: errorMessage,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      isMatch: false,
      error: `Password comparison failed: ${errorMessage}`,
      executionTimeMs,
    };
  }
}

/**
 * Validate password strength according to configured requirements
 * 
 * @param {string} password - Password to validate
 * @returns {PasswordValidationResult} Validation result with errors and strength score
 * 
 * @example
 * const result = validatePasswordStrength('MySecureP@ssw0rd');
 * if (result.isValid) {
 *   console.log('Password is valid, strength:', result.strength);
 * } else {
 *   console.log('Validation errors:', result.errors);
 * }
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let strength = 0;

  try {
    // Validate input type
    if (typeof password !== 'string') {
      console.error('[PASSWORD_VALIDATE] Invalid input type:', {
        type: typeof password,
        timestamp: new Date().toISOString(),
      });
      return {
        isValid: false,
        errors: ['Password must be a string'],
        strength: 0,
      };
    }

    // Get password requirements from configuration
    const config = getAuthConfig();
    const requirements = config.password;

    console.log('[PASSWORD_VALIDATE] Validating password strength:', {
      passwordLength: password.length,
      requirements: {
        minLength: requirements.minLength,
        requireUppercase: requirements.requireUppercase,
        requireLowercase: requirements.requireLowercase,
        requireNumbers: requirements.requireNumbers,
        requireSpecialChars: requirements.requireSpecialChars,
      },
      timestamp: new Date().toISOString(),
    });

    // Check minimum length
    if (password.length < requirements.minLength) {
      errors.push(`Password must be at least ${requirements.minLength} characters long`);
    } else {
      strength += 20;
      // Bonus points for extra length
      if (password.length >= requirements.minLength + 4) {
        strength += 10;
      }
      if (password.length >= requirements.minLength + 8) {
        strength += 10;
      }
    }

    // Check for uppercase letters
    const hasUppercase = /[A-Z]/.test(password);
    if (requirements.requireUppercase && !hasUppercase) {
      errors.push('Password must contain at least one uppercase letter');
    } else if (hasUppercase) {
      strength += 15;
    }

    // Check for lowercase letters
    const hasLowercase = /[a-z]/.test(password);
    if (requirements.requireLowercase && !hasLowercase) {
      errors.push('Password must contain at least one lowercase letter');
    } else if (hasLowercase) {
      strength += 15;
    }

    // Check for numbers
    const hasNumbers = /\d/.test(password);
    if (requirements.requireNumbers && !hasNumbers) {
      errors.push('Password must contain at least one number');
    } else if (hasNumbers) {
      strength += 15;
    }

    // Check for special characters
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    if (requirements.requireSpecialChars && !hasSpecialChars) {
      errors.push('Password must contain at least one special character');
    } else if (hasSpecialChars) {
      strength += 15;
    }

    // Additional strength checks
    // Check for character variety
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= password.length * 0.7) {
      strength += 10; // High character variety
    }

    // Penalize common patterns
    if (/(.)\1{2,}/.test(password)) {
      strength -= 10; // Repeated characters (e.g., "aaa")
    }
    if (/^[a-zA-Z]+$/.test(password)) {
      strength -= 5; // Only letters
    }
    if (/^[0-9]+$/.test(password)) {
      strength -= 10; // Only numbers
    }
    if (/^(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password)) {
      strength -= 15; // Sequential characters
    }

    // Common weak passwords check
    const commonPasswords = [
      'password', 'password123', '12345678', 'qwerty', 'abc123',
      'monkey', '1234567890', 'letmein', 'trustno1', 'dragon',
      'baseball', 'iloveyou', 'master', 'sunshine', 'ashley',
      'bailey', 'passw0rd', 'shadow', '123123', '654321'
    ];
    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
      strength -= 20;
      errors.push('Password contains common weak patterns');
    }

    // Ensure strength is within bounds
    strength = Math.max(0, Math.min(100, strength));

    const isValid = errors.length === 0;

    console.log('[PASSWORD_VALIDATE] Password validation completed:', {
      isValid,
      errorCount: errors.length,
      strength,
      timestamp: new Date().toISOString(),
    });

    return {
      isValid,
      errors,
      strength,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[PASSWORD_VALIDATE] Password validation failed:', {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    return {
      isValid: false,
      errors: [`Validation error: ${errorMessage}`],
      strength: 0,
    };
  }
}

/**
 * Validate password and return detailed feedback
 * 
 * @param {string} password - Password to validate
 * @returns {PasswordValidationResult & { feedback: string[] }} Validation result with user-friendly feedback
 * 
 * @example
 * const result = validatePasswordWithFeedback('weak');
 * console.log('Feedback:', result.feedback);
 */
export function validatePasswordWithFeedback(
  password: string
): PasswordValidationResult & { feedback: string[] } {
  const result = validatePasswordStrength(password);
  const feedback: string[] = [];

  if (result.isValid) {
    if (result.strength >= 80) {
      feedback.push('Excellent password strength!');
    } else if (result.strength >= 60) {
      feedback.push('Good password strength');
    } else {
      feedback.push('Acceptable password strength');
    }
  } else {
    feedback.push('Password does not meet security requirements:');
    feedback.push(...result.errors);
  }

  // Add strength-based suggestions
  if (result.strength < 60) {
    feedback.push('Consider making your password longer and more complex');
  }

  return {
    ...result,
    feedback,
  };
}

/**
 * Check if a password hash needs rehashing (e.g., due to updated salt rounds)
 * 
 * @param {string} hash - Password hash to check
 * @returns {boolean} True if hash needs rehashing
 * 
 * @example
 * if (needsRehash(storedHash)) {
 *   const newHash = await hashPassword(plainPassword);
 *   // Update stored hash
 * }
 */
export function needsRehash(hash: string): boolean {
  try {
    if (typeof hash !== 'string' || hash.length === 0) {
      console.error('[PASSWORD_REHASH_CHECK] Invalid hash provided:', {
        type: typeof hash,
        timestamp: new Date().toISOString(),
      });
      return false;
    }

    // Get current salt rounds from configuration
    const config = getAuthConfig();
    const currentSaltRounds = config.password.saltRounds;

    // Extract salt rounds from hash
    // Bcrypt hash format: $2a$10$... where 10 is the salt rounds
    const hashParts = hash.split('$');
    if (hashParts.length < 4) {
      console.error('[PASSWORD_REHASH_CHECK] Invalid hash format:', {
        partsCount: hashParts.length,
        timestamp: new Date().toISOString(),
      });
      return false;
    }

    const hashSaltRounds = parseInt(hashParts[2] ?? '0', 10);
    const needsUpdate = hashSaltRounds !== currentSaltRounds;

    console.log('[PASSWORD_REHASH_CHECK] Hash rehash check completed:', {
      hashSaltRounds,
      currentSaltRounds,
      needsUpdate,
      timestamp: new Date().toISOString(),
    });

    return needsUpdate;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[PASSWORD_REHASH_CHECK] Rehash check failed:', {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    return false;
  }
}

/**
 * Export default object with all password utilities
 */
export default {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  validatePasswordWithFeedback,
  needsRehash,
};