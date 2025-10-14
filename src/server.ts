/**
 * HTTP Server Entry Point
 * 
 * Production-ready HTTP server with graceful shutdown, database connection management,
 * comprehensive error handling, and structured logging. Implements proper lifecycle
 * management for all resources including database connections and HTTP server.
 * 
 * This module starts the Express application, establishes database connectivity,
 * handles process signals for graceful shutdown, and provides robust error recovery.
 * 
 * @module server
 */

import { type Server } from 'http';

import app from './app.js';
import { initializePool, shutdown as shutdownDatabase, testConnection } from './db/index.js';

/**
 * Server Configuration
 * 
 * Centralized server configuration with environment variable overrides
 */
interface ServerConfig {
  /**
   * Port number for HTTP server
   */
  readonly port: number;

  /**
   * Host address to bind to
   */
  readonly host: string;

  /**
   * Current environment
   */
  readonly environment: 'development' | 'staging' | 'production' | 'test';

  /**
   * Graceful shutdown timeout in milliseconds
   */
  readonly shutdownTimeout: number;

  /**
   * Enable keep-alive for HTTP connections
   */
  readonly keepAliveEnabled: boolean;

  /**
   * Keep-alive timeout in milliseconds
   */
  readonly keepAliveTimeout: number;

  /**
   * Headers timeout in milliseconds
   */
  readonly headersTimeout: number;

  /**
   * Request timeout in milliseconds
   */
  readonly requestTimeout: number;
}

/**
 * Server State
 * 
 * Tracks the current state of the server lifecycle
 */
type ServerState = 
  | 'initializing'
  | 'starting'
  | 'running'
  | 'shutting_down'
  | 'stopped'
  | 'error';

/**
 * Shutdown Reason
 * 
 * Tracks why the server is shutting down
 */
type ShutdownReason = 
  | 'SIGTERM'
  | 'SIGINT'
  | 'uncaughtException'
  | 'unhandledRejection'
  | 'manual'
  | 'error';

/**
 * Server Instance State
 */
interface ServerInstanceState {
  /**
   * HTTP server instance
   */
  server: Server | null;

  /**
   * Current server state
   */
  state: ServerState;

  /**
   * Server start timestamp
   */
  startTime: Date | null;

  /**
   * Active connections count
   */
  activeConnections: number;

  /**
   * Shutdown in progress flag
   */
  isShuttingDown: boolean;

  /**
   * Shutdown reason
   */
  shutdownReason: ShutdownReason | null;
}

/**
 * Global server state
 */
const serverState: ServerInstanceState = {
  server: null,
  state: 'initializing',
  startTime: null,
  activeConnections: 0,
  isShuttingDown: false,
  shutdownReason: null,
};

/**
 * Load Server Configuration
 * 
 * Loads server configuration from environment variables with fallback defaults
 */
function loadServerConfig(): ServerConfig {
  const environment = (process.env.NODE_ENV || 'development') as ServerConfig['environment'];
  
  const config: ServerConfig = {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    environment,
    shutdownTimeout: parseInt(process.env.SHUTDOWN_TIMEOUT || '30000', 10),
    keepAliveEnabled: process.env.KEEP_ALIVE_ENABLED !== 'false',
    keepAliveTimeout: parseInt(process.env.KEEP_ALIVE_TIMEOUT || '65000', 10),
    headersTimeout: parseInt(process.env.HEADERS_TIMEOUT || '66000', 10),
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '300000', 10),
  };

  // Validate port
  if (config.port < 1 || config.port > 65535) {
    throw new Error(`[SERVER] Invalid port number: ${config.port}. Must be between 1 and 65535.`);
  }

  // Validate timeouts
  if (config.shutdownTimeout < 1000) {
    throw new Error('[SERVER] Shutdown timeout must be at least 1000ms');
  }

  if (config.headersTimeout <= config.keepAliveTimeout) {
    console.warn('[SERVER] WARNING: headersTimeout should be greater than keepAliveTimeout');
  }

  console.log('[SERVER] Server configuration loaded:', {
    port: config.port,
    host: config.host,
    environment: config.environment,
    shutdownTimeout: config.shutdownTimeout,
    keepAliveEnabled: config.keepAliveEnabled,
    keepAliveTimeout: config.keepAliveTimeout,
    headersTimeout: config.headersTimeout,
    requestTimeout: config.requestTimeout,
  });

  return config;
}

/**
 * Initialize Database Connection
 * 
 * Establishes database connection and verifies connectivity
 */
