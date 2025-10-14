/**
 * Database Configuration Module
 * 
 * Provides centralized database configuration with environment-based settings,
 * connection pooling, SSL support, and connection testing utilities.
 * 
 * @module config/database
 */

import { type PoolConfig } from 'pg';

/**
 * Supported database SSL modes
 * 
 * - disable: No SSL connection
 * - allow: Try SSL, fallback to non-SSL
 * - prefer: Prefer SSL, fallback to non-SSL
 * - require: Require SSL, fail if unavailable
 * - verify-ca: Require SSL and verify CA certificate
 * - verify-full: Require SSL, verify CA and hostname
 */
export type DatabaseSSLMode =
  | 'disable'
  | 'allow'
  | 'prefer'
  | 'require'
  | 'verify-ca'
  | 'verify-full';

/**
 * Application environment types
 */
export type Environment = 'development' | 'staging' | 'production' | 'test';

/**
 * Database connection configuration interface
 */
export interface DatabaseConfig {
  /**
   * Database host (hostname or IP address)
   */
  readonly host: string;

  /**
   * Database port number
   */
  readonly port: number;

  /**
   * Database name
   */
  readonly database: string;

  /**
   * Database user
   */
  readonly user: string;

  /**
   * Database password
   */
  readonly password: string;

  /**
   * SSL mode configuration
   */
  readonly ssl: DatabaseSSLMode;

  /**
   * Connection pool configuration
   */
  readonly pool: {
    /**
     * Minimum number of connections in pool
     */
    readonly min: number;

    /**
     * Maximum number of connections in pool
     */
    readonly max: number;

    /**
     * Maximum time (ms) a connection can be idle before being closed
     */
    readonly idleTimeoutMillis: number;

    /**
     * Maximum time (ms) to wait for a connection from the pool
     */
    readonly connectionTimeoutMillis: number;

    /**
     * Maximum lifetime (ms) of a connection in the pool
     */
    readonly maxLifetimeMillis: number;
  };

  /**
   * Query timeout in milliseconds
   */
  readonly queryTimeout: number;

  /**
   * Statement timeout in milliseconds
   */
  readonly statementTimeout: number;

  /**
   * Application name for database connection tracking
   */
  readonly applicationName: string;

  /**
   * Current environment
   */
  readonly environment: Environment;

  /**
   * Enable SQL query logging
   */
  readonly enableLogging: boolean;
}

/**
 * Connection test result interface
 */
export interface ConnectionTestResult {
  /**
   * Whether connection test was successful
   */
  readonly success: boolean;

  /**
   * Connection latency in milliseconds
   */
  readonly latencyMs?: number;

  /**
   * Database server version
   */
  readonly serverVersion?: string;

  /**
   * Error message if connection failed
   */
  readonly error?: string;

  /**
   * Timestamp of the test
   */
  readonly timestamp: Date;
}

/**
 * Parse and validate database SSL mode from environment variable
 * 
 * @param sslMode - SSL mode string from environment
 * @returns Validated SSL mode
 */
function parseDatabaseSSLMode(sslMode: string | undefined): DatabaseSSLMode {
  const validModes: DatabaseSSLMode[] = [
    'disable',
    'allow',
    'prefer',
    'require',
    'verify-ca',
    'verify-full',
  ];

  const mode = (sslMode?.toLowerCase() ?? 'prefer') as DatabaseSSLMode;

  if (!validModes.includes(mode)) {
    console.warn(
      `[DATABASE_CONFIG] Invalid SSL mode "${sslMode}", defaulting to "prefer". Valid modes: ${validModes.join(', ')}`
    );
    return 'prefer';
  }

  return mode;
}

/**
 * Parse and validate environment from NODE_ENV
 * 
 * @param env - Environment string from NODE_ENV
 * @returns Validated environment
 */
function parseEnvironment(env: string | undefined): Environment {
  const validEnvironments: Environment[] = [
    'development',
    'staging',
    'production',
    'test',
  ];

  const environment = (env?.toLowerCase() ?? 'development') as Environment;

  if (!validEnvironments.includes(environment)) {
    console.warn(
      `[DATABASE_CONFIG] Invalid environment "${env}", defaulting to "development". Valid environments: ${validEnvironments.join(', ')}`
    );
    return 'development';
  }

  return environment;
}

