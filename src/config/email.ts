/**
 * Email Configuration Module
 * 
 * Provides email/SMTP configuration for the HR application with support for
 * both authenticated and unauthenticated SMTP connections. All settings are
 * loaded from environment variables with validation on module load.
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
   * Common ports: 25 (unencrypted), 587 (STARTTLS), 465 (SSL/TLS)
   */
  readonly port: number;

  /**
   * Whether to use secure connection (SSL/TLS)
   * True for port 465, false for port 587 with STARTTLS
   */
  readonly secure: boolean;

  /**
   * SMTP authentication credentials (optional for unauthenticated SMTP)
   */
  readonly auth?: SMTPAuth;

  /**
   * Email sender address (From field)
   * Format: "Display Name <email@domain.com>" or "email@domain.com"
   */
  readonly from: string;

  /**
   * Whether authentication is required
   */
  readonly requireAuth: boolean;

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
   * Whether to enable debug logging
   */
  readonly debug: boolean;
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
    throw new Error(
      `[EMAIL_CONFIG] Invalid SMTP_PORT: ${portStr}. Must be a number between 1 and 65535`
    );
  }

  // Load email from address (required)
  const from = process.env.EMAIL_FROM;
  if (!from || from.trim().length === 0) {
    throw new Error('[EMAIL_CONFIG] EMAIL_FROM environment variable is required');
  }

  // Load SMTP authentication credentials (optional)
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;

  // Determine if authentication is required
  const requireAuth = !!(smtpUser && smtpPassword);

  let auth: SMTPAuth | undefined;
  if (requireAuth) {
    auth = {
      user: smtpUser!.trim(),
      pass: smtpPassword!.trim(),
    };
  }

  // Determine secure connection based on port
  // Port 465 uses implicit SSL/TLS, port 587 uses STARTTLS
  const secure = port === 465;

  // Load optional configuration with defaults
  const connectionTimeoutStr = process.env.SMTP_CONNECTION_TIMEOUT || '30000';
  const connectionTimeout = parseInt(connectionTimeoutStr, 10);
  if (isNaN(connectionTimeout) || connectionTimeout < 1000) {
    throw new Error(
      `[EMAIL_CONFIG] Invalid SMTP_CONNECTION_TIMEOUT: ${connectionTimeoutStr}. Must be at least 1000ms`
    );
  }

  const socketTimeoutStr = process.env.SMTP_SOCKET_TIMEOUT || '60000';
  const socketTimeout = parseInt(socketTimeoutStr, 10);
  if (isNaN(socketTimeout) || socketTimeout < 1000) {
    throw new Error(
      `[EMAIL_CONFIG] Invalid SMTP_SOCKET_TIMEOUT: ${socketTimeoutStr}. Must be at least 1000ms`
    );
  }

  const maxRetriesStr = process.env.SMTP_MAX_RETRIES || '3';
  const maxRetries = parseInt(maxRetriesStr, 10);
  if (isNaN(maxRetries) || maxRetries < 0) {
    throw new Error(
      `[EMAIL_CONFIG] Invalid SMTP_MAX_RETRIES: ${maxRetriesStr}. Must be a non-negative number`
    );
  }

  const debug = process.env.SMTP_DEBUG === 'true';

  const config: EmailConfig = {
    host: host.trim(),
    port,
    secure,
    auth,
    from: from.trim(),
    requireAuth,
    connectionTimeout,
    socketTimeout,
    maxRetries,
    debug,
  };

  console.log('[EMAIL_CONFIG] Email configuration loaded successfully:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireAuth: config.requireAuth,
    from: config.from,
    connectionTimeout: config.connectionTimeout,
    socketTimeout: config.socketTimeout,
    maxRetries: config.maxRetries,
    debug: config.debug,
    timestamp: new Date().toISOString(),
  });

  return config;
}

/**
 * Validate email configuration
 * 
 * @param {EmailConfig} config - Email configuration to validate
 * @returns {EmailConfigValidationError[]} Array of validation errors (empty if valid)
 */
