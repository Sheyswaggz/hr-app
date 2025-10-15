import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest Configuration for HR Application Backend
 * 
 * Configures test environment for Node.js/Express backend with TypeScript.
 * Includes proper module resolution, coverage settings, and test patterns.
 */
export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Global test setup
    globals: true,
    
    // Test file patterns
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts',
    ],
    
    // Files to exclude
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.vite/**',
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.config.ts',
        '**/*.config.js',
        'migrations/**',
        'src/db/seed.ts',
      ],
      all: true,
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
    
    // Test timeout
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Reporters
    reporters: ['default'],
    
    // Mock reset behavior
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    
    // Retry failed tests
    retry: 0,
    
    // Run tests in sequence for database tests
    sequence: {
      shuffle: false,
    },
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@features': path.resolve(__dirname, './src/features'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@types': path.resolve(__dirname, './src/types'),
      '@config': path.resolve(__dirname, './src/config'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },
});