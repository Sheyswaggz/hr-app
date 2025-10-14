/**
 * Database Connection Module
 * 
 * Provides centralized database connection management with connection pooling,
 * query helpers with TypeScript generics, transaction support, and graceful shutdown.
 * 
 * @module db
 */

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

import { getDatabaseConfig, toPgPoolConfig, type DatabaseConfig } from '../config/database.js';

/**
 * Query execution context for logging and tracing
 */
export interface QueryContext {
  /**
   * Unique identifier for the query execution
   */
  readonly queryId: string;

  /**
   * SQL query text (parameterized)
   */
  readonly query: string;

  /**
   * Query parameters
   */
  readonly params?: unknown[];

  /**
   * Timestamp when query started
   */
  readonly startTime: number;

  /**
   * Optional correlation ID for request tracing
   */
  readonly correlationId?: string;

  /**
   * Optional operation name for logging
   */
  readonly operation?: string;
}

/**
 * Query execution result with metadata
 */
export interface QueryExecutionResult<T extends QueryResultRow = QueryResultRow> {
  /**
   * Query result rows
   */
  readonly rows: T[];

  /**
   * Number of rows affected
   */
  readonly rowCount: number;

  /**
   * Query execution time in milliseconds
   */
  readonly executionTimeMs: number;

  /**
   * Query context
   */
  readonly context: QueryContext;
}

/**
 * Transaction callback function type
 */
export type TransactionCallback<T> = (client: PoolClient) => Promise<T>;

/**
 * Transaction options
 */
export interface TransactionOptions {
  /**
   * Transaction isolation level
   */
  readonly isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';

  /**
   * Transaction timeout in milliseconds
   */
  readonly timeout?: number;

  /**
   * Optional correlation ID for tracing
   */
  readonly correlationId?: string;

  /**
   * Optional operation name for logging
   */
  readonly operation?: string;
}

/**
 * Database pool statistics
 */
export interface PoolStats {
  /**
   * Total number of clients in the pool
   */
  readonly totalCount: number;

  /**
   * Number of idle clients
   */
  readonly idleCount: number;

  /**
   * Number of clients waiting for a connection
   */
  readonly waitingCount: number;

  /**
   * Timestamp when stats were collected
   */
  readonly timestamp: Date;
}

/**
 * Database health check result
 */
export interface DatabaseHealthCheck {
  /**
   * Whether database is healthy
   */
  readonly healthy: boolean;

  /**
   * Connection latency in milliseconds
   */
  readonly latencyMs?: number;

  /**
   * Pool statistics
   */
  readonly poolStats?: PoolStats;

  /**
   * Error message if unhealthy
   */
  readonly error?: string;

  /**
   * Timestamp of health check
   */
  readonly timestamp: Date;
}

/**
 * Singleton database pool instance
 */
let poolInstance: Pool | null = null;

/**
 * Database configuration instance
 */
let configInstance: DatabaseConfig | null = null;

/**
 * Shutdown flag to prevent new operations during shutdown
 */
let isShuttingDown = false;

/**
 * Active query counter for graceful shutdown
 */
let activeQueryCount = 0;

/**
 * Generate unique query ID for tracing
 * 
 * @returns Unique query identifier
 */
