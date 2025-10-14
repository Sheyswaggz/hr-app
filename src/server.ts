/**
 * HTTP Server Entry Point Module
 * 
 * Initializes and starts the HTTP server with graceful shutdown handling,
 * database connection management, and comprehensive error recovery.
 * 
 * Features:
 * - Express application server startup
 * - Database connection initialization and health checks
 * - Graceful shutdown with cleanup
 * - Signal handling (SIGTERM, SIGINT)
 * - Uncaught exception and unhandled rejection handling
 * - Structured logging with correlation IDs
 * - Port conflict detection and recovery
 * - Health check endpoint verification
 * 
 * @module server
 */

import { type Server } from 'http';

import { app } from './app.js';
import { initializePool, testConnection, shutdown as shutdownDatabase } from './db/index.js';

/**
 * Environment Configuration
 * 
 * Loads server configuration from environment variables with sensible defaults.
 */
const ENV = {
  /**
   * Node environment (development, staging, production, test)
   */
  NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'staging' | 'production' | 'test',

  /**
   * Server port number
   */
  PORT: parseInt(process.env.PORT || '3000', 10),

  /**
   * Server host address
   */
  HOST: process.env.HOST || '0.0.0.0',

  /**
   * Graceful shutdown timeout in milliseconds
   */
  SHUTDOWN_TIMEOUT: parseInt(process.env.SHUTDOWN_TIMEOUT || '30000', 10),

  /**
   * Database connection timeout in milliseconds
   */
  DB_CONNECTION_TIMEOUT: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),

  /**
   * Enable database connection on startup
   */
  ENABLE_DATABASE: process.env.ENABLE_DATABASE !== 'false',

  /**
   * Enable health check verification on startup
   */
  ENABLE_HEALTH_CHECK: process.env.ENABLE_HEALTH_CHECK !== 'false',
} as const;

/**
 * Server state tracking
 */
let serverInstance: Server | null = null;
let isShuttingDown = false;
let shutdownTimeout: NodeJS.Timeout | null = null;

/**
 * Initialize Database Connection
 * 
 * Establishes database connection pool and verifies connectivity.
 * Implements retry logic with exponential backoff for connection failures.
 * 
 * @returns {Promise<boolean>} True if database connection successful
 */
async function initializeDatabase(): Promise<boolean> {
  if (!ENV.ENABLE_DATABASE) {
    console.log('[SERVER] Database connection disabled (ENABLE_DATABASE=false)');
    return true;
  }

  console.log('[SERVER] Initializing database connection...');

  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Initialize connection pool
      initializePool();

      // Test connection with timeout
      const connectionPromise = testConnection();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Database connection timeout')), ENV.DB_CONNECTION_TIMEOUT);
      });

      const healthCheck = await Promise.race([connectionPromise, timeoutPromise]);

      if (!healthCheck.healthy) {
        throw new Error(`Database health check failed: ${healthCheck.error}`);
      }

      console.log('[SERVER] Database connection established successfully:', {
        latencyMs: healthCheck.latencyMs,
        poolStats: healthCheck.poolStats,
        timestamp: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`[SERVER] Database connection attempt ${attempt}/${maxRetries} failed:`, {
        error: errorMessage,
        attempt,
        timestamp: new Date().toISOString(),
      });

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`[SERVER] Retrying database connection in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('[SERVER] FATAL: Failed to establish database connection after all retries');
        return false;
      }
    }
  }

  return false;
}

/**
 * Verify Health Check Endpoint
 * 
 * Makes a request to the health check endpoint to verify server is responding.
 * 
 * @returns {Promise<boolean>} True if health check successful
 */
async function verifyHealthCheck(): Promise<boolean> {
  if (!ENV.ENABLE_HEALTH_CHECK) {
    console.log('[SERVER] Health check verification disabled (ENABLE_HEALTH_CHECK=false)');
    return true;
  }

  try {
    console.log('[SERVER] Verifying health check endpoint...');

    const response = await fetch(`http://${ENV.HOST === '0.0.0.0' ? 'localhost' : ENV.HOST}:${ENV.PORT}/health`);

    if (!response.ok) {
      throw new Error(`Health check returned status ${response.status}`);
    }

    const data = await response.json();

    console.log('[SERVER] Health check endpoint verified:', {
      status: data.status,
      timestamp: data.timestamp,
    });

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[SERVER] Health check verification failed:', {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    return false;
  }
}

/**
 * Start HTTP Server
 * 
 * Starts the Express application server and binds to configured port.
 * Implements error handling for port conflicts and binding failures.
 * 
 * @returns {Promise<Server>} HTTP server instance
 * @throws {Error} If server fails to start
 */
