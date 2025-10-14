/**
 * Authentication Configuration
 * 
 * Centralized authentication configuration including JWT settings, password policies,
 * and security parameters. All configuration values are loaded from environment
 * variables with secure defaults.
 * 
 * @module config/auth
 */

/**
 * JWT Configuration
 * 
 * Configuration for JSON Web Token generation and validation
 */
export interface JWTConfig {
  /**
   * Secret key for signing JWT tokens
   * Must be at least 32 characters for security
   */
  readonly secret: string;

  /**
   * Access token expiration time in seconds
   * Default: 15 minutes (900 seconds)
   */
  readonly accessTokenExpiry: number;

  /**
   * Refresh token expiration time in seconds
   * Default: 7 days (604800 seconds)
   */
  readonly refreshTokenExpiry: number;

  /**
   * Password reset token expiration time in seconds
   * Default: 1 hour (3600 seconds)
   */
  readonly passwordResetTokenExpiry: number;

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
 * Password Policy Configuration
 * 
 * Configuration for password strength requirements and validation
 */
export interface PasswordPolicyConfig {
  /**
   * Minimum password length
   * Default: 8 characters
   */
  readonly minLength: number;

  /**
   * Maximum password length
   * Default: 128 characters
   */
  readonly maxLength: number;

  /**
   * Require at least one uppercase letter
   * Default: true
   */
  readonly requireUppercase: boolean;

  /**
   * Require at least one lowercase letter
   * Default: true
   */
  readonly requireLowercase: boolean;

  /**
   * Require at least one number
   * Default: true
   */
  readonly requireNumbers: boolean;

  /**
   * Require at least one special character
   * Default: true
   */
  readonly requireSpecialChars: boolean;

  /**
   * Bcrypt hash rounds for password hashing
   * Default: 12 (good balance of security and performance)
   * Range: 10-14 recommended
   */
  readonly bcryptRounds: number;
}

/**
 * Session Configuration
 * 
 * Configuration for user session management
 */
export interface SessionConfig {
  /**
   * Maximum number of concurrent sessions per user
   * Default: 5
   */
  readonly maxConcurrentSessions: number;

  /**
   * Session inactivity timeout in seconds
   * Default: 30 minutes (1800 seconds)
   */
  readonly inactivityTimeout: number;

  /**
   * Enable session tracking
   * Default: true
   */
  readonly enableTracking: boolean;
}

/**
 * Rate Limiting Configuration
 * 
 * Configuration for API rate limiting to prevent abuse
 */
export interface RateLimitConfig {
  /**
   * Maximum login attempts per IP address
   * Default: 5 attempts
   */
  readonly maxLoginAttempts: number;

  /**
   * Login attempt window in seconds
   * Default: 15 minutes (900 seconds)
   */
  readonly loginAttemptWindow: number;

  /**
   * Maximum API requests per IP address
   * Default: 100 requests
   */
  readonly maxApiRequests: number;

  /**
   * API request window in seconds
   * Default: 15 minutes (900 seconds)
   */
  readonly apiRequestWindow: number;
}

/**
 * Complete Authentication Configuration
 */
export interface AuthConfig {
  readonly jwt: JWTConfig;
  readonly passwordPolicy: PasswordPolicyConfig;
  readonly session: SessionConfig;
  readonly rateLimit: RateLimitConfig;
}

/**
 * Load JWT Configuration
 * 
 * Loads JWT configuration from environment variables with validation
 */
function loadJWTConfig(): JWTConfig {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is required. ' +
        'Generate a secure secret with: openssl rand -base64 32'
    );
  }

  if (secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be at least 32 characters long for security. ' +
        'Current length: ' +
        secret.length
    );
  }

  const accessTokenExpiry = parseInt(
    process.env.JWT_ACCESS_TOKEN_EXPIRY || '900',
    10
  );
  const refreshTokenExpiry = parseInt(
    process.env.JWT_REFRESH_TOKEN_EXPIRY || '604800',
    10
  );
  const passwordResetTokenExpiry = parseInt(
    process.env.JWT_PASSWORD_RESET_TOKEN_EXPIRY || '3600',
    10
  );

  if (accessTokenExpiry < 60) {
    throw new Error('JWT_ACCESS_TOKEN_EXPIRY must be at least 60 seconds');
  }

  if (refreshTokenExpiry < 3600) {
    throw new Error('JWT_REFRESH_TOKEN_EXPIRY must be at least 3600 seconds (1 hour)');
  }

  if (passwordResetTokenExpiry < 300) {
    throw new Error('JWT_PASSWORD_RESET_TOKEN_EXPIRY must be at least 300 seconds (5 minutes)');
  }

  return {
    secret,
    accessTokenExpiry,
    refreshTokenExpiry,
    passwordResetTokenExpiry,
    issuer: process.env.JWT_ISSUER || 'hr-app',
    audience: process.env.JWT_AUDIENCE || 'hr-app-users',
  };
}