/**
 * Parse integer from environment variable with validation
 * 
 * @param value - String value from environment
 * @param defaultValue - Default value if parsing fails
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param name - Variable name for logging
 * @returns Parsed and validated integer
 */
function parseInteger(
  value: string | undefined,
  defaultValue: number,
  min: number,
  max: number,
  name: string
): number {
  if (!value) {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    console.warn(
      `[DATABASE_CONFIG] Invalid ${name} "${value}", using default: ${defaultValue}`
    );
    return defaultValue;
  }

  if (parsed < min || parsed > max) {
    console.warn(
      `[DATABASE_CONFIG] ${name} ${parsed} out of range [${min}, ${max}], using default: ${defaultValue}`
    );
    return defaultValue;
  }

  return parsed;
}

/**
 * Parse boolean from environment variable
 * 
 * @param value - String value from environment
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed boolean
 */
function parseBoolean(
  value: string | undefined,
  defaultValue: boolean
): boolean {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.toLowerCase().trim();

  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }

  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }

  console.warn(
    `[DATABASE_CONFIG] Invalid boolean value "${value}", using default: ${defaultValue}`
  );
  return defaultValue;
}

/**
 * Parse DATABASE_URL connection string
 * 
 * Format: postgresql://[user]:[password]@[host]:[port]/[database]?[options]
 * 
 * @param url - Database URL string
 * @returns Parsed connection parameters or null if invalid
 */
