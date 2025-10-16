/**
 * Email Configuration Module
 * 
 * Provides email service configuration for SMTP-based email delivery.
 * Supports both authenticated and unauthenticated SMTP connections.
 * All configuration is loaded from environment variables with validation.
 * 
 * @module config/email
 */

/**
 * SMTP authentication credentials
 */
export interface SMTPAuth {
  /**
   * SMTP username (typically email address or API username)
   */
  readonly user: string;

  /**
   * SMTP password or API key
   */
  readonly pass: string;
}

/**
 * Email configuration interface
 */
export interface EmailConfig {
  /**
   * SMTP server hostname
   * Examples: smtp.gmail.com, smtp.office365.com, smtp.sendgrid.net
   */
  readonly host: string;

  /**
   * SMTP server port
   * Common ports:
   * - 25: Standard SMTP (usually blocked by ISPs)
   * - 587: SMTP with STARTTLS (recommended)
   * - 465: SMTP over SSL (legacy)
   * - 2525: Alternative port (used by some providers)
   */
  readonly port: number;

  /**
   * Whether to use TLS/SSL
   * - true: Use TLS (recommended for port 587)
   * - false: No encryption (not recommended)
   */
  readonly secure: boolean;

  /**
   * SMTP authentication credentials
   * undefined for unauthenticated SMTP
   */
  readonly auth?: SMTPAuth;

  /**
   * Email sender address (From field)
   * Format: "Display Name <email@example.com>" or "email@example.com"
   */
  readonly from: string;

  /**
   * Connection timeout in milliseconds
   */
  readonly connectionTimeout: number;

  /**
   * Socket timeout in milliseconds
   */
  readonly socketTimeout: number;

  /**
   * Maximum number of connection retries
   */
  readonly maxRetries: number;

  /**
   * Whether email service is enabled
   */
  readonly enabled: boolean;

  /**
   * Current environment
   */
  readonly environment: 'development' | 'staging' | 'production' | 'test';
}

/**
 * Email configuration validation error
 */
export interface EmailConfigValidationError {
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
 * Singleton instance of email configuration
 */
let emailConfigInstance: EmailConfig | null = null;

/**
 * Load email configuration from environment variables
 * 
 * @private
 * @returns {EmailConfig} Email configuration object
 * @throws {Error} If required environment variables are missing
 */
function loadEmailConfig(): EmailConfig {
  console.log('[EMAIL_CONFIG] Loading email configuration from environment variables...');

  const environment = (process.env.NODE_ENV || 'development') as EmailConfig['environment'];

  // Email service can be disabled via environment variable
  const enabled = process.env.EMAIL_ENABLED !== 'false';

  // If email is disabled, return minimal config with default values
  if (!enabled) {
    console.log('[EMAIL_CONFIG] Email service is disabled (EMAIL_ENABLED=false)');
    return {
      host: 'localhost',
      port: 587,
      secure: false,
      from: 'noreply@example.com',
      connectionTimeout: 10000,
      socketTimeout: 10000,
      maxRetries: 3,
      enabled: false,
      environment,
    };
  }

  // Load SMTP host (required)
  const host = process.env.SMTP_HOST;
  if (!host || host.trim().length === 0) {
    throw new Error('[EMAIL_CONFIG] SMTP_HOST environment variable is required');
  }

  // Load SMTP port (required)
  const portStr = process.env.SMTP_PORT;
  if (!portStr || portStr.trim().length === 0) {
    throw new Error('[EMAIL_CONFIG] SMTP_PORT environment variable is required');
  }

  const port = parseInt(portStr, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`[EMAIL_CONFIG] Invalid SMTP_PORT: ${portStr}. Must be between 1 and 65535`);
  }

  // Determine if connection should be secure based on port
  // Port 465 uses implicit TLS, port 587 uses STARTTLS
  const secure = port === 465;

