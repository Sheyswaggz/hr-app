/**
 * Authentication Configuration Module
 * 
 * Centralized configuration for JWT authentication, password hashing, rate limiting,
 * and account security settings. Loads configuration from environment variables with
 * secure defaults and comprehensive validation.
 * 
 * @module config/auth
 */

/**
 * JWT token configuration interface
 */
export interface JWTConfig {
  /**
   * Secret key for signing access tokens
   * Must be at least 32 characters for security
   */
  readonly secret: string;

  /**
   * Access token expiration time
   * Format: Zeit/ms format (e.g., '15m', '1h', '24h')
   */
  readonly expiresIn: string;

  /**
   * JWT signing algorithm
   * RS256 recommended for production, HS256 for development
   */
  readonly algorithm: 'HS256' | 'RS256';

  /**
   * Token issuer identifier
   */
  readonly issuer: string;

  /**
   * Token audience identifier
   */
  readonly audience: string;
}

/**
 * Refresh token configuration interface
 */
export interface RefreshTokenConfig {
  /**
   * Secret key for signing refresh tokens
   * Must be different from access token secret
   */
  readonly secret: string;

  /**
   * Refresh token expiration time
   * Format: Zeit/ms format (e.g., '7d', '30d', '90d')
   */
  readonly expiresIn: string;

  /**
   * Whether to rotate refresh tokens on use
   */
  readonly rotateOnUse: boolean;
}

/**
 * Password hashing configuration interface
 */
export interface PasswordConfig {
  /**
   * Bcrypt salt rounds for password hashing
   * Valid range: 10-15
   * Higher values increase security but slow down hashing
   */
  readonly saltRounds: number;

  /**
   * Minimum password length requirement
   */
  readonly minLength: number;

  /**
   * Whether to require uppercase characters
   */
  readonly requireUppercase: boolean;

  /**
   * Whether to require lowercase characters
   */
  readonly requireLowercase: boolean;

  /**
   * Whether to require numeric characters
   */
  readonly requireNumbers: boolean;

  /**
   * Whether to require special characters
   */
  readonly requireSpecialChars: boolean;
}

/**
 * Account lockout configuration interface
 */
export interface AccountLockoutConfig {
  /**
   * Maximum failed login attempts before lockout
   */
  readonly maxAttempts: number;

  /**
   * Lockout duration in milliseconds
   */
  readonly lockoutDuration: number;

  /**
   * Time window for counting failed attempts (milliseconds)
   */
  readonly attemptWindow: number;

  /**
   * Whether to use exponential backoff for repeated lockouts
   */
  readonly exponentialBackoff: boolean;
}

/**
 * Rate limiting configuration interface
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests per window
   */
  readonly maxRequests: number;

  /**
   * Time window in milliseconds
   */
  readonly windowMs: number;

  /**
   * Whether to skip rate limiting for successful requests
   */
  readonly skipSuccessfulRequests: boolean;

  /**
   * Whether to skip rate limiting for failed requests
   */
  readonly skipFailedRequests: boolean;

  /**
   * Custom message for rate limit exceeded
   */
  readonly message: string;
}

/**
 * Session configuration interface
 */
export interface SessionConfig {
  /**
   * Session timeout in milliseconds
   */
  readonly timeout: number;

  /**
   * Whether to extend session on activity
   */
  readonly extendOnActivity: boolean;

  /**
   * Maximum number of concurrent sessions per user
   */
  readonly maxConcurrentSessions: number;
}

/**
 * Password reset configuration interface
 */
export interface PasswordResetConfig {
  /**
   * Reset token expiration time in milliseconds
   */
  readonly tokenExpiration: number;

  /**
   * Reset token length in bytes
   */
  readonly tokenLength: number;

  /**
   * Maximum number of reset attempts per time window
   */
  readonly maxAttempts: number;

  /**
   * Time window for reset attempts in milliseconds
   */
  readonly attemptWindow: number;
}

/**
 * Complete authentication configuration interface
 */
export interface AuthConfig {
  /**
   * Whether authentication system is enabled
   */
  readonly enabled: boolean;

  /**
   * JWT access token configuration
   */
  readonly jwt: JWTConfig;

  /**
   * Refresh token configuration
   */
  readonly refreshToken: RefreshTokenConfig;

  /**
   * Password hashing and validation configuration
   */
  readonly password: PasswordConfig;

  /**
   * Account lockout configuration
   */
  readonly accountLockout: AccountLockoutConfig;

  /**
   * Rate limiting configuration
   */
  readonly rateLimit: RateLimitConfig;

  /**
   * Session management configuration
   */
  readonly session: SessionConfig;

