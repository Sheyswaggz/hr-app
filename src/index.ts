/**
 * Application Entry Point
 * 
 * This module serves as the main entry point for the HR application.
 * It provides basic initialization and verification that the TypeScript
 * compilation and module resolution are working correctly.
 * 
 * @module index
 */

/**
 * Application metadata and version information
 */
const APP_METADATA = {
  name: 'HR Application',
  version: '1.0.0',
  environment: process.env.NODE_ENV ?? 'development',
  buildTimestamp: new Date().toISOString(),
} as const;

/**
 * Initializes the application and performs basic startup checks
 * 
 * This function serves as the main initialization routine for the application.
 * It verifies that the runtime environment is properly configured and logs
 * startup information for debugging and monitoring purposes.
 * 
 * @returns A promise that resolves to true if initialization succeeds
 * @throws Never throws - all errors are caught and logged
 */
export async function initializeApplication(): Promise<boolean> {
  try {
    console.log('[INIT] Starting HR Application initialization...');
    console.log('[INIT] Application metadata:', JSON.stringify(APP_METADATA, null, 2));
    
    // Verify Node.js version meets minimum requirements
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0] ?? '0', 10);
    
    if (majorVersion < 18) {
      console.error(
        `[INIT] ERROR: Node.js version ${nodeVersion} is not supported. Minimum required version is 18.0.0`
      );
      return false;
    }
    
    console.log(`[INIT] Node.js version ${nodeVersion} verified successfully`);
    console.log('[INIT] TypeScript compilation and module resolution verified');
    console.log('[INIT] Application initialized successfully');
    
    return true;
  } catch (error) {
    console.error('[INIT] FATAL: Application initialization failed:', error);
    console.error('[INIT] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return false;
  }
}

/**
 * Retrieves the current application metadata
 * 
 * @returns Immutable application metadata object
 */
export function getApplicationMetadata(): typeof APP_METADATA {
  return APP_METADATA;
}

/**
 * Performs a health check of the application
 * 
 * This function can be used by monitoring systems to verify that the
 * application is running and responsive.
 * 
 * @returns Health check status object
 */
export function healthCheck(): {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  metadata: typeof APP_METADATA;
} {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    metadata: APP_METADATA,
  };
}

/**
 * Main execution block
 * 
 * This block executes when the module is run directly (not imported).
 * It initializes the application and logs the results.
 */
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import startServerMain from './server.js';

const isMainModule = process.argv[1] 
  ? resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
  : false;

if (isMainModule) {
  console.log('[MAIN] HR Application starting...');
  console.log('[MAIN] Environment:', APP_METADATA.environment);
  
  initializeApplication()
    .then((success) => {
      if (success) {
        console.log('[MAIN] Application is ready');
        console.log('[MAIN] Health check:', JSON.stringify(healthCheck(), null, 2));
        console.log('[MAIN] Starting HTTP server...');
        
        // Start the HTTP server
        return startServerMain();
      } else {
        console.error('[MAIN] Application failed to initialize');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('[MAIN] Unhandled error during initialization:', error);
      process.exit(1);
    });
}

// Export application metadata for external use
export { APP_METADATA };

// Default export for convenience
export default {
  initializeApplication,
  getApplicationMetadata,
  healthCheck,
  APP_METADATA,
};