export function validateEmailConfig(config: EmailConfig): EmailConfigValidationError[] {
  const errors: EmailConfigValidationError[] = [];

  // Validate host
  if (!config.host || config.host.trim().length === 0) {
    errors.push({
      field: 'host',
      message: 'SMTP host is required',
      value: config.host,
    });
  } else if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(config.host)) {
    errors.push({
      field: 'host',
      message: 'Invalid SMTP host format',
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

  // Validate common port configurations
  if (config.port === 465 && !config.secure) {
    errors.push({
      field: 'secure',
      message: 'Port 465 requires secure connection (SSL/TLS)',
      value: config.secure,
    });
  }

  if (config.port === 587 && config.secure) {
    errors.push({
      field: 'secure',
      message: 'Port 587 should use STARTTLS (secure: false)',
      value: config.secure,
    });
  }

  // Validate from address
  if (!config.from || config.from.trim().length === 0) {
    errors.push({
      field: 'from',
      message: 'Email from address is required',
      value: config.from,
    });
  } else {
    // Basic email format validation
    const emailRegex = /^(?:[^<>]+\s+)?<?([^\s@]+@[^\s@]+\.[^\s@]+)>?$/;
    if (!emailRegex.test(config.from)) {
      errors.push({
        field: 'from',
        message: 'Invalid email from address format',
        value: config.from,
      });
    }
  }

  // Validate authentication if required
  if (config.requireAuth) {
    if (!config.auth) {
      errors.push({
        field: 'auth',
        message: 'Authentication credentials are required when requireAuth is true',
        value: config.auth,
      });
    } else {
      if (!config.auth.user || config.auth.user.trim().length === 0) {
        errors.push({
          field: 'auth.user',
          message: 'SMTP username is required for authentication',
          value: config.auth.user,
        });
      }

      if (!config.auth.pass || config.auth.pass.trim().length === 0) {
        errors.push({
          field: 'auth.pass',
          message: 'SMTP password is required for authentication',
          value: '***',
        });
      }
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
  if (config.maxRetries < 0) {
    errors.push({
      field: 'maxRetries',
      message: 'Max retries must be a non-negative number',
      value: config.maxRetries,
    });
  }

  return errors;
}

/**
 * Get email configuration singleton instance
 * 
 * Loads configuration from environment variables on first call and validates it.
 * Subsequent calls return the cached instance.
 * 
 * @returns {EmailConfig} Email configuration object
 * @throws {Error} If configuration is invalid or required variables are missing
 * 
 * @example
 * const emailConfig = getEmailConfig();
 * console.log(`SMTP Host: ${emailConfig.host}`);
 * console.log(`SMTP Port: ${emailConfig.port}`);
 * console.log(`Requires Auth: ${emailConfig.requireAuth}`);
 */
export function getEmailConfig(): EmailConfig {
  if (!emailConfigInstance) {
    console.log('[EMAIL_CONFIG] Initializing email configuration...');

    try {
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

      console.log('[EMAIL_CONFIG] Email configuration validated successfully');
    } catch (error) {
      console.error('[EMAIL_CONFIG] Failed to initialize email configuration:', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  return emailConfigInstance;
}

/**
 * Reset email configuration singleton
 * 
 * Clears the cached configuration instance, forcing a reload on next access.
 * Useful for testing or when environment variables change.
 * 
 * @example
 * // In tests
 * process.env.SMTP_HOST = 'test.smtp.com';
 * resetEmailConfig();
 * const config = getEmailConfig(); // Loads new configuration
 */
export function resetEmailConfig(): void {
  emailConfigInstance = null;
  console.log('[EMAIL_CONFIG] Email configuration reset');
}

/**
 * Get masked email configuration for logging
 * 
 * Returns configuration with sensitive data (passwords) masked.
 * Safe to use in logs and error messages.
 * 
 * @returns {Record<string, unknown>} Masked configuration object
 * 
 * @example
 * const maskedConfig = getMaskedEmailConfig();
 * console.log('Email config:', maskedConfig);
 * // Output: { host: 'smtp.gmail.com', port: 587, auth: { user: 'user@example.com', pass: '***' } }
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
      requireAuth: config.requireAuth,
      connectionTimeout: config.connectionTimeout,
      socketTimeout: config.socketTimeout,
      maxRetries: config.maxRetries,
      debug: config.debug,
    };
  } catch (error) {
    return {
      error: 'Failed to load email configuration',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if email configuration is valid
 * 
 * Attempts to load and validate configuration without throwing errors.
 * 
 * @returns {boolean} True if configuration is valid, false otherwise
 * 
 * @example
 * if (isEmailConfigValid()) {
 *   const config = getEmailConfig();
 *   // Use config
 * } else {
 *   console.error('Email configuration is invalid');
 * }
 */
export function isEmailConfigValid(): boolean {
  try {
    const config = getEmailConfig();
    const errors = validateEmailConfig(config);
    return errors.length === 0;
  } catch (error) {
    console.error('[EMAIL_CONFIG] Configuration validation check failed:', {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    return false;
  }
}

/**
 * Get email configuration validation errors
 * 
 * Returns validation errors without throwing exceptions.
 * Useful for displaying configuration issues to users.
 * 
 * @returns {EmailConfigValidationError[]} Array of validation errors
 * 
 * @example
 * const errors = getEmailConfigErrors();
 * if (errors.length > 0) {
 *   console.error('Email configuration errors:');
 *   errors.forEach(err => console.error(`- ${err.field}: ${err.message}`));
 * }
 */
export function getEmailConfigErrors(): EmailConfigValidationError[] {
  try {
    const config = getEmailConfig();
    return validateEmailConfig(config);
  } catch (error) {
    return [{
      field: 'configuration',
      message: error instanceof Error ? error.message : String(error),
    }];
  }
}

// Export default configuration getter
export default getEmailConfig();