function generateQueryId(): string {
  return `query_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Log query execution with structured context
 * 
 * @param context - Query execution context
 * @param result - Query result
 * @param error - Optional error if query failed
 */
function logQueryExecution(
  context: QueryContext,
  result?: QueryResult,
  error?: Error
): void {
  const executionTimeMs = Date.now() - context.startTime;
  const config = configInstance;

  if (!config?.enableLogging) {
    return;
  }

  const logData = {
    queryId: context.queryId,
    operation: context.operation,
    correlationId: context.correlationId,
    executionTimeMs,
    rowCount: result?.rowCount ?? 0,
    success: !error,
    error: error ? {
      message: error.message,
      code: (error as any).code,
      detail: (error as any).detail,
    } : undefined,
    timestamp: new Date().toISOString(),
  };

  if (error) {
    console.error('[DATABASE] Query execution failed:', logData);
  } else {
    console.log('[DATABASE] Query executed:', logData);
  }
}

/**
 * Initialize database connection pool
 * 
 * Creates a new connection pool using the database configuration.
 * This function is idempotent - calling it multiple times returns the same pool.
 * 
 * @returns Database connection pool
 * @throws Error if pool initialization fails
 */
export function initializePool(): Pool {
  if (poolInstance) {
    console.log('[DATABASE] Returning existing pool instance');
    return poolInstance;
  }

  if (isShuttingDown) {
    throw new Error('[DATABASE] Cannot initialize pool during shutdown');
  }

  try {
    console.log('[DATABASE] Initializing database connection pool...');

    configInstance = getDatabaseConfig();
    const poolConfig = toPgPoolConfig(configInstance);

    poolInstance = new Pool(poolConfig);

    // Set up pool event handlers
    poolInstance.on('connect', (client) => {
      console.log('[DATABASE] New client connected to pool', {
        totalCount: poolInstance?.totalCount ?? 0,
        idleCount: poolInstance?.idleCount ?? 0,
        waitingCount: poolInstance?.waitingCount ?? 0,
      });
    });

    poolInstance.on('acquire', (client) => {
      if (configInstance?.enableLogging) {
        console.log('[DATABASE] Client acquired from pool', {
          totalCount: poolInstance?.totalCount ?? 0,
          idleCount: poolInstance?.idleCount ?? 0,
          waitingCount: poolInstance?.waitingCount ?? 0,
        });
      }
    });

    poolInstance.on('remove', (client) => {
      console.log('[DATABASE] Client removed from pool', {
        totalCount: poolInstance?.totalCount ?? 0,
        idleCount: poolInstance?.idleCount ?? 0,
        waitingCount: poolInstance?.waitingCount ?? 0,
      });
    });

    poolInstance.on('error', (error, client) => {
      console.error('[DATABASE] Unexpected pool error:', {
        error: error.message,
        code: (error as any).code,
        timestamp: new Date().toISOString(),
      });
    });

    console.log('[DATABASE] Database connection pool initialized successfully', {
      host: configInstance.host,
      port: configInstance.port,
      database: configInstance.database,
      poolMin: configInstance.pool.min,
      poolMax: configInstance.pool.max,
    });

    return poolInstance;
  } catch (error) {
    console.error('[DATABASE] Failed to initialize pool:', {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    throw new Error(
      `[DATABASE] Pool initialization failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get database connection pool
 * 
 * Returns the existing pool or initializes a new one if not exists.
 * 
 * @returns Database connection pool
 */
export function getPool(): Pool {
  if (!poolInstance) {
    return initializePool();
  }
  return poolInstance;
}

/**
 * Execute a SQL query with type-safe results
 * 
 * @template T - Expected row type
 * @param query - SQL query string (parameterized)
 * @param params - Query parameters
 * @param options - Optional query options
 * @returns Query execution result with metadata
 * @throws Error if query execution fails
 */
export async function executeQuery<T extends QueryResultRow = QueryResultRow>(
  query: string,
  params?: unknown[],
  options?: {
    readonly correlationId?: string;
    readonly operation?: string;
  }
): Promise<QueryExecutionResult<T>> {
  if (isShuttingDown) {
    throw new Error('[DATABASE] Cannot execute query during shutdown');
  }

  const pool = getPool();
  const context: QueryContext = {
    queryId: generateQueryId(),
    query,
    params,
    startTime: Date.now(),
    correlationId: options?.correlationId,
    operation: options?.operation,
  };

  activeQueryCount++;

  try {
    console.log('[DATABASE] Executing query:', {
      queryId: context.queryId,
      operation: context.operation,
      correlationId: context.correlationId,
      paramCount: params?.length ?? 0,
    });

    const result = await pool.query<T>(query, params);
    const executionTimeMs = Date.now() - context.startTime;

    logQueryExecution(context, result);

    return {
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
      executionTimeMs,
      context,
    };
  } catch (error) {
    logQueryExecution(context, undefined, error as Error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as any).code;
    const errorDetail = (error as any).detail;

    console.error('[DATABASE] Query execution error:', {
      queryId: context.queryId,
      operation: context.operation,
      correlationId: context.correlationId,
      error: errorMessage,
      code: errorCode,
      detail: errorDetail,
      executionTimeMs: Date.now() - context.startTime,
    });

    throw new Error(
      `[DATABASE] Query execution failed: ${errorMessage}${errorCode ? ` (${errorCode})` : ''}`
    );
  } finally {
    activeQueryCount--;
  }
}

/**
 * Execute a query and return a single row
 * 
 * @template T - Expected row type
 * @param query - SQL query string (parameterized)
 * @param params - Query parameters
 * @param options - Optional query options
 * @returns Single row or null if not found
 * @throws Error if query returns multiple rows
 */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  query: string,
  params?: unknown[],
  options?: {
    readonly correlationId?: string;
    readonly operation?: string;
  }
): Promise<T | null> {
  const result = await executeQuery<T>(query, params, options);

  if (result.rowCount === 0) {
    return null;
  }

  if (result.rowCount > 1) {
    throw new Error(
      `[DATABASE] Expected single row but got ${result.rowCount} rows (queryId: ${result.context.queryId})`
    );
  }

  return result.rows[0] ?? null;
}