  // Load authentication credentials (optional)
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  let auth: SMTPAuth | undefined;
  if (user && pass) {
    if (user.trim().length === 0) {
      throw new Error('[EMAIL_CONFIG] SMTP_USER cannot be empty when provided');
    }
    if (pass.trim().length === 0) {
      throw new Error('[EMAIL_CONFIG] SMTP_PASSWORD cannot be empty when provided');
    }
    auth = {
      user: user.trim(),
      pass: pass.trim(),
    };
    console.log('[EMAIL_CONFIG] SMTP authentication configured');
  } else if (user || pass) {
    // If only one is provided, that's an error
    throw new Error('[EMAIL_CONFIG] Both SMTP_USER and SMTP_PASSWORD must be provided together');
  } else {
    console.log('[EMAIL_CONFIG] No SMTP authentication configured (unauthenticated mode)');
  }

  // Load sender email address (required)
  const from = process.env.EMAIL_FROM;
  if (!from || from.trim().length === 0) {
    throw new Error('[EMAIL_CONFIG] EMAIL_FROM environment variable is required');
  }

  // Validate email format (basic validation)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const fromEmail = from.includes('<') 
    ? from.match(/<([^>]+)>/)?.[1] 
    : from;

  if (!fromEmail || !emailRegex.test(fromEmail)) {
    throw new Error(`[EMAIL_CONFIG] Invalid EMAIL_FROM format: ${from}`);
  }

  // Load optional configuration with defaults
  const connectionTimeout = parseInt(process.env.EMAIL_CONNECTION_TIMEOUT || '10000', 10);
  const socketTimeout = parseInt(process.env.EMAIL_SOCKET_TIMEOUT || '10000', 10);
  const maxRetries = parseInt(process.env.EMAIL_MAX_RETRIES || '3', 10);

  const config: EmailConfig = {
    host: host.trim(),
    port,
    secure,
    auth,
    from: from.trim(),
    connectionTimeout,
    socketTimeout,
    maxRetries,
    enabled: true,
    environment,
  };

  console.log('[EMAIL_CONFIG] Email configuration loaded successfully:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    hasAuth: !!config.auth,
    from: config.from,
    enabled: config.enabled,
    environment: config.environment,
  });

  return config;
}

/**
 * Validate email configuration
 * 
 * @private
 * @param {EmailConfig} config - Email configuration to validate
 * @returns {EmailConfigValidationError[]} Array of validation errors (empty if valid)
 */
function validateEmailConfig(config: EmailConfig): EmailConfigValidationError[] {
  const errors: EmailConfigValidationError[] = [];

  // Validate host
  if (!config.host || config.host.trim().length === 0) {
    errors.push({
      field: 'host',
      message: 'SMTP host is required',
      value: config.host,
    });
  }

  // Validate port
  if (config.port < 1 || config.port > 65535) {
    errors.push({
      field: 'port',
      message: 'SMTP port must be between 1 and 65535',
      value: config.port,
    });
  }

  // Validate common ports
  const commonPorts = [25, 465, 587, 2525];
  if (!commonPorts.includes(config.port)) {
    console.warn('[EMAIL_CONFIG] Using non-standard SMTP port:', {
      port: config.port,
      commonPorts,
    });
  }

  // Validate secure flag matches port
  if (config.port === 465 && !config.secure) {
    console.warn('[EMAIL_CONFIG] Port 465 typically requires secure=true');
  }
  if (config.port === 587 && config.secure) {
    console.warn('[EMAIL_CONFIG] Port 587 typically uses STARTTLS (secure=false)');
  }

  // Validate authentication if provided
  if (config.auth) {
    if (!config.auth.user || config.auth.user.trim().length === 0) {
      errors.push({
        field: 'auth.user',
        message: 'SMTP user cannot be empty when authentication is configured',
        value: config.auth.user,
      });
    }
    if (!config.auth.pass || config.auth.pass.trim().length === 0) {
      errors.push({
        field: 'auth.pass',
        message: 'SMTP password cannot be empty when authentication is configured',
        value: '***',
      });
    }
  }

  // Validate from address
  if (!config.from || config.from.trim().length === 0) {
    errors.push({
      field: 'from',
      message: 'Email from address is required',
      value: config.from,
    });
  } else {
    // Extract email from "Name <email>" format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const fromEmail = config.from.includes('<')
      ? config.from.match(/<([^>]+)>/)?.[1]
      : config.from;

    if (!fromEmail || !emailRegex.test(fromEmail)) {
      errors.push({
        field: 'from',
        message: 'Invalid email address format',
        value: config.from,
      });
    }
  }

  // Validate timeouts
  if (config.connectionTimeout < 1000) {
    errors.push({
      field: 'connectionTimeout',
      message: 'Connection timeout must be at least 1000ms',
      value: config.connectionTimeout,
    });
  }

  if (config.socketTimeout < 1000) {
    errors.push({
      field: 'socketTimeout',
      message: 'Socket timeout must be at least 1000ms',
      value: config.socketTimeout,
    });
  }

  // Validate max retries
  if (config.maxRetries < 0 || config.maxRetries > 10) {
    errors.push({
      field: 'maxRetries',
      message: 'Max retries must be between 0 and 10',
      value: config.maxRetries,
    });
  }

  return errors;
}