  /**
   * Password reset configuration
   */
  readonly passwordReset: PasswordResetConfig;

  /**
   * Current environment
   */
  readonly environment: 'development' | 'staging' | 'production' | 'test';
}

/**
 * Configuration validation error interface
 */
export interface ConfigValidationError {
  /**
   * Configuration field that failed validation
   */
  readonly field: string;

  /**
   * Validation error message
   */
  readonly message: string;

  /**
   * Current value that failed validation
   */
  readonly value?: unknown;
}

/**
 * Singleton instance of auth configuration
 */
let authConfigInstance: AuthConfig | null = null;

/**
 * Load and parse environment variable as string
 */
function getEnvString(key: string, defaultValue: string): string {
  const value = process.env[key];
  return value !== undefined && value.trim().length > 0 ? value.trim() : defaultValue;
}

/**
 * Load and parse environment variable as number
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined || value.trim().length === 0) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`[AUTH_CONFIG] Invalid number for ${key}: ${value}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

/**
 * Load and parse environment variable as boolean
 */
function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined || value.trim().length === 0) {
    return defaultValue;
  }
  const normalized = value.toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

/**
 * Validate JWT secret strength
 */
function validateJWTSecret(secret: string, fieldName: string): ConfigValidationError | null {
  if (secret.length < 32) {
    return {
      field: fieldName,
      message: `${fieldName} must be at least 32 characters for security`,
      value: `${secret.substring(0, 8)}...`,
    };
  }
  return null;
}

/**
 * Validate time duration format
 */
function validateDuration(duration: string, fieldName: string): ConfigValidationError | null {
  const durationRegex = /^(\d+)(ms|s|m|h|d|w|y)$/;
  if (!durationRegex.test(duration)) {
    return {
      field: fieldName,
      message: `${fieldName} must be in Zeit/ms format (e.g., '15m', '1h', '24h')`,
      value: duration,
    };
  }
  return null;
}

/**
 * Validate bcrypt salt rounds
 */
function validateSaltRounds(rounds: number): ConfigValidationError | null {
  if (rounds < 10 || rounds > 15) {
    return {
      field: 'password.saltRounds',
      message: 'Bcrypt salt rounds must be between 10 and 15',
      value: rounds,
    };
  }
  return null;
}

/**
 * Validate rate limit configuration
 */
function validateRateLimit(config: RateLimitConfig): ConfigValidationError | null {
  if (config.maxRequests < 1) {
    return {
      field: 'rateLimit.maxRequests',
      message: 'Maximum requests must be at least 1',
      value: config.maxRequests,
    };
  }
  if (config.windowMs < 1000) {
    return {
      field: 'rateLimit.windowMs',
      message: 'Rate limit window must be at least 1000ms',
      value: config.windowMs,
    };
  }
  return null;
}

/**
 * Validate account lockout configuration
 */
function validateAccountLockout(config: AccountLockoutConfig): ConfigValidationError | null {
  if (config.maxAttempts < 1) {
    return {
      field: 'accountLockout.maxAttempts',
      message: 'Maximum login attempts must be at least 1',
      value: config.maxAttempts,
    };
  }
  if (config.lockoutDuration < 60000) {
    return {
      field: 'accountLockout.lockoutDuration',
      message: 'Lockout duration must be at least 60000ms (1 minute)',
      value: config.lockoutDuration,
    };
  }
  if (config.attemptWindow < 60000) {
    return {
      field: 'accountLockout.attemptWindow',
      message: 'Attempt window must be at least 60000ms (1 minute)',
      value: config.attemptWindow,
    };
  }
  return null;
}

/**
 * Validate complete auth configuration
 */