/**
 * Execute a query and return multiple rows
 * 
 * @template T - Expected row type
 * @param query - SQL query string (parameterized)
 * @param params - Query parameters
 * @param options - Optional query options
 * @returns Array of rows
 */
export async function queryMany<T extends QueryResultRow = QueryResultRow>(
  query: string,
  params?: unknown[],
  options?: {
    readonly correlationId?: string;
    readonly operation?: string;
  }
): Promise<T[]> {
  const result = await executeQuery<T>(query, params, options);
  return result.rows;
}

/**
 * Execute a transaction with automatic rollback on error
 * 
 * @template T - Transaction result type
 * @param callback - Transaction callback function
 * @param options - Optional transaction options
 * @returns Transaction result
 * @throws Error if transaction fails
 */
export async function executeTransaction<T>(
  callback: TransactionCallback<T>,
  options?: TransactionOptions
): Promise<T> {
  if (isShuttingDown) {
    throw new Error('[DATABASE] Cannot execute transaction during shutdown');
  }

  const pool = getPool();
  const transactionId = generateQueryId();
  const startTime = Date.now();

  activeQueryCount++;

  let client: PoolClient | null = null;

  try {
    console.log('[DATABASE] Starting transaction:', {
      transactionId,
      isolationLevel: options?.isolationLevel,
      timeout: options?.timeout,
      correlationId: options?.correlationId,
      operation: options?.operation,
    });

    // Acquire client from pool
    client = await pool.connect();

    // Set transaction timeout if specified
    if (options?.timeout) {
      await client.query(`SET LOCAL statement_timeout = ${options.timeout}`);
    }

    // Begin transaction with isolation level
    const isolationLevel = options?.isolationLevel ?? 'READ COMMITTED';
    await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);

    // Execute transaction callback
    const result = await callback(client);

    // Commit transaction
    await client.query('COMMIT');

    const executionTimeMs = Date.now() - startTime;

    console.log('[DATABASE] Transaction committed:', {
      transactionId,
      executionTimeMs,
      correlationId: options?.correlationId,
      operation: options?.operation,
    });

    return result;
  } catch (error) {
    // Rollback transaction on error
    if (client) {
      try {
        await client.query('ROLLBACK');
        console.log('[DATABASE] Transaction rolled back:', {
          transactionId,
          error: error instanceof Error ? error.message : String(error),
          executionTimeMs: Date.now() - startTime,
        });
      } catch (rollbackError) {
        console.error('[DATABASE] Rollback failed:', {
          transactionId,
          rollbackError: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        });
      }
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as any).code;

    console.error('[DATABASE] Transaction failed:', {
      transactionId,
      error: errorMessage,
      code: errorCode,
      correlationId: options?.correlationId,
      operation: options?.operation,
      executionTimeMs: Date.now() - startTime,
    });

    throw new Error(
      `[DATABASE] Transaction failed: ${errorMessage}${errorCode ? ` (${errorCode})` : ''}`
    );
  } finally {
    // Release client back to pool
    if (client) {
      client.release();
    }
    activeQueryCount--;
  }
}