/**
 * Load Password Policy Configuration
 * 
 * Loads password policy configuration from environment variables
 */
function loadPasswordPolicyConfig(): PasswordPolicyConfig {
  const minLength = parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10);
  const maxLength = parseInt(process.env.PASSWORD_MAX_LENGTH || '128', 10);
  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

  if (minLength < 8) {
    throw new Error('PASSWORD_MIN_LENGTH must be at least 8 characters');
  }

  if (maxLength < minLength) {
    throw new Error('PASSWORD_MAX_LENGTH must be greater than PASSWORD_MIN_LENGTH');
  }

  if (bcryptRounds < 10 || bcryptRounds > 14) {
    throw new Error('BCRYPT_ROUNDS must be between 10 and 14');
  }

  return {
    minLength,
    maxLength,
    requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
    requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
    requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
    requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL_CHARS !== 'false',
    bcryptRounds,
  };
}

/**
 * Load Session Configuration
 * 
 * Loads session configuration from environment variables
 */
function loadSessionConfig(): SessionConfig {
  const maxConcurrentSessions = parseInt(
    process.env.MAX_CONCURRENT_SESSIONS || '5',
    10
  );
  const inactivityTimeout = parseInt(
    process.env.SESSION_INACTIVITY_TIMEOUT || '1800',
    10
  );

  if (maxConcurrentSessions < 1) {
    throw new Error('MAX_CONCURRENT_SESSIONS must be at least 1');
  }

  if (inactivityTimeout < 300) {
    throw new Error('SESSION_INACTIVITY_TIMEOUT must be at least 300 seconds (5 minutes)');
  }

  return {
    maxConcurrentSessions,
    inactivityTimeout,
    enableTracking: process.env.SESSION_TRACKING_ENABLED !== 'false',
  };
}

/**
 * Load Rate Limiting Configuration
 * 
 * Loads rate limiting configuration from environment variables
 */
function loadRateLimitConfig(): RateLimitConfig {
  const maxLoginAttempts = parseInt(
    process.env.MAX_LOGIN_ATTEMPTS || '5',
    10
  );
  const loginAttemptWindow = parseInt(
    process.env.LOGIN_ATTEMPT_WINDOW || '900',
    10
  );
  const maxApiRequests = parseInt(
    process.env.MAX_API_REQUESTS || '100',
    10
  );
  const apiRequestWindow = parseInt(
    process.env.API_REQUEST_WINDOW || '900',
    10
  );

  if (maxLoginAttempts < 1) {
    throw new Error('MAX_LOGIN_ATTEMPTS must be at least 1');
  }

  if (loginAttemptWindow < 60) {
    throw new Error('LOGIN_ATTEMPT_WINDOW must be at least 60 seconds');
  }

  if (maxApiRequests < 1) {
    throw new Error('MAX_API_REQUESTS must be at least 1');
  }

  if (apiRequestWindow < 60) {
    throw new Error('API_REQUEST_WINDOW must be at least 60 seconds');
  }

  return {
    maxLoginAttempts,
    loginAttemptWindow,
    maxApiRequests,
    apiRequestWindow,
  };
}

