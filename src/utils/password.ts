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
 *