/**
 * Test database connection
 * 
 * @returns Connection test result
 */
export async function testConnection(): Promise<DatabaseHealthCheck> {
  const timestamp = new Date();
  const startTime = Date.now();

  try {
    const pool = getPool();
    const result = await pool.query('SELECT 1 as test, now() as server_time');
    const latencyMs = Date.now() - startTime;

    const poolStats: PoolStats = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      timestamp,
    };

    console.log('[DATABASE] Connection test successful:', {
      latencyMs,
      poolStats,
      timestamp: timestamp.toISOString(),
    });

    return {
      healthy: true,
      latencyMs,
      poolStats,
      timestamp,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[DATABASE] Connection test failed:', {
      error: errorMessage,
      timestamp: timestamp.toISOString(),
    });

    return {
      healthy: false,
      error: errorMessage,
      timestamp,
    };
  }
}

/**
 * Get current pool statistics
 * 
 * @returns Pool statistics
 */
export function getPoolStats(): PoolStats {
  const pool = getPool();

  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    timestamp: new Date(),
  };
}

/**
 * Gracefully shutdown database connection pool
 * 
 * Waits for active queries to complete before closing the pool.
 * 
 * @param options - Shutdown options
 * @returns Promise that resolves when shutdown is complete
 */
export async function shutdown(options?: {
  readonly timeout?: number;
  readonly force?: boolean;
}): Promise<void> {
  if (isShuttingDown) {
    console.warn('[DATABASE] Shutdown already in progress');
    return;
  }

  if (!poolInstance) {
    console.log('[DATABASE] No pool to shutdown');
    return;
  }

  isShuttingDown = true;
  const timeout = options?.timeout ?? 30000; // 30 seconds default
  const startTime = Date.now();

  console.log('[DATABASE] Starting graceful shutdown...', {
    activeQueryCount,
    timeout,
    force: options?.force ?? false,
  });

  try {
    // Wait for active queries to complete (unless force shutdown)
    if (!options?.force && activeQueryCount > 0) {
      console.log('[DATABASE] Waiting for active queries to complete...', {
        activeQueryCount,
      });

      const checkInterval = 100; // Check every 100ms
      while (activeQueryCount > 0 && Date.now() - startTime < timeout) {
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      }

      if (activeQueryCount > 0) {
        console.warn('[DATABASE] Shutdown timeout reached with active queries:', {
          activeQueryCount,
          elapsedMs: Date.now() - startTime,
        });
      }
    }

    // End pool
    await poolInstance.end();
    poolInstance = null;
    configInstance = null;

    console.log('[DATABASE] Database connection pool closed successfully', {
      elapsedMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('[DATABASE] Error during shutdown:', {
      error: error instanceof Error ? error.message : String(error),
      elapsedMs: Date.now() - startTime,
    });
    throw new Error(
      `[DATABASE] Shutdown failed: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    isShuttingDown = false;
  }
}

/**
 * Check if database is shutting down
 * 
 * @returns True if shutdown is in progress
 */
export function isShutdownInProgress(): boolean {
  return isShuttingDown;
}

/**
 * Get active query count
 * 
 * @returns Number of currently executing queries
 */
export function getActiveQueryCount(): number {
  return activeQueryCount;
}

/**
 * Default export: database pool instance
 */
export default getPool();