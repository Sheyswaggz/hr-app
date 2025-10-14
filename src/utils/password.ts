/**
 * Password utility functions for secure password handling
 * 
 * Provides functions for hashing, comparing, and validating passwords
 * using bcrypt for secure password storage.
 */

import * as bcrypt from 'bcrypt';

/**
 * Password configuration
 */
interface PasswordConfig {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  saltRounds: number;
}

const PASSWORD_CONFIG: PasswordConfig = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  saltRounds: 10,
};

/**
 * Hash result interface
 */
export interface HashResult {
  hash: string;
  executionTimeMs: number;
}

/**
 * Compare result interface
 */
export interface CompareResult {
  match: boolean;
  executionTimeMs: number;
}

/**
 * Password validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  strength: number;
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
  };
}

/**
 * Hashes a password using bcrypt
 * 
 * @param password - The password to hash
 * @param saltRounds - Number of salt rounds (default: 10)
 * @returns Promise with hash result
 */
export async function hashPassword(
  password: string,
  saltRounds: number = PASSWORD_CONFIG.saltRounds
): Promise<HashResult> {
  const startTime = Date.now();

  try {
    // Validate input
    if (typeof password !== 'string' || password.trim().length === 0) {
      console.error('[PASSWORD_UTILS] Hash failed: Invalid password input', {
        passwordType: typeof password,
        passwordEmpty: typeof password === 'string' && password.trim().length === 0,
      });
      throw new Error('[PASSWORD_UTILS] Password must be a non-empty string');
    }

    console.log('[PASSWORD_UTILS] Starting password hashing', {
      passwordLength: password.length,
      saltRounds,
    });

    const hash = await bcrypt.hash(password, saltRounds);
    const executionTimeMs = Date.now() - startTime;

    console.log('[PASSWORD_UTILS] Password hashing completed', {
      executionTimeMs,
    });

    return {
      hash,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    console.error('[PASSWORD_UTILS] Password hashing failed', {
      error: error instanceof Error ? error.message : String(error),
      passwordLength: typeof password === 'string' ? password.length : 0,
      executionTimeMs,
    });
    throw new Error(
      `[PASSWORD_UTILS] Failed to hash password: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Compares a password with a hash
 * 
 * @param password - The password to compare
 * @param hash - The hash to compare against
 * @returns Promise with comparison result
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<CompareResult> {
  const startTime = Date.now();

  try {
    // Validate password
    if (typeof password !== 'string' || password.trim().length === 0) {
      console.error('[PASSWORD_UTILS] Compare failed: Invalid password input', {
        passwordType: typeof password,
        passwordEmpty: typeof password === 'string' && password.trim().length === 0,
      });
      throw new Error('[PASSWORD_UTILS] Password must be a non-empty string');
    }

    // Validate hash
    if (typeof hash !== 'string' || hash.trim().length === 0) {
      console.error('[PASSWORD_UTILS] Compare failed: Invalid hash input', {
        hashType: typeof hash,
        hashEmpty: typeof hash === 'string' && hash.trim().length === 0,
      });
      throw new Error('[PASSWORD_UTILS] Hash must be a non-empty string');
    }

    // Validate hash format (bcrypt hashes start with $2a$, $2b$, or $2y$)
    if (!hash.startsWith('$2a$') && !hash.startsWith('$2b$') && !hash.startsWith('$2y$')) {
      console.error('[PASSWORD_UTILS] Compare failed: Invalid hash format', {
        hashPrefix: hash.substring(0, 4),
      });
      throw new Error('[PASSWORD_UTILS] Invalid bcrypt hash format');
    }

    console.log('[PASSWORD_UTILS] Starting password comparison', {
      passwordLength: password.length,
      hashLength: hash.length,
    });

    const match = await bcrypt.compare(password, hash);
    const executionTimeMs = Date.now() - startTime;

    console.log('[PASSWORD_UTILS] Password comparison completed', {
      match,
      executionTimeMs,
    });

    return {
      match,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    console.error('[PASSWORD_UTILS] Password comparison failed', {
      error: error instanceof Error ? error.message : String(error),
      passwordLength: typeof password === 'string' ? password.length : 0,
      hashLength: typeof hash === 'string' ? hash.length : 0,
      executionTimeMs,
    });
    throw new Error(
      `[PASSWORD_UTILS] Failed to compare password: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Validates password strength
 * 
 * @param password - The password to validate
 * @returns Validation result with errors and strength score
 */
export function validatePasswordStrength(password: string): ValidationResult {
  console.log('[PASSWORD_UTILS] Validating password strength', {
    passwordLength: typeof password === 'string' ? password.length : 0,
  });

  const errors: string[] = [];
  const requirements = {
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
  };

  // Check minimum length
  if (password.length >= PASSWORD_CONFIG.minLength) {
    requirements.minLength = true;
  } else {
    errors.push(`Password must be at least ${PASSWORD_CONFIG.minLength} characters long`);
  }

  // Check for uppercase letter
  if (/[A-Z]/.test(password)) {
    requirements.hasUppercase = true;
  } else if (PASSWORD_CONFIG.requireUppercase) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase letter
  if (/[a-z]/.test(password)) {
    requirements.hasLowercase = true;
  } else if (PASSWORD_CONFIG.requireLowercase) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for number
  if (/[0-9]/.test(password)) {
    requirements.hasNumber = true;
  } else if (PASSWORD_CONFIG.requireNumbers) {
    errors.push('Password must contain at least one number');
  }

  // Check for special character
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    requirements.hasSpecialChar = true;
  } else if (PASSWORD_CONFIG.requireSpecialChars) {
    errors.push('Password must contain at least one special character');
  }

  // Calculate strength score (0-100)
  let strength = 0;
  if (requirements.minLength) {
    strength += 20;
  }
  if (requirements.hasUppercase) {
    strength += 20;
  }
  if (requirements.hasLowercase) {
    strength += 20;
  }
  if (requirements.hasNumber) {
    strength += 20;
  }
  if (requirements.hasSpecialChar) {
    strength += 20;
  }

  // Bonus points for extra length
  if (password.length > PASSWORD_CONFIG.minLength) {
    strength += Math.min(10, (password.length - PASSWORD_CONFIG.minLength) * 2);
  }

  // Cap at 100
  strength = Math.min(100, strength);

  const isValid = errors.length === 0;

  console.log('[PASSWORD_UTILS] Password validation completed', {
    isValid,
    strength,
    errorCount: errors.length,
  });

  return {
    isValid,
    errors,
    strength,
    requirements,
  };
}

/**
 * Gets the current password configuration
 * 
 * @returns Password configuration object
 */
export function getPasswordConfig(): PasswordConfig {
  return PASSWORD_CONFIG;
}