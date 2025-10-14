/**
 * Authentication Configuration Module
 * 
 * Centralized configuration for JWT authentication, password hashing,
 * rate limiting, and account security settings. All configuration values
 * are loaded from environment variables with secure defaults.
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
   * Refresh token secret key (separate from access token)
   * Must be different from access token secret
   */
  readonly refreshSecret: string;

  /**
   * Refresh token expiration time
   * Format: Zeit/ms format (e.g., '7d', '30d')
   */
  readonly refreshExpiresIn: string;

  /**
   * JWT algorithm for token signing
   * Using HS256 for symmetric key signing
   */
  readonly algorithm: 'HS256';

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
 * Password hashing configuration interface
 */
export interface PasswordConfig {
  /**
   * Bcrypt salt rounds for password hashing
   * Valid range: 10-15
   * Higher values increase security but slow down hashing exponentially
   */
  readonly saltRounds: number;

  /**
   * Minimum password length requirement
   */
  readonly minLength: number;

  /**
   * Require uppercase letter in password
   */
  readonly requireUppercase: boolean;

  /**
   * Require lowercase letter in password
   */
  readonly requireLowercase: boolean;

  /**
   * Require number in password
   */
  readonly requireNumber: boolean;

  /**
   * Require special character in password
   */
  readonly requireSpecialChar: boolean;
}

/**
 * Account lockout configuration interface
 */
export interface AccountLockoutConfig {
  /**
   * Maximum failed login attempts before account lockout
   * Set to 0 to disable account lockout feature
   */
  readonly maxAttempts: number;

  /**
   * Account lockout duration in milliseconds
   * Account automatically unlocks after this duration
   */
  readonly lockoutDuration: number;

  /**
   * Time window for counting failed attempts (milliseconds)
   * Failed attempts outside this window are not counted
   */
  readonly attemptWindow: number;
}

/**
 * Rate limiting configuration interface
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests per window per IP
   */
  readonly maxRequests: number;

  /**
   * Time window for rate limiting in milliseconds
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
   * Custom message when rate limit is exceeded
   */
  readonly message: string;
}

/**
 * Session configuration interface
 */
export interface SessionConfig {
  /**
   * Session timeout in milliseconds
   * User must re-authenticate after this duration of inactivity
   */
  readonly timeout: number;

  /**
   * Whether to use sliding session expiration
   * If true, session timeout resets on each request
   */
  readonly sliding: boolean;

  /**
   * Maximum session lifetime in milliseconds
   * Absolute maximum time before re-authentication required
   */
  readonly maxLifetime: number;
}

/**
 * Password reset configuration interface
 */
export interface PasswordResetConfig {
  /**
   * Password reset token expiration time in milliseconds
   */
  readonly tokenExpiration: number;

  /**
   * Length of password reset token
   */
  readonly tokenLength: number;

  /**
   * Maximum number of password reset attempts per time window
   */
  readonly maxAttempts: number;

  /**
   * Time window for password reset attempts in milliseconds
   */
  readonly attemptWindow: number;
}

/**
 * Complete authentication configuration interface
 */
export interface AuthConfig {
  /**
   * JWT token configuration
   */
  readonly jwt: JWTConfig;

  /**
   * Password hashing configuration
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
   * Session configuration
   */
  readonly session: SessionConfig;

  /**
   * Password reset configuration
   */
  readonly passwordReset: PasswordResetConfig;

  /**
   * Whether authentication system is enabled
   * Master kill switch for emergency maintenance
   */
  readonly enabled: boolean;

  /**
   * Current environment
   */
  readonly environment: 'development' | 'staging' | 'production' | 'test';
}

/**
 * Validation result interface
 */
interface ValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
}

/**
 * Load and validate JWT configuration from environment variables
 */
function loadJWTConfig(): JWTConfig {
  const secret = process.env.JWT_SECRET || '';
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET || '';
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  const refreshExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

  // Validate secrets in production
  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.length < 32) {
      throw new Error(
        '[AUTH_CONFIG] JWT_SECRET must be at least 32 characters in production'
      );
    }
    if (!refreshSecret || refreshSecret.length < 32) {
      throw new Error(
        '[AUTH_CONFIG] REFRESH_TOKEN_SECRET must be at least 32 characters in production'
      );
    }
    if (secret === refreshSecret) {
      throw new Error(
        '[AUTH_CONFIG] JWT_SECRET and REFRESH_TOKEN_SECRET must be different'
      );
    }
  }

  return {
    secret: secret || 'development-jwt-secret-min-32-chars-long-for-security',
    expiresIn,
    refreshSecret: refreshSecret || 'development-refresh-secret-min-32-chars-long-for-security',
    refreshExpiresIn,
    algorithm: 'HS256',
    issuer: 'hr-app',
    audience: 'hr-app-users',
  };
}

/**
 * Load and validate password configuration from environment variables
 */