function validateAuthConfig(config: AuthConfig): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];

  // Validate JWT secret
  const jwtSecretError = validateJWTSecret(config.jwt.secret, 'jwt.secret');
  if (jwtSecretError) {
    errors.push(jwtSecretError);
  }

  // Validate JWT expiration
  const jwtExpiresError = validateDuration(config.jwt.expiresIn, 'jwt.expiresIn');
  if (jwtExpiresError) {
    errors.push(jwtExpiresError);
  }

  // Validate refresh token secret
  const refreshSecretError = validateJWTSecret(config.refreshToken.secret, 'refreshToken.secret');
  if (refreshSecretError) {
    errors.push(refreshSecretError);
  }

  // Validate refresh token expiration
  const refreshExpiresError = validateDuration(config.refreshToken.expiresIn, 'refreshToken.expiresIn');
  if (refreshExpiresError) {
    errors.push(refreshExpiresError);
  }

  // Ensure JWT and refresh token secrets are different
  if (config.jwt.secret === config.refreshToken.secret) {
    errors.push({
      field: 'refreshToken.secret',
      message: 'Refresh token secret must be different from JWT secret',
    });
  }

  // Validate salt rounds
  const saltRoundsError = validateSaltRounds(config.password.saltRounds);
  if (saltRoundsError) {
    errors.push(saltRoundsError);
  }

  // Validate password requirements
  if (config.password.minLength < 8) {
    errors.push({
      field: 'password.minLength',
      message: 'Minimum password length must be at least 8 characters',
      value: config.password.minLength,
    });
  }

  // Validate rate limit
  const rateLimitError = validateRateLimit(config.rateLimit);
  if (rateLimitError) {
    errors.push(rateLimitError);
  }

  // Validate account lockout
  const lockoutError = validateAccountLockout(config.accountLockout);
  if (lockoutError) {
    errors.push(lockoutError);
  }

  // Validate session configuration
  if (config.session.timeout < 60000) {
    errors.push({
      field: 'session.timeout',
      message: 'Session timeout must be at least 60000ms (1 minute)',
      value: config.session.timeout,
    });
  }

  if (config.session.maxConcurrentSessions < 1) {
    errors.push({
      field: 'session.maxConcurrentSessions',
      message: 'Maximum concurrent sessions must be at least 1',
      value: config.session.maxConcurrentSessions,
    });
  }

  // Validate password reset configuration
  if (config.passwordReset.tokenExpiration < 300000) {
    errors.push({
      field: 'passwordReset.tokenExpiration',
      message: 'Password reset token expiration must be at least 300000ms (5 minutes)',
      value: config.passwordReset.tokenExpiration,
    });
  }

  if (config.passwordReset.tokenLength < 32) {
    errors.push({
      field: 'passwordReset.tokenLength',
      message: 'Password reset token length must be at least 32 bytes',
      value: config.passwordReset.tokenLength,
    });
  }

  // Production-specific validations
  if (config.environment === 'production') {
    if (config.jwt.secret.includes('your-jwt-secret') || config.jwt.secret.includes('example')) {
      errors.push({
        field: 'jwt.secret',
        message: 'JWT secret must be changed from default value in production',
      });
    }

    if (config.refreshToken.secret.includes('your-refresh-token-secret') || config.refreshToken.secret.includes('example')) {
      errors.push({
        field: 'refreshToken.secret',
        message: 'Refresh token secret must be changed from default value in production',
      });
    }

    if (config.jwt.algorithm !== 'RS256') {
      console.warn('[AUTH_CONFIG] WARNING: Using HS256 algorithm in production. RS256 is recommended for better security.');
    }
  }

  return errors;
}

/**
 * Load authentication configuration from environment variables
 */