/**
 * Load Complete Authentication Configuration
 * 
 * Loads all authentication configuration from environment variables
 */
export function loadAuthConfig(): AuthConfig {
  try {
    const config: AuthConfig = {
      jwt: loadJWTConfig(),
      passwordPolicy: loadPasswordPolicyConfig(),
      session: loadSessionConfig(),
      rateLimit: loadRateLimitConfig(),
    };

    console.log('[AUTH_CONFIG] Authentication configuration loaded successfully:', {
      jwt: {
        accessTokenExpiry: config.jwt.accessTokenExpiry,
        refreshTokenExpiry: config.jwt.refreshTokenExpiry,
        passwordResetTokenExpiry: config.jwt.passwordResetTokenExpiry,
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      },
      passwordPolicy: {
        minLength: config.passwordPolicy.minLength,
        maxLength: config.passwordPolicy.maxLength,
        requireUppercase: config.passwordPolicy.requireUppercase,
        requireLowercase: config.passwordPolicy.requireLowercase,
        requireNumbers: config.passwordPolicy.requireNumbers,
        requireSpecialChars: config.passwordPolicy.requireSpecialChars,
        bcryptRounds: config.passwordPolicy.bcryptRounds,
      },
      session: {
        maxConcurrentSessions: config.session.maxConcurrentSessions,
        inactivityTimeout: config.session.inactivityTimeout,
        enableTracking: config.session.enableTracking,
      },
      rateLimit: {
        maxLoginAttempts: config.rateLimit.maxLoginAttempts,
        loginAttemptWindow: config.rateLimit.loginAttemptWindow,
        maxApiRequests: config.rateLimit.maxApiRequests,
        apiRequestWindow: config.rateLimit.apiRequestWindow,
      },
    });

    return config;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[AUTH_CONFIG] Failed to load authentication configuration:', {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
    throw new Error(`Authentication configuration error: ${errorMessage}`);
  }
}

/**
 * Cached authentication configuration
 */
let cachedConfig: AuthConfig | null = null;

/**
 * Get Authentication Configuration
 * 
 * Returns cached authentication configuration or loads it if not cached
 */
export function getAuthConfig(): AuthConfig {
  if (!cachedConfig) {
    cachedConfig = loadAuthConfig();
  }
  return cachedConfig;
}

/**
 * Get JWT Configuration
 * 
 * Returns JWT configuration from cached auth config
 */
export function getJWTConfig(): JWTConfig {
  return getAuthConfig().jwt;
}

/**
 * Get Password Policy Configuration
 * 
 * Returns password policy configuration from cached auth config
 */
export function getPasswordPolicyConfig(): PasswordPolicyConfig {
  return getAuthConfig().passwordPolicy;
}

/**
 * Get Session Configuration
 * 
 * Returns session configuration from cached auth config
 */
export function getSessionConfig(): SessionConfig {
  return getAuthConfig().session;
}

/**
 * Get Rate Limit Configuration
 * 
 * Returns rate limit configuration from cached auth config
 */
export function getRateLimitConfig(): RateLimitConfig {
  return getAuthConfig().rateLimit;
}

/**
 * Reset Configuration Cache
 * 
 * Clears cached configuration, forcing reload on next access
 * Useful for testing or configuration updates
 */
export function resetConfigCache(): void {
  cachedConfig = null;
  console.log('[AUTH_CONFIG] Configuration cache cleared');
}

/**
 * Validate Configuration
 * 
 * Validates that all required configuration is present and valid
 * Throws error if configuration is invalid
 */
export function validateConfig(): void {
  try {
    getAuthConfig();
    console.log('[AUTH_CONFIG] Configuration validation successful');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[AUTH_CONFIG] Configuration validation failed:', {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

/**
 * Export default configuration getter
 */
export default {
  getAuthConfig,
  getJWTConfig,
  getPasswordPolicyConfig,
  getSessionConfig,
  getRateLimitConfig,
  resetConfigCache,
  validateConfig,
};