function parseDatabaseURL(url: string | undefined): {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
} | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
      console.warn(
        `[DATABASE_CONFIG] Invalid DATABASE_URL protocol: ${parsed.protocol}`
      );
      return null;
    }

    const host = parsed.hostname;
    const port = parsed.port ? parseInt(parsed.port, 10) : 5432;
    const database = parsed.pathname.slice(1); // Remove leading slash
    const user = decodeURIComponent(parsed.username);
    const password = decodeURIComponent(parsed.password);

    if (!host || !database || !user) {
      console.warn(
        '[DATABASE_CONFIG] DATABASE_URL missing required components'
      );
      return null;
    }

    return { host, port, database, user, password };
  } catch (error) {
    console.error(
      '[DATABASE_CONFIG] Failed to parse DATABASE_URL:',
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

/**
 * Get environment-specific pool configuration
 * 
 * @param environment - Current environment
 * @returns Pool configuration for the environment
 */
function getPoolConfigForEnvironment(environment: Environment): {
  min: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  maxLifetimeMillis: number;
} {
  switch (environment) {
    case 'production':
      return {
        min: 10,
        max: 50,
        idleTimeoutMillis: 30000, // 30 seconds
        connectionTimeoutMillis: 10000, // 10 seconds
        maxLifetimeMillis: 1800000, // 30 minutes
      };

    case 'staging':
      return {
        min: 5,
        max: 25,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        maxLifetimeMillis: 1800000,
      };

    case 'test':
      return {
        min: 1,
        max: 5,
        idleTimeoutMillis: 10000, // 10 seconds
        connectionTimeoutMillis: 5000, // 5 seconds
        maxLifetimeMillis: 600000, // 10 minutes
      };

    case 'development':
    default:
      return {
        min: 2,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        maxLifetimeMillis: 1800000,
      };
  }
}

/**
 * Load and validate database configuration from environment variables
 * 
 * Priority:
 * 1. DATABASE_URL (if provided, overrides individual variables)
 * 2. Individual DB_* environment variables
 * 3. Default values
 * 
 * @returns Complete database configuration
 * @throws Error if required configuration is missing
 */
function loadDatabaseConfig(): DatabaseConfig {
  const environment = parseEnvironment(process.env.NODE_ENV);

  // Try to parse DATABASE_URL first
  const urlConfig = parseDatabaseURL(process.env.DATABASE_URL);

  // Get connection parameters (DATABASE_URL takes precedence)
  const host = urlConfig?.host ?? process.env.DB_HOST ?? 'localhost';
  const port =
    urlConfig?.port ??
    parseInteger(process.env.DB_PORT, 5432, 1024, 65535, 'DB_PORT');
  const database = urlConfig?.database ?? process.env.DB_NAME ?? 'hrapp_db';
  const user = urlConfig?.user ?? process.env.DB_USER ?? 'hrapp_user';
  const password = urlConfig?.password ?? process.env.DB_PASSWORD ?? '';

  // Validate required fields
  if (!password && environment === 'production') {
    throw new Error(
      '[DATABASE_CONFIG] FATAL: Database password is required in production environment. Set DATABASE_URL or DB_PASSWORD environment variable.'
    );
  }

  if (!password) {
    console.warn(
      '[DATABASE_CONFIG] WARNING: Database password is not set. This is acceptable for development but should never happen in production.'
    );
  }

  // Get SSL configuration
  const ssl = parseDatabaseSSLMode(process.env.DB_SSL);

  // Get pool configuration
  const defaultPoolConfig = getPoolConfigForEnvironment(environment);
  const pool = {
    min: parseInteger(
      process.env.DB_POOL_MIN,
      defaultPoolConfig.min,
      1,
      100,
      'DB_POOL_MIN'
    ),
    max: parseInteger(
      process.env.DB_POOL_MAX,
      defaultPoolConfig.max,
      1,
      200,
      'DB_POOL_MAX'
    ),
    idleTimeoutMillis: parseInteger(
      process.env.DB_POOL_IDLE_TIMEOUT,
      defaultPoolConfig.idleTimeoutMillis,
      1000,
      3600000,
      'DB_POOL_IDLE_TIMEOUT'
    ),
    connectionTimeoutMillis: parseInteger(
      process.env.DB_POOL_CONNECTION_TIMEOUT,
      defaultPoolConfig.connectionTimeoutMillis,
      1000,
      60000,
      'DB_POOL_CONNECTION_TIMEOUT'
    ),
    maxLifetimeMillis: parseInteger(
      process.env.DB_POOL_MAX_LIFETIME,
      defaultPoolConfig.maxLifetimeMillis,
      60000,
      7200000,
      'DB_POOL_MAX_LIFETIME'
    ),
  };

  // Validate pool configuration
  if (pool.min > pool.max) {
    console.warn(
      `[DATABASE_CONFIG] Pool min (${pool.min}) is greater than max (${pool.max}), adjusting min to ${pool.max}`
    );
    pool.min = pool.max;
  }

  // Get timeout configuration
  const queryTimeout = parseInteger(
    process.env.DB_QUERY_TIMEOUT,
    30000, // 30 seconds default
    1000,
    300000,
    'DB_QUERY_TIMEOUT'
  );

  const statementTimeout = parseInteger(
    process.env.DB_STATEMENT_TIMEOUT,
    60000, // 60 seconds default
    1000,
    600000,
    'DB_STATEMENT_TIMEOUT'
  );

  // Get logging configuration
  const enableLogging = parseBoolean(
    process.env.SQL_LOGGING,
    environment === 'development'
  );

  const config: DatabaseConfig = {
    host,
    port,
    database,
    user,
    password,
    ssl,
    pool,
    queryTimeout,
    statementTimeout,
    applicationName: 'hr-app',
    environment,
    enableLogging,
  };

  // Log configuration (excluding sensitive data)
  console.log('[DATABASE_CONFIG] Database configuration loaded:', {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    ssl: config.ssl,
    pool: config.pool,
    queryTimeout: config.queryTimeout,
    statementTimeout: config.statementTimeout,
    applicationName: config.applicationName,
    environment: config.environment,
    enableLogging: config.enableLogging,
    passwordSet: config.password.length > 0,
  });

  return config;
}

/**
 * Convert DatabaseConfig to pg PoolConfig
 * 
 * @param config - Database configuration
 * @returns pg-compatible pool configuration
 */
export function toPgPoolConfig(config: DatabaseConfig): PoolConfig {
  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    min: config.pool.min,
    max: config.pool.max,
    idleTimeoutMillis: config.pool.idleTimeoutMillis,
    connectionTimeoutMillis: config.pool.connectionTimeoutMillis,
    application_name: config.applicationName,
    query_timeout: config.queryTimeout,
    statement_timeout: config.statementTimeout,
  };

  // Configure SSL based on mode
  if (config.ssl !== 'disable') {
    if (config.ssl === 'require' || config.ssl === 'verify-ca' || config.ssl === 'verify-full') {
      poolConfig.ssl = {
        rejectUnauthorized: config.ssl !== 'require',
      };
    } else {
      // For 'allow' and 'prefer', let pg handle it
      poolConfig.ssl = config.ssl === 'prefer';
    }
  }

  return poolConfig;
}

/**
 * Test database connection
 * 
 * @param config - Database configuration to test
 * @returns Connection test result
 */
export async function testConnection(
  config: DatabaseConfig
): Promise<ConnectionTestResult> {
  const startTime = Date.now();
  const timestamp = new Date();

  try {
    // Dynamic import to avoid loading pg if not needed
    const { Pool } = await import('pg');

    const pool = new Pool(toPgPoolConfig(config));

    try {
      // Test connection with simple query
      const client = await pool.connect();

      try {
        const result = await client.query('SELECT version() as version, now() as server_time');
        const latencyMs = Date.now() - startTime;
        const serverVersion = result.rows[0]?.version as string | undefined;

        console.log('[DATABASE_CONFIG] Connection test successful:', {
          latencyMs,
          serverVersion: serverVersion?.split(',')[0], // First part of version string
          timestamp: timestamp.toISOString(),
        });

        return {
          success: true,
          latencyMs,
          serverVersion: serverVersion?.split(',')[0],
          timestamp,
        };
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    console.error('[DATABASE_CONFIG] Connection test failed:', {
      error: errorMessage,
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      timestamp: timestamp.toISOString(),
    });

    return {
      success: false,
      error: errorMessage,
      timestamp,
    };
  }
}

/**
 * Validate database configuration
 * 
 * @param config - Database configuration to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateConfig(config: DatabaseConfig): string[] {
  const errors: string[] = [];

  if (!config.host || config.host.trim().length === 0) {
    errors.push('Database host is required');
  }

  if (config.port < 1024 || config.port > 65535) {
    errors.push('Database port must be between 1024 and 65535');
  }

  if (!config.database || config.database.trim().length === 0) {
    errors.push('Database name is required');
  }

  if (!config.user || config.user.trim().length === 0) {
    errors.push('Database user is required');
  }

  if (config.environment === 'production' && !config.password) {
    errors.push('Database password is required in production');
  }

  if (config.pool.min < 1) {
    errors.push('Pool minimum must be at least 1');
  }

  if (config.pool.max < config.pool.min) {
    errors.push('Pool maximum must be greater than or equal to minimum');
  }

  if (config.queryTimeout < 1000) {
    errors.push('Query timeout must be at least 1000ms');
  }

  if (config.statementTimeout < 1000) {
    errors.push('Statement timeout must be at least 1000ms');
  }

  return errors;
}

/**
 * Get database connection string (with password masked)
 * 
 * @param config - Database configuration
 * @returns Masked connection string for logging
 */
export function getConnectionString(config: DatabaseConfig): string {
  const maskedPassword = config.password ? '***' : '';
  return `postgresql://${config.user}:${maskedPassword}@${config.host}:${config.port}/${config.database}`;
}

/**
 * Singleton database configuration instance
 */
let databaseConfigInstance: DatabaseConfig | null = null;

/**
 * Get database configuration singleton
 * 
 * Loads configuration on first call and caches it for subsequent calls.
 * 
 * @returns Database configuration
 * @throws Error if configuration is invalid
 */
export function getDatabaseConfig(): DatabaseConfig {
  if (!databaseConfigInstance) {
    databaseConfigInstance = loadDatabaseConfig();

    // Validate configuration
    const errors = validateConfig(databaseConfigInstance);
    if (errors.length > 0) {
      throw new Error(
        `[DATABASE_CONFIG] Invalid database configuration:\n${errors.join('\n')}`
      );
    }
  }

  return databaseConfigInstance;
}

/**
 * Reset database configuration singleton (for testing)
 * 
 * @internal
 */
export function resetDatabaseConfig(): void {
  databaseConfigInstance = null;
}

/**
 * Default export: database configuration singleton
 */
export default getDatabaseConfig();