async function startServer(): Promise<Server> {
  return new Promise((resolve, reject) => {
    console.log('[SERVER] Starting HTTP server...', {
      host: ENV.HOST,
      port: ENV.PORT,
      environment: ENV.NODE_ENV,
      timestamp: new Date().toISOString(),
    });

    const server = app.listen(ENV.PORT, ENV.HOST, () => {
      console.log('[SERVER] HTTP server started successfully:', {
        host: ENV.HOST,
        port: ENV.PORT,
        environment: ENV.NODE_ENV,
        processId: process.pid,
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
      });

      resolve(server);
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error('[SERVER] FATAL: Port already in use:', {
          port: ENV.PORT,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
        reject(new Error(`Port ${ENV.PORT} is already in use. Please choose a different port or stop the conflicting process.`));
      } else if (error.code === 'EACCES') {
        console.error('[SERVER] FATAL: Permission denied:', {
          port: ENV.PORT,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
        reject(new Error(`Permission denied to bind to port ${ENV.PORT}. Try using a port number above 1024 or run with elevated privileges.`));
      } else {
        console.error('[SERVER] FATAL: Server error:', {
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString(),
        });
        reject(error);
      }
    });

    // Handle connection errors
    server.on('clientError', (error: Error, socket) => {
      console.error('[SERVER] Client connection error:', {
        error: error.message,
        remoteAddress: socket.remoteAddress,
        timestamp: new Date().toISOString(),
      });

      // Close socket on client error
      if (!socket.destroyed) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      }
    });
  });
}

/**
 * Graceful Shutdown Handler
 * 
 * Handles graceful shutdown of the server and all resources.
 * Ensures all connections are closed and cleanup is performed.
 * 
 * @param {string} signal - Signal that triggered shutdown
 * @returns {Promise<void>}
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    console.warn('[SERVER] Shutdown already in progress, ignoring signal:', signal);
    return;
  }

  isShuttingDown = true;

  console.log('[SERVER] Received shutdown signal:', {
    signal,
    timestamp: new Date().toISOString(),
  });

  // Set shutdown timeout
  shutdownTimeout = setTimeout(() => {
    console.error('[SERVER] FATAL: Shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, ENV.SHUTDOWN_TIMEOUT);

  try {
    // Stop accepting new connections
    if (serverInstance) {
      console.log('[SERVER] Closing HTTP server...');

      await new Promise<void>((resolve, reject) => {
        serverInstance!.close((error) => {
          if (error) {
            console.error('[SERVER] Error closing HTTP server:', {
              error: error.message,
              timestamp: new Date().toISOString(),
            });
            reject(error);
          } else {
            console.log('[SERVER] HTTP server closed successfully');
            resolve();
          }
        });
      });
    }

    // Close database connections
    if (ENV.ENABLE_DATABASE) {
      console.log('[SERVER] Closing database connections...');
      await shutdownDatabase({
        timeout: ENV.SHUTDOWN_TIMEOUT - 5000, // Leave 5 seconds buffer
        force: false,
      });
      console.log('[SERVER] Database connections closed successfully');
    }

    // Clear shutdown timeout
    if (shutdownTimeout) {
      clearTimeout(shutdownTimeout);
      shutdownTimeout = null;
    }

    console.log('[SERVER] Graceful shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('[SERVER] FATAL: Error during graceful shutdown:', {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });

    // Clear shutdown timeout
    if (shutdownTimeout) {
      clearTimeout(shutdownTimeout);
      shutdownTimeout = null;
    }

    process.exit(1);
  }
}

/**
 * Setup Signal Handlers
 * 
 * Registers handlers for process signals to enable graceful shutdown.
 */
function setupSignalHandlers(): void {
  // Handle SIGTERM (graceful shutdown)
  process.on('SIGTERM', () => {
    console.log('[SERVER] SIGTERM signal received');
    void gracefulShutdown('SIGTERM');
  });

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    console.log('[SERVER] SIGINT signal received');
    void gracefulShutdown('SIGINT');
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    console.error('[SERVER] FATAL: Uncaught exception:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    // Attempt graceful shutdown
    void gracefulShutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    console.error('[SERVER] FATAL: Unhandled promise rejection:', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Attempt graceful shutdown
    void gracefulShutdown('unhandledRejection');
  });

  console.log('[SERVER] Signal handlers registered successfully');
}

/**
 * Main Server Initialization
 * 
 * Orchestrates the complete server startup sequence:
 * 1. Setup signal handlers
 * 2. Initialize database connection
 * 3. Start HTTP server
 * 4. Verify health check endpoint
 * 
 * @returns {Promise<void>}
 */
async function main(): Promise<void> {
  console.log('[SERVER] ============================================================');
  console.log('[SERVER] Starting HR Application Server');
  console.log('[SERVER] ============================================================');
  console.log('[SERVER] Environment:', {
    nodeEnv: ENV.NODE_ENV,
    nodeVersion: process.version,
    platform: process.platform,
    processId: process.pid,
    timestamp: new Date().toISOString(),
  });

  try {
    // Setup signal handlers
    setupSignalHandlers();

    // Initialize database connection
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      throw new Error('Failed to initialize database connection');
    }

    // Start HTTP server
    serverInstance = await startServer();

    // Verify health check endpoint
    const healthCheckVerified = await verifyHealthCheck();
    if (!healthCheckVerified) {
      console.warn('[SERVER] WARNING: Health check verification failed, but server is running');
    }

    console.log('[SERVER] ============================================================');
    console.log('[SERVER] Server is ready to accept connections');
    console.log('[SERVER] ============================================================');
    console.log('[SERVER] Server URL:', `http://${ENV.HOST === '0.0.0.0' ? 'localhost' : ENV.HOST}:${ENV.PORT}`);
    console.log('[SERVER] Health Check:', `http://${ENV.HOST === '0.0.0.0' ? 'localhost' : ENV.HOST}:${ENV.PORT}/health`);
    console.log('[SERVER] API Base:', `http://${ENV.HOST === '0.0.0.0' ? 'localhost' : ENV.HOST}:${ENV.PORT}/api`);
    console.log('[SERVER] ============================================================');
  } catch (error) {
    console.error('[SERVER] FATAL: Server initialization failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Attempt cleanup
    try {
      if (ENV.ENABLE_DATABASE) {
        await shutdownDatabase({ timeout: 5000, force: true });
      }
    } catch (cleanupError) {
      console.error('[SERVER] Error during cleanup:', {
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    }

    process.exit(1);
  }
}

/**
 * Execute main function
 * 
 * Only run if this module is the main entry point.
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

/**
 * Export server instance and utilities for testing
 */
export { serverInstance, gracefulShutdown, initializeDatabase, startServer };

/**
 * Default export
 */
export default main;