function loadPasswordConfig(): PasswordConfig {
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

  // Validate salt rounds
  if (saltRounds < 10 || saltRounds > 15) {
    console.warn(
      `[AUTH_CONFIG] BCRYPT_SALT_ROUNDS should be between 10 and 15, got ${saltRounds}. Using default: 10`
    );
  }

  return {
    saltRounds: Math.max(10, Math.min(15, saltRounds)),
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialChar: false, // Optional for better UX
  };
}

/**
 * Load and validate account lockout configuration from environment variables
 */
function loadAccountLockoutConfig(): AccountLockoutConfig {
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10);
  const lockoutDuration = parseInt(
    process.env.ACCOUNT_LOCKOUT_DURATION || '900000',
    10
  ); // 15 minutes default

  // Validate configuration
  if (maxAttempts < 0) {
    console.warn(
      `[AUTH_CONFIG] MAX_LOGIN_ATTEMPTS cannot be negative, got ${maxAttempts}. Using default: 5`
    );
  }

  if (lockoutDuration < 60000) {
    console.warn(
      `[AUTH_CONFIG] ACCOUNT_LOCKOUT_DURATION should be at least 60000ms (1 minute), got ${lockoutDuration}. Using default: 900000ms`
    );
  }

  return {
    maxAttempts: Math.max(0, maxAttempts),
    lockoutDuration: Math.max(60000, lockoutDuration),
    attemptWindow: 3600000, // 1 hour window for counting attempts
  };
}

/**
 * Load and validate rate limiting configuration from environment variables
 */
function loadRateLimitConfig(): RateLimitConfig {
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
  const windowMs = parseInt(
    process.env.RATE_LIMIT_WINDOW_MS || '900000',
    10
  ); // 15 minutes default

  // Validate configuration
  if (maxRequests < 1) {
    console.warn(
      `[AUTH_CONFIG] RATE_LIMIT_MAX must be at least 1, got ${maxRequests}. Using default: 100`
    );
  }

  if (windowMs < 60000) {
    console.warn(
      `[AUTH_CONFIG] RATE_LIMIT_WINDOW_MS should be at least 60000ms (1 minute), got ${windowMs}. Using default: 900000ms`
    );
  }

  return {
    maxRequests: Math.max(1, maxRequests),
    windowMs: Math.max(60000, windowMs),
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    message: 'Too many requests from this IP, please try again later',
  };
}

/**
 * Load and validate session configuration from environment variables
 */
function loadSessionConfig(): SessionConfig {
  const timeout = parseInt(
    process.env.SESSION_TIMEOUT || '3600000',
    10
  ); // 1 hour default

  // Validate configuration
  if (timeout < 300000) {
    console.warn(
      `[AUTH_CONFIG] SESSION_TIMEOUT should be at least 300000ms (5 minutes), got ${timeout}. Using default: 3600000ms`
    );
  }

  return {
    timeout: Math.max(300000, timeout),
    sliding: true,
    maxLifetime: 86400000, // 24 hours absolute maximum
  };
}

/**
 * Load and validate password reset configuration
 */
function loadPasswordResetConfig(): PasswordResetConfig {
  return {
    tokenExpiration: 3600000, // 1 hour
    tokenLength: 32,
    maxAttempts: 3,
    attemptWindow: 3600000, // 1 hour
  };
}

/**
 * Validate complete authentication configuration
 */
