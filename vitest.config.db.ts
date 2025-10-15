import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest Configuration for Database Tests
 * 
 * Specialized configuration for database migration and schema tests.
 * Runs tests sequentially to avoid database conflicts.
 */
export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Global test setup
    globals: true,
    
    // Test file patterns - only database tests
    include: [
      'tests/db/**/*.test.ts',
    ],
    
    // Files to exclude
    exclude: [
      'node_modules/**',
      'dist/**',
    ],
    
    // Test timeout (longer for database operations)
    testTimeout: 30000,
    hookTimeout: 30000,
    
    // Reporters
    reporters: ['default'],
    
    // Mock reset behavior
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    
    // Run tests sequentially to avoid database conflicts
    sequence: {
      shuffle: false,
    },
    
    // Run tests in sequence, not parallel
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@config': path.resolve(__dirname, './src/config'),
    },
  },
});