/**
 * Get email configuration singleton instance
 * 
 * Loads configuration from environment variables on first call.
 * Subsequent calls return the cached instance.
 * 
 * @returns {EmailConfig} Email configuration object
 * @throws {Error} If configuration is invalid or required variables are missing
 * 
 * @example
 * const emailConfig = getEmailConfig();
 * console.log(`SMTP Host: ${emailConfig.host}:${emailConfig.port}`);
 */
export function getEmailConfig(): EmailConfig {
  if (!emailConfigInstance) {
    emailConfigInstance = loadEmailConfig();

    // Validate configuration
    const errors = validateEmailConfig(emailConfigInstance);
    if (errors.length > 0) {
      const errorMessages = errors.map(e => `  - ${e.field}: ${e.message}`).join('\n');
      console.error('[EMAIL_CONFIG] Configuration validation failed:', {
        errors,
        timestamp: new Date().toISOString(),
      });
      throw new Error(
        `[EMAIL_CONFIG] Invalid email configuration:\n${errorMessages}`
      );
    }

    console.log('[EMAIL_CONFIG] Configuration validated successfully');
  }

  return emailConfigInstance;
}

/**
 * Reset email configuration singleton
 * 
 * Forces configuration to be reloaded from environment variables
 * on next call to getEmailConfig(). Useful for testing.
 * 
 * @example
 * // In tests
 * process.env.SMTP_HOST = 'test.smtp.com';
 * resetEmailConfig();
 * const config = getEmailConfig(); // Loads new config
 */
export function resetEmailConfig(): void {
  emailConfigInstance = null;
  console.log('[EMAIL_CONFIG] Configuration reset');
}

/**
 * Check if email service is enabled
 * 
 * @returns {boolean} True if email service is enabled
 * 
 * @example
 * if (isEmailEnabled()) {
 *   await sendEmail(recipient, subject, body);
 * }
 */
export function isEmailEnabled(): boolean {
  try {
    const config = getEmailConfig();
    return config.enabled;
  } catch (error) {
    console.error('[EMAIL_CONFIG] Failed to check email status:', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Fail secure: if we can't load config, assume email is disabled
    return false;
  }
}

/**
 * Get masked email configuration for logging
 * 
 * Returns configuration with sensitive data (passwords) masked.
 * Safe to log or expose in non-production environments.
 * 
 * @returns {Record<string, unknown>} Masked configuration object
 * 
 * @example
 * console.log('Email config:', getMaskedEmailConfig());
 */
export function getMaskedEmailConfig(): Record<string, unknown> {
  try {
    const config = getEmailConfig();
    return {
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth ? {
        user: config.auth.user,
        pass: '***',
      } : undefined,
      from: config.from,
      connectionTimeout: config.connectionTimeout,
      socketTimeout: config.socketTimeout,
      maxRetries: config.maxRetries,
      enabled: config.enabled,
      environment: config.environment,
    };
  } catch (error) {
    return {
      error: 'Failed to load configuration',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Validate email configuration without throwing
 * 
 * @returns {{ valid: boolean; errors: EmailConfigValidationError[] }} Validation result
 * 
 * @example
 * const { valid, errors } = validateConfig();
 * if (!valid) {
 *   console.error('Email config errors:', errors);
 * }
 */
export function validateConfig(): {
  readonly valid: boolean;
  readonly errors: EmailConfigValidationError[];
} {
  try {
    const config = getEmailConfig();
    const errors = validateEmailConfig(config);
    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [{
        field: 'config',
        message: error instanceof Error ? error.message : String(error),
      }],
    };
  }
}

/**
 * Default export: email configuration singleton
 */
export default getEmailConfig();