function validateAuthConfig(config: AuthConfig): ValidationResult {
  const errors: string[] = [];

  // Validate JWT configuration
  if (config.jwt.secret.length < 32) {
    errors.push('JWT secret must be at least 32 characters');
  }

  if (config.jwt.refreshSecret.length < 32) {
    errors.push('Refresh token secret must be at least 32 characters');
  }

  if (config.jwt.secret === config.jwt.refreshSecret) {
    errors.push('JWT secret and refresh token secret must be different');
  }

  // Validate password configuration
  if (config.password.saltRounds < 10 || config.password.saltRounds > 15) {
    errors.push('Bcrypt salt rounds must be between 10 and 15');
  }

  if (config.password.minLength < 8) {
    errors.push('Minimum password length must be at least 8 characters');
  }

  // Validate account lockout configuration
  if (config.accountLockout.maxAttempts < 0) {
    errors.push('Maximum login attempts cannot be negative');
  }

  if (config.accountLockout.lockoutDuration < 60000) {
    errors.push('Account lockout duration must be at least 60000ms (1 minute)');
  }

  // Validate rate limiting configuration
  if (config.rateLimit.maxRequests < 1) {
    errors.push('Rate limit max requests must be at least 1');
  }

  if (config.rateLimit.windowMs < 60000) {
    errors.push('Rate limit window must be at least 60000ms (1 minute)');
  }

  // Validate session configuration
  if (config.session.timeout < 300000) {
    errors.push('Session timeout must be at least 300000ms (5 minutes)');
  }

  if (config.session.maxLifetime < config.session.timeout) {
    errors.push('Session max lifetime must be greater than session timeout');
  }

  // Validate password reset configuration
  if (config.passwordReset.tokenExpiration < 300000) {
    errors.push('Password reset token expiration must be at least 300000ms (5 minutes)');
  }

  if (config.passwordReset.tokenLength < 16) {
    errors.push('Password reset token length must be at least 16 characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Load complete authentication configuration from environment variables
 */
function loadAuthConfig(): AuthConfig {
  const environment = (process.env.NODE_ENV || 'development') as
    | 'development'
    | 'staging'
    | 'production'
    | 'test';

  const enabled = process.env.AUTH_ENABLED !== 'false';

  console.log('[AUTH_CONFIG] Loading authentication configuration...', {
    environment,
    enabled,
    timestamp: new Date().toISOString(),
  });

  const config: AuthConfig = {
    jwt: loadJWTConfig(),
    password: loadPasswordConfig(),
    accountLockout: loadAccountLockoutConfig(),
    rateLimit: loadRateLimitConfig(),
    session: loadSessionConfig(),
    passwordReset: loadPasswordResetConfig(),
    enabled,
    environment,
  };

  // Validate configuration
  const validation = validateAuthConfig(config);
  if (!validation.valid) {
    const errorMessage = `[AUTH_CONFIG] Invalid authentication configuration:\n${validation.errors.join('\n')}`;
    console.error(errorMessage, {
      errors: validation.errors,
      timestamp: new Date().toISOString(),
    });
    throw new Error(errorMessage);
  }

  console.log('[AUTH_CONFIG] Authentication configuration loaded successfully', {
    environment,
    enabled,
    jwtExpiresIn: config.jwt.expiresIn,
    refreshExpiresIn: config.jwt.refreshExpiresIn,
    saltRounds: config.password.saltRounds,
    maxLoginAttempts: config.accountLockout.maxAttempts,
    lockoutDuration: config.accountLockout.lockoutDuration,
    rateLimitMax: config.rateLimit.maxRequests,
    rateLimitWindow: config.rateLimit.windowMs,
    sessionTimeout: config.session.timeout,
    timestamp: new Date().toISOString(),
  });

  return config;
}

/**
 * Singleton instance of authentication configuration
 */
let authConfigInstance: AuthConfig | null = null;

/**
 * Get authentication configuration singleton
 * 
 * @returns Authentication configuration object
 * @throws Error if configuration is invalid
 */
export function getAuthConfig(): AuthConfig {
  if (!authConfigInstance) {
    authConfigInstance = loadAuthConfig();
  }
  return authConfigInstance;
}

/**
 * Reset authentication configuration singleton
 * Used primarily for testing purposes
 */
export function resetAuthConfig(): void {
  authConfigInstance = null;
  console.log('[AUTH_CONFIG] Authentication configuration reset', {
    timestamp: new Date().toISOString(),
  });
}

/**
 * Check if authentication system is enabled
 * 
 * @returns True if authentication is enabled, false otherwise
 */
export function isAuthEnabled(): boolean {
  return getAuthConfig().enabled;
}

/**
 * Get JWT configuration
 * 
 * @returns JWT configuration object
 */
export function getJWTConfig(): JWTConfig {
  return getAuthConfig().jwt;
}

/**
 * Get password configuration
 * 
 * @returns Password configuration object
 */
export function getPasswordConfig(): PasswordConfig {
  return getAuthConfig().password;
}

/**
 * Get account lockout configuration
 * 
 * @returns Account lockout configuration object
 */
export function getAccountLockoutConfig(): AccountLockoutConfig {
  return getAuthConfig().accountLockout;
}

/**
 * Get rate limiting configuration
 * 
 * @returns Rate limiting configuration object
 */
export function getRateLimitConfig(): RateLimitConfig {
  return getAuthConfig().rateLimit;
}

/**
 * Get session configuration
 * 
 * @returns Session configuration object
 */
export function getSessionConfig(): SessionConfig {
  return getAuthConfig().session;
}

/**
 * Get password reset configuration
 * 
 * @returns Password reset configuration object
 */
export function getPasswordResetConfig(): PasswordResetConfig {
  return getAuthConfig().passwordReset;
}

/**
 * Validate password against configured requirements
 * 
 * @param password - Password to validate
 * @returns Validation result with errors if any
 */
export function validatePassword(password: string): ValidationResult {
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

  if (config.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get masked configuration for logging (hides sensitive values)
 * 
 * @returns Masked configuration object safe for logging
 */
export function getMaskedConfig(): Record<string, unknown> {
  const config = getAuthConfig();

  return {
    jwt: {
      secret: '***',
      expiresIn: config.jwt.expiresIn,
      refreshSecret: '***',
      refreshExpiresIn: config.jwt.refreshExpiresIn,
      algorithm: config.jwt.algorithm,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    },
    password: config.password,
    accountLockout: config.accountLockout,
    rateLimit: config.rateLimit,
    session: config.session,
    passwordReset: config.passwordReset,
    enabled: config.enabled,
    environment: config.environment,
  };
}

// Export default configuration instance
export default getAuthConfig();