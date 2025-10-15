/**
 * Database test setup for Vitest
 * 
 * This file runs before database tests and sets up the database connection.
 */

import { beforeAll, afterAll } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hr_app_test';

// Global setup for database tests
beforeAll(async () => {
  console.log('[DB TEST SETUP] Initializing database test environment');
  console.log('[DB TEST SETUP] Database URL:', process.env.DATABASE_URL);
});

// Global teardown for database tests
afterAll(async () => {
  console.log('[DB TEST SETUP] Cleaning up database test environment');
});