function loadAuthConfig(): AuthConfig {
  console.log('[AUTH_CONFIG] Loading authentication configuration from environment...');

  const environment = getEnvString('NODE_ENV', 'development') as AuthConfig['environment'];

  const config: AuthConfig = {
    enabled: getEnvBoolean('AUTH_ENABLED', true),

    jwt: {
      secret: getEnvString('JWT_SECRET', 'your-jwt-secret-key-min-32-chars'),
      expiresIn: getEnvString('JWT_EXPIRES_IN', '24h'),
      algorithm: 'HS256', // Using HS256 as RS256 requires key pair management
      issuer: getEnvString('JWT_ISSUER', 'hr-app'),
      audience: getEnvString('JWT_AUDIENCE', 'hr-app-users'),
    },

    refreshToken: {
      secret: getEnvString('REFRESH_TOKEN_SECRET', 'your-refresh-token-secret-key-min-32-chars'),
      expiresIn: getEnvString('REFRESH_TOKEN_EXPIRES_IN', '7d'),
      rotateOnUse: getEnvBoolean('REFRESH_TOKEN_ROTATE', true),
    },

    password: {
      saltRounds: getEnvNumber('BCRYPT_SALT_ROUNDS', 10),
      minLength: getEnvNumber('PASSWORD_MIN_LENGTH', 8),
      requireUppercase: getEnvBoolean('PASSWORD_REQUIRE_UPPERCASE', true),
      requireLowercase: getEnvBoolean('PASSWORD_REQUIRE_LOWERCASE', true),
      requireNumbers: getEnvBoolean('PASSWORD_REQUIRE_NUMBERS', true),
      requireSpecialChars: getEnvBoolean('PASSWORD_REQUIRE_SPECIAL', false),
    },

    accountLockout: {
      maxAttempts: getEnvNumber('MAX_LOGIN_ATTEMPTS', 5),
      lockoutDuration: getEnvNumber('ACCOUNT_LOCKOUT_DURATION', 900000), // 15 minutes
      attemptWindow: getEnvNumber('LOGIN_ATTEMPT_WINDOW', 900000), // 15 minutes
      exponentialBackoff: getEnvBoolean('LOCKOUT_EXPONENTIAL_BACKOFF', false),
    },

    rateLimit: {
      maxRequests: getEnvNumber('RATE_LIMIT_MAX', 100),
      windowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
      skipSuccessfulRequests: getEnvBoolean('RATE_LIMIT_SKIP_SUCCESS', false),
      skipFailedRequests: getEnvBoolean('RATE_LIMIT_SKIP_FAILED', false),
      message: getEnvString('RATE_LIMIT_MESSAGE', 'Too many requests, please try again later'),
    },

    session: {
      timeout: getEnvNumber('SESSION_TIMEOUT', 3600000), // 1 hour
      extendOnActivity: getEnvBoolean('SESSION_EXTEND_ON_ACTIVITY', true),
      maxConcurrentSessions: getEnvNumber('MAX_CONCURRENT_SESSIONS', 5),
    },

    passwordReset: {
      tokenExpiration: getEnvNumber('PASSWORD_RESET_TOKEN_EXPIRATION', 3600000), // 1 hour
      tokenLength: getEnvNumber('PASSWORD_RESET_TOKEN_LENGTH', 32),
      maxAttempts: getEnvNumber('PASSWORD_RESET_MAX_ATTEMPTS', 3),
      attemptWindow: getEnvNumber('PASSWORD_RESET_ATTEMPT_WINDOW', 3600000), // 1 hour
    },

    environment,
  };

  console.log('[AUTH_CONFIG] Configuration loaded:', {
    enabled: config.enabled,
    environment: config.environment,
    jwtAlgorithm: config.jwt.algorithm,
    jwtExpiresIn: config.jwt.expiresIn,
    refreshTokenExpiresIn: config.refreshToken.expiresIn,
    saltRounds: config.password.saltRounds,
    maxLoginAttempts: config.accountLockout.maxAttempts,
    rateLimitMax: config.rateLimit.maxRequests,
    timestamp: new Date().toISOString(),
  });

  return config;
}

/**
 * Get authentication configuration singleton
 * 
 * @returns {AuthConfig} Authentication configuration object
 * @throws {Error} If configuration validation fails
 */
export function getAuthConfig(): AuthConfig {
  if (!authConfigInstance) {
    authConfigInstance = loadAuthConfig();

    // Validate configuration
    const errors = validateAuthConfig(authConfigInstance);
    if (errors.length > 0) {
      const errorMessages = errors.map(e => `  - ${e.field}: ${e.message}`).join('\n');
      console.error('[AUTH_CONFIG] Configuration validation failed:', {
        errors,
        timestamp: new Date().toISOString(),
      });
      throw new Error(
        `[AUTH_CONFIG] Invalid authentication configuration:\n${errorMessages}`
      );
    }

    console.log('[AUTH_CONFIG] Configuration validated successfully');
  }

  return authConfigInstance;
}

/**
 * Reset authentication configuration singleton
 * Useful for testing purposes
 */
export function resetAuthConfig(): void {
  authConfigInstance = null;
  console.log('[AUTH_CONFIG] Configuration reset');
}

/**
 * Check if authentication is enabled
 * 
 * @returns {boolean} True if authentication is enabled
 */
export function isAuthEnabled(): boolean {
  try {
    const config = getAuthConfig();
    return config.enabled;
  } catch (error) {
    console.error('[AUTH_CONFIG] Failed to check auth status:', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Fail secure: if we can't load config, assume auth is enabled
    return true;
  }
}

/**
 * Get masked configuration for logging (hides secrets)
 * 
 * @returns {object} Configuration with secrets masked
 */
export function getMaskedConfig(): Record<string, unknown> {
  try {
    const config = getAuthConfig();
    return {
      enabled: config.enabled,
      environment: config.environment,
      jwt: {
        secret: '***',
        expiresIn: config.jwt.expiresIn,
        algorithm: config.jwt.algorithm,
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      },
      refreshToken: {
        secret: '***',
        expiresIn: config.refreshToken.expiresIn,
        rotateOnUse: config.refreshToken.rotateOnUse,
      },
      password: config.password,
      accountLockout: config.accountLockout,
      rateLimit: {
        ...config.rateLimit,
        message: config.rateLimit.message,
      },
      session: config.session,
      passwordReset: config.passwordReset,
    };
  } catch (error) {
    return {
      error: 'Failed to load configuration',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Export default configuration instance
 */
export default getAuthConfig();