/**
 * Global test setup for Vitest
 * 
 * This file runs before all tests and sets up the test environment.
 */

import { beforeAll, afterAll, afterEach } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hr_app_test';

// Global setup
beforeAll(() => {
  console.log('[TEST SETUP] Initializing test environment');
});

// Cleanup after each test
afterEach(() => {
  // Clear any mocks or spies
});

// Global teardown
afterAll(() => {
  console.log('[TEST SETUP] Cleaning up test environment');
});