async function initializeDatabase(): Promise<void> {
  console.log('[SERVER] Initializing database connection...');

  try {
    // Initialize connection pool
    initializePool();

    // Test database connectivity
    const healthCheck = await testConnection();

    if (!healthCheck.healthy) {
      throw new Error(`Database connection test failed: ${healthCheck.error}`);
    }

    console.log('[SERVER] Database connection established successfully:', {
      latencyMs: healthCheck.latencyMs,
      poolStats: healthCheck.poolStats,
      timestamp: healthCheck.timestamp.toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[SERVER] Failed to initialize database:', {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
    throw new Error(`[SERVER] Database initialization failed: ${errorMessage}`);
  }
}

/**
 * Track Active Connections
 * 
 * Monitors active HTTP connections for graceful shutdown
 */
function setupConnectionTracking(server: Server): void {
  server.on('connection', (socket) => {
    serverState.activeConnections++;

    console.log('[SERVER] New connection established:', {
      activeConnections: serverState.activeConnections,
      remoteAddress: socket.remoteAddress,
      remotePort: socket.remotePort,
    });

    socket.on('close', () => {
      serverState.activeConnections--;

      console.log('[SERVER] Connection closed:', {
        activeConnections: serverState.activeConnections,
        remoteAddress: socket.remoteAddress,
      });
    });
  });
}

/**
 * Start HTTP Server
 * 
 * Starts the HTTP server and sets up connection tracking
 */
async function startServer(config: ServerConfig): Promise<Server> {
  return new Promise((resolve, reject) => {
    console.log('[SERVER] Starting HTTP server...');

    try {
      const server = app.listen(config.port, config.host, () => {
        serverState.server = server;
        serverState.state = 'running';
        serverState.startTime = new Date();

        console.log('[SERVER] HTTP server started successfully:', {
          port: config.port,
          host: config.host,
          environment: config.environment,
          startTime: serverState.startTime.toISOString(),
          processId: process.pid,
          nodeVersion: process.version,
        });

        resolve(server);
      });

      // Configure server timeouts
      if (config.keepAliveEnabled) {
        server.keepAliveTimeout = config.keepAliveTimeout;
        console.log(`[SERVER] Keep-alive enabled with timeout: ${config.keepAliveTimeout}ms`);
      }

      server.headersTimeout = config.headersTimeout;
      server.requestTimeout = config.requestTimeout;

      // Setup connection tracking
      setupConnectionTracking(server);

      // Handle server errors
      server.on('error', (error: NodeJS.ErrnoException) => {
        console.error('[SERVER] Server error:', {
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString(),
        });

        if (error.code === 'EADDRINUSE') {
          reject(new Error(`[SERVER] Port ${config.port} is already in use`));
        } else if (error.code === 'EACCES') {
          reject(new Error(`[SERVER] Permission denied to bind to port ${config.port}`));
        } else {
          reject(error);
        }
      });

      server.on('clientError', (error, socket) => {
        console.error('[SERVER] Client error:', {
          error: error.message,
          remoteAddress: socket.remoteAddress,
          timestamp: new Date().toISOString(),
        });

        // Send 400 Bad Request for client errors
        if (!socket.destroyed) {
          socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[SERVER] Failed to start server:', {
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      reject(new Error(`[SERVER] Server startup failed: ${errorMessage}`));
    }
  });
}

/**
 * Graceful Shutdown
 * 
 * Performs graceful shutdown of all resources including HTTP server and database
 */
async function gracefulShutdown(reason: ShutdownReason, config: ServerConfig): Promise<void> {
  if (serverState.isShuttingDown) {
    console.warn('[SERVER] Shutdown already in progress, ignoring duplicate signal');
    return;
  }

  serverState.isShuttingDown = true;
  serverState.shutdownReason = reason;
  serverState.state = 'shutting_down';

  const shutdownStartTime = Date.now();

  console.log('[SERVER] Starting graceful shutdown...', {
    reason,
    activeConnections: serverState.activeConnections,
    uptime: serverState.startTime ? Date.now() - serverState.startTime.getTime() : 0,
    timestamp: new Date().toISOString(),
  });

  try {
    // Stop accepting new connections
    if (serverState.server) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Server close timeout'));
        }, config.shutdownTimeout);

        serverState.server!.close((error) => {
          clearTimeout(timeout);
          if (error) {
            console.error('[SERVER] Error closing server:', {
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

    // Shutdown database connections
    console.log('[SERVER] Closing database connections...');
    await shutdownDatabase({
      timeout: config.shutdownTimeout,
      force: false,
    });

    serverState.state = 'stopped';
    serverState.server = null;

    const shutdownDuration = Date.now() - shutdownStartTime;

    console.log('[SERVER] Graceful shutdown completed successfully:', {
      reason,
      shutdownDurationMs: shutdownDuration,
      timestamp: new Date().toISOString(),
    });

    // Exit process
    process.exit(0);

  } catch (error) {
    const shutdownDuration = Date.now() - shutdownStartTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[SERVER] Error during graceful shutdown:', {
      reason,
      error: errorMessage,
      shutdownDurationMs: shutdownDuration,
      timestamp: new Date().toISOString(),
    });

    serverState.state = 'error';

    // Force exit after error
    process.exit(1);
  }
}

/**
 * Setup Process Signal Handlers
 * 
 * Registers handlers for process termination signals
 */
function setupSignalHandlers(config: ServerConfig): void {
  // SIGTERM - Graceful shutdown (e.g., from Kubernetes, Docker)
  process.on('SIGTERM', () => {
    console.log('[SERVER] Received SIGTERM signal');
    void gracefulShutdown('SIGTERM', config);
  });

  // SIGINT - Graceful shutdown (e.g., Ctrl+C)
  process.on('SIGINT', () => {
    console.log('[SERVER] Received SIGINT signal');
    void gracefulShutdown('SIGINT', config);
  });

  // Uncaught Exception Handler
  process.on('uncaughtException', (error: Error) => {
    console.error('[SERVER] Uncaught exception:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    void gracefulShutdown('uncaughtException', config);
  });

  // Unhandled Promise Rejection Handler
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    console.error('[SERVER] Unhandled promise rejection:', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: String(promise),
      timestamp: new Date().toISOString(),
    });

    void gracefulShutdown('unhandledRejection', config);
  });

  console.log('[SERVER] Process signal handlers registered');
}

/**
 * Main Server Startup Function
 * 
 * Orchestrates the complete server startup sequence
 */
async function main(): Promise<void> {
  const startupStartTime = Date.now();

  console.log('[SERVER] ========================================');
  console.log('[SERVER] Starting HR Application Server');
  console.log('[SERVER] ========================================');
  console.log('[SERVER] Process ID:', process.pid);
  console.log('[SERVER] Node.js version:', process.version);
  console.log('[SERVER] Platform:', process.platform);
  console.log('[SERVER] Architecture:', process.arch);
  console.log('[SERVER] Working directory:', process.cwd());
  console.log('[SERVER] ========================================');

  try {
    // Load configuration
    serverState.state = 'starting';
    const config = loadServerConfig();

    // Setup signal handlers
    setupSignalHandlers(config);

    // Initialize database
    await initializeDatabase();

    // Start HTTP server
    await startServer(config);

    const startupDuration = Date.now() - startupStartTime;

    console.log('[SERVER] ========================================');
    console.log('[SERVER] Server startup completed successfully');
    console.log('[SERVER] ========================================');
    console.log(`[SERVER] Server listening on http://${config.host}:${config.port}`);
    console.log(`[SERVER] Environment: ${config.environment}`);
    console.log(`[SERVER] Startup duration: ${startupDuration}ms`);
    console.log('[SERVER] ========================================');
    console.log('[SERVER] Health check: GET /health');
    console.log('[SERVER] Readiness check: GET /ready');
    console.log('[SERVER] API version: GET /api/version');
    console.log('[SERVER] Authentication: POST /api/auth/*');
    console.log('[SERVER] ========================================');

  } catch (error) {
    const startupDuration = Date.now() - startupStartTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('[SERVER] ========================================');
    console.error('[SERVER] FATAL: Server startup failed');
    console.error('[SERVER] ========================================');
    console.error('[SERVER] Error:', errorMessage);
    if (errorStack) {
      console.error('[SERVER] Stack trace:', errorStack);
    }
    console.error('[SERVER] Startup duration:', `${startupDuration}ms`);
    console.error('[SERVER] Timestamp:', new Date().toISOString());
    console.error('[SERVER] ========================================');

    serverState.state = 'error';

    // Attempt cleanup
    try {
      await shutdownDatabase({ timeout: 5000, force: true });
    } catch (cleanupError) {
      console.error('[SERVER] Error during cleanup:', {
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    }

    // Exit with error code
    process.exit(1);
  }
}

/**
 * Get Server State
 * 
 * Returns current server state for monitoring
 */
export function getServerState(): Readonly<ServerInstanceState> {
  return {
    ...serverState,
  };
}

/**
 * Get Server Uptime
 * 
 * Returns server uptime in milliseconds
 */
export function getServerUptime(): number {
  if (!serverState.startTime) {
    return 0;
  }
  return Date.now() - serverState.startTime.getTime();
}

/**
 * Is Server Running
 * 
 * Returns true if server is running
 */
export function isServerRunning(): boolean {
  return serverState.state === 'running' && serverState.server !== null;
}

/**
 * Start the server
 */
void main();

/**
 * Export for testing
 */
export default {
  getServerState,
  getServerUptime,
  isServerRunning,
};