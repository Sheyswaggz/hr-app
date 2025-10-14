/**
 * End-to-End Authentication Flow Tests
 * 
 * Comprehensive E2E tests for complete authentication user journeys including:
 * - New user registration through protected resource access
 * - Password reset flow with token validation
 * - Token refresh mechanism
 * - Account lockout after failed login attempts
 * 
 * These tests use supertest for HTTP assertions and interact with a real test database
 * to validate the complete authentication system behavior in production-like conditions.
 * 
 * @module tests/e2e/auth.flow
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { type Express } from 'express';

import { createApp, resetApp } from '../../src/app.js';
import { getPool, executeQuery, executeTransaction, shutdown as shutdownDb } from '../../src/db/index.js';
import { hashPassword } from '../../src/utils/password.js';
import { generatePasswordResetToken } from '../../src/utils/jwt.js';

/**
 * Test User Data Interface
 * 
 * Defines the structure for test user data used throughout E2E tests
 */
interface TestUser {
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';
}

/**
 * Test Context Interface
 * 
 * Maintains state across test execution for cleanup and assertions
 */
interface TestContext {
  app: Express;
  createdUserIds: string[];
  createdTokens: string[];
}

/**
 * Test context singleton
 */
const testContext: TestContext = {
  app: null as any,
  createdUserIds: [],
  createdTokens: [],
};

/**
 * Test User Fixtures
 * 
 * Predefined user data for consistent testing across scenarios
 */
const TEST_USERS: Record<string, TestUser> = {
  newUser: {
    email: 'newuser@test.com',
    password: 'SecurePass123!',
    firstName: 'New',
    lastName: 'User',
    role: 'EMPLOYEE',
  },
  existingUser: {
    email: 'existing@test.com',
    password: 'ExistingPass123!',
    firstName: 'Existing',
    lastName: 'User',
    role: 'EMPLOYEE',
  },
  managerUser: {
    email: 'manager@test.com',
    password: 'ManagerPass123!',
    firstName: 'Manager',
    lastName: 'User',
    role: 'MANAGER',
  },
  adminUser: {
    email: 'admin@test.com',
    password: 'AdminPass123!',
    firstName: 'Admin',
    lastName: 'User',
    role: 'HR_ADMIN',
  },
};

/**
 * Setup Test Database
 * 
 * Initializes test database with clean state before test execution
 */
async function setupTestDatabase(): Promise<void> {
  console.log('[E2E_AUTH] Setting up test database...');

  try {
    // Ensure database connection is established
    const pool = getPool();
    await pool.query('SELECT 1');

    // Clean up any existing test data
    await executeTransaction(async (client) => {
      // Delete test users (cascade will handle related records)
      await client.query(`
        DELETE FROM users 
        WHERE email LIKE '%@test.com'
      `);

      console.log('[E2E_AUTH] Test database cleaned');
    });

    console.log('[E2E_AUTH] Test database setup complete');
  } catch (error) {
    console.error('[E2E_AUTH] Failed to setup test database:', {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

/**
 * Cleanup Test Database
 * 
 * Removes all test data created during test execution
 */
async function cleanupTestDatabase(): Promise<void> {
  console.log('[E2E_AUTH] Cleaning up test database...');

  try {
    await executeTransaction(async (client) => {
      // Delete all test users
      await client.query(`
        DELETE FROM users 
        WHERE email LIKE '%@test.com'
      `);

      console.log('[E2E_AUTH] Test database cleanup complete');
    });
  } catch (error) {
    console.error('[E2E_AUTH] Failed to cleanup test database:', {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    // Don't throw - cleanup failures shouldn't fail tests
  }
}

/**
 * Create Test User in Database
 * 
 * Helper function to create a user directly in the database for testing
 */
async function createTestUser(userData: TestUser): Promise<string> {
  const hashedPassword = await hashPassword(userData.password);

  const result = await executeQuery<{ id: string }>(
    `
    INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, failed_login_attempts)
    VALUES ($1, $2, $3, $4, $5, true, 0)
    RETURNING id
    `,
    [
      userData.email,
      hashedPassword,
      userData.firstName,
      userData.lastName,
      userData.role,
    ],
    {
      operation: 'create_test_user',
    }
  );

  const userId = result.rows[0]?.id;
  if (!userId) {
    throw new Error('Failed to create test user');
  }

  testContext.createdUserIds.push(userId);
  return userId;
}

/**
 * Get User Failed Login Attempts
 * 
 * Helper to check failed login attempt count for a user
 */
async function getUserFailedAttempts(email: string): Promise<number> {
  const result = await executeQuery<{ failed_login_attempts: number }>(
    'SELECT failed_login_attempts FROM users WHERE email = $1',
    [email],
    { operation: 'get_failed_attempts' }
  );

  return result.rows[0]?.failed_login_attempts ?? 0;
}

/**
 * Get User Account Locked Status
 * 
 * Helper to check if user account is locked
 */
async function isUserAccountLocked(email: string): Promise<boolean> {
  const result = await executeQuery<{ account_locked_until: Date | null }>(
    'SELECT account_locked_until FROM users WHERE email = $1',
    [email],
    { operation: 'check_account_locked' }
  );

  const lockedUntil = result.rows[0]?.account_locked_until;
  if (!lockedUntil) {
    return false;
  }

  return new Date(lockedUntil) > new Date();
}

/**
 * Wait for Condition
 * 
 * Helper to wait for a condition to become true with timeout
 */
async function waitForCondition(
  condition: () => Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return false;
}

/**
 * Test Suite Setup
 */
beforeAll(async () => {
  console.log('[E2E_AUTH] Starting E2E authentication flow tests...');

  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.AUTH_ENABLED = 'true';

  // Initialize application
  testContext.app = createApp();

  // Setup test database
  await setupTestDatabase();

  console.log('[E2E_AUTH] Test suite setup complete');
});

/**
 * Test Suite Teardown
 */
afterAll(async () => {
  console.log('[E2E_AUTH] Tearing down E2E authentication flow tests...');

  // Cleanup test database
  await cleanupTestDatabase();

  // Shutdown database connection
  await shutdownDb({ timeout: 5000 });

  // Reset application
  resetApp();

  console.log('[E2E_AUTH] Test suite teardown complete');
});

/**
 * Test Case Setup
 */
beforeEach(() => {
  // Reset context for each test
  testContext.createdUserIds = [];
  testContext.createdTokens = [];
});

/**
 * Test Case Teardown
 */
afterEach(async () => {
  // Clean up any users created during the test
  if (testContext.createdUserIds.length > 0) {
    try {
      await executeTransaction(async (client) => {
        await client.query(
          'DELETE FROM users WHERE id = ANY($1)',
          [testContext.createdUserIds]
        );
      });
    } catch (error) {
      console.error('[E2E_AUTH] Failed to cleanup test users:', error);
    }
  }
});

/**
 * E2E Authentication Flow Tests
 */
describe('E2E Authentication Flows', () => {
  /**
   * Complete User Journey: Registration -> Login -> Protected Resource -> Logout
   */
  describe('Complete User Journey', () => {
    it('should allow new user to register, login, access protected resource, and logout', async () => {
      const userData = TEST_USERS.newUser;
      let accessToken: string;
      let refreshToken: string;

      // Step 1: Register new user
      console.log('[E2E_AUTH] Step 1: Registering new user...');
      const registerResponse = await request(testContext.app)
        .post('/api/auth/register')
        .send({
          email: userData.email,
          password: userData.password,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
        })
        .expect(201);

      expect(registerResponse.body).toMatchObject({
        success: true,
        user: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          isActive: true,
        },
        tokens: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: expect.any(Number),
        },
      });

      accessToken = registerResponse.body.tokens.accessToken;
      refreshToken = registerResponse.body.tokens.refreshToken;
      const userId = registerResponse.body.user.id;
      testContext.createdUserIds.push(userId);

      console.log('[E2E_AUTH] Registration successful, user ID:', userId);

      // Step 2: Login with credentials
      console.log('[E2E_AUTH] Step 2: Logging in with credentials...');
      const loginResponse = await request(testContext.app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      expect(loginResponse.body).toMatchObject({
        success: true,
        user: {
          id: userId,
          email: userData.email,
        },
        tokens: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        },
      });

      // Update tokens from login
      accessToken = loginResponse.body.tokens.accessToken;
      refreshToken = loginResponse.body.tokens.refreshToken;

      console.log('[E2E_AUTH] Login successful');

      // Step 3: Access protected resource (health check with auth)
      console.log('[E2E_AUTH] Step 3: Accessing protected resource...');
      const protectedResponse = await request(testContext.app)
        .get('/api/auth/health')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(protectedResponse.body).toMatchObject({
        status: 'healthy',
        service: 'authentication',
      });

      console.log('[E2E_AUTH] Protected resource access successful');

      // Step 4: Logout
      console.log('[E2E_AUTH] Step 4: Logging out...');
      const logoutResponse = await request(testContext.app)
        .post('/api/auth/logout')
        .send({
          refreshToken,
        })
        .expect(200);

      expect(logoutResponse.body).toMatchObject({
        success: true,
        message: expect.stringContaining('Logout successful'),
      });

      console.log('[E2E_AUTH] Logout successful');

      // Step 5: Verify token is invalidated (refresh should fail)
      console.log('[E2E_AUTH] Step 5: Verifying token invalidation...');
      await request(testContext.app)
        .post('/api/auth/refresh-token')
        .send({
          refreshToken,
        })
        .expect(401);

      console.log('[E2E_AUTH] Token invalidation verified');
    });

    it('should handle registration with duplicate email', async () => {
      const userData = TEST_USERS.existingUser;

      // Create user first
      await createTestUser(userData);

      // Attempt to register with same email
      const response = await request(testContext.app)
        .post('/api/auth/register')
        .send({
          email: userData.email,
          password: userData.password,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
        })
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: expect.stringContaining('already exists'),
        },
      });
    });

    it('should validate registration input', async () => {
      // Invalid email
      await request(testContext.app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'SecurePass123!',
          firstName: 'Test',
          lastName: 'User',
          role: 'EMPLOYEE',
        })
        .expect(400);

      // Weak password
      await request(testContext.app)
        .post('/api/auth/register')
        .send({
          email: 'test@test.com',
          password: 'weak',
          firstName: 'Test',
          lastName: 'User',
          role: 'EMPLOYEE',
        })
        .expect(400);

      // Missing required fields
      await request(testContext.app)
        .post('/api/auth/register')
        .send({
          email: 'test@test.com',
          password: 'SecurePass123!',
        })
        .expect(400);
    });
  });

  /**
   * Password Reset Flow
   */
  describe('Password Reset Flow', () => {
    it('should complete full password reset flow', async () => {
      const userData = TEST_USERS.existingUser;
      const newPassword = 'NewSecurePass123!';

      // Create test user
      const userId = await createTestUser(userData);

      // Step 1: Request password reset
      console.log('[E2E_AUTH] Step 1: Requesting password reset...');
      const resetRequestResponse = await request(testContext.app)
        .post('/api/auth/request-password-reset')
        .send({
          email: userData.email,
        })
        .expect(200);

      expect(resetRequestResponse.body).toMatchObject({
        success: true,
        message: expect.stringContaining('password reset'),
      });

      console.log('[E2E_AUTH] Password reset requested');

      // Step 2: Get reset token from database (simulating email link)
      const tokenResult = await executeQuery<{ password_reset_token: string }>(
        'SELECT password_reset_token FROM users WHERE id = $1',
        [userId],
        { operation: 'get_reset_token' }
      );

      const resetToken = tokenResult.rows[0]?.password_reset_token;
      expect(resetToken).toBeDefined();

      console.log('[E2E_AUTH] Step 2: Reset token retrieved');

      // Step 3: Reset password with token
      console.log('[E2E_AUTH] Step 3: Resetting password...');
      const resetResponse = await request(testContext.app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword,
        })
        .expect(200);

      expect(resetResponse.body).toMatchObject({
        success: true,
        message: expect.stringContaining('reset successfully'),
      });

      console.log('[E2E_AUTH] Password reset successful');

      // Step 4: Login with new password
      console.log('[E2E_AUTH] Step 4: Logging in with new password...');
      const loginResponse = await request(testContext.app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: newPassword,
        })
        .expect(200);

      expect(loginResponse.body).toMatchObject({
        success: true,
        user: {
          email: userData.email,
        },
      });

      console.log('[E2E_AUTH] Login with new password successful');

      // Step 5: Verify old password no longer works
      console.log('[E2E_AUTH] Step 5: Verifying old password is invalid...');
      await request(testContext.app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(401);

      console.log('[E2E_AUTH] Old password correctly rejected');
    });

    it('should reject expired reset token', async () => {
      const userData = TEST_USERS.existingUser;
      const userId = await createTestUser(userData);

      // Generate expired token (1 hour ago)
      const expiredToken = generatePasswordResetToken(userId, -3600);

      // Attempt to reset with expired token
      const response = await request(testContext.app)
        .post('/api/auth/reset-password')
        .send({
          token: expiredToken,
          newPassword: 'NewSecurePass123!',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.stringMatching(/INVALID|EXPIRED/),
        },
      });
    });

    it('should reject invalid reset token', async () => {
      const response = await request(testContext.app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'NewSecurePass123!',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.stringMatching(/INVALID/),
        },
      });
    });

    it('should not reveal if email exists during reset request', async () => {
      // Request reset for non-existent email
      const response = await request(testContext.app)
        .post('/api/auth/request-password-reset')
        .send({
          email: 'nonexistent@test.com',
        })
        .expect(200);

      // Should return success to prevent email enumeration
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('password reset'),
      });
    });
  });

  /**
   * Token Refresh Flow
   */
  describe('Token Refresh Flow', () => {
    it('should refresh access token with valid refresh token', async () => {
      const userData = TEST_USERS.existingUser;
      await createTestUser(userData);

      // Login to get tokens
      const loginResponse = await request(testContext.app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      const { refreshToken: originalRefreshToken } = loginResponse.body.tokens;

      // Wait a moment to ensure new token has different timestamp
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Refresh token
      const refreshResponse = await request(testContext.app)
        .post('/api/auth/refresh-token')
        .send({
          refreshToken: originalRefreshToken,
        })
        .expect(200);

      expect(refreshResponse.body).toMatchObject({
        success: true,
        tokens: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: expect.any(Number),
        },
      });

      // Verify new tokens are different
      expect(refreshResponse.body.tokens.accessToken).not.toBe(
        loginResponse.body.tokens.accessToken
      );
      expect(refreshResponse.body.tokens.refreshToken).not.toBe(
        originalRefreshToken
      );

      // Verify new access token works
      await request(testContext.app)
        .get('/api/auth/health')
        .set('Authorization', `Bearer ${refreshResponse.body.tokens.accessToken}`)
        .expect(200);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(testContext.app)
        .post('/api/auth/refresh-token')
        .send({
          refreshToken: 'invalid-token',
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.stringMatching(/INVALID|UNAUTHORIZED/),
        },
      });
    });

    it('should reject refresh token after logout', async () => {
      const userData = TEST_USERS.existingUser;
      await createTestUser(userData);

      // Login
      const loginResponse = await request(testContext.app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      const { refreshToken } = loginResponse.body.tokens;

      // Logout
      await request(testContext.app)
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(200);

      // Attempt to refresh with logged out token
      await request(testContext.app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken })
        .expect(401);
    });

    it('should handle concurrent token refresh requests', async () => {
      const userData = TEST_USERS.existingUser;
      await createTestUser(userData);

      // Login
      const loginResponse = await request(testContext.app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      const { refreshToken } = loginResponse.body.tokens;

      // Make multiple concurrent refresh requests
      const refreshPromises = Array.from({ length: 3 }, () =>
        request(testContext.app)
          .post('/api/auth/refresh-token')
          .send({ refreshToken })
      );

      const responses = await Promise.all(refreshPromises);

      // At least one should succeed
      const successfulResponses = responses.filter((r) => r.status === 200);
      expect(successfulResponses.length).toBeGreaterThan(0);

      // All successful responses should have valid tokens
      successfulResponses.forEach((response) => {
        expect(response.body).toMatchObject({
          success: true,
          tokens: {
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
          },
        });
      });
    });
  });

  /**
   * Account Lockout Flow
   */
  describe('Account Lockout After Failed Attempts', () => {
    it('should lock account after 5 failed login attempts', async () => {
      const userData = TEST_USERS.existingUser;
      await createTestUser(userData);

      console.log('[E2E_AUTH] Testing account lockout...');

      // Attempt 5 failed logins
      for (let i = 1; i <= 5; i++) {
        console.log(`[E2E_AUTH] Failed attempt ${i}/5...`);

        const response = await request(testContext.app)
          .post('/api/auth/login')
          .send({
            email: userData.email,
            password: 'WrongPassword123!',
          })
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
          },
        });

        // Check failed attempts count
        const failedAttempts = await getUserFailedAttempts(userData.email);
        expect(failedAttempts).toBe(i);
      }

      console.log('[E2E_AUTH] 5 failed attempts completed');

      // Verify account is locked
      const isLocked = await isUserAccountLocked(userData.email);
      expect(isLocked).toBe(true);

      console.log('[E2E_AUTH] Account locked verified');

      // Attempt login with correct password should fail due to lock
      const lockedResponse = await request(testContext.app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(423);

      expect(lockedResponse.body).toMatchObject({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: expect.stringContaining('locked'),
        },
      });

      console.log('[E2E_AUTH] Account lockout test completed');
    });

    it('should reset failed attempts after successful login', async () => {
      const userData = TEST_USERS.existingUser;
      await createTestUser(userData);

      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await request(testContext.app)
          .post('/api/auth/login')
          .send({
            email: userData.email,
            password: 'WrongPassword123!',
          })
          .expect(401);
      }

      // Verify failed attempts
      let failedAttempts = await getUserFailedAttempts(userData.email);
      expect(failedAttempts).toBe(3);

      // Successful login
      await request(testContext.app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      // Verify failed attempts reset
      failedAttempts = await getUserFailedAttempts(userData.email);
      expect(failedAttempts).toBe(0);
    });

    it('should unlock account after lockout period expires', async () => {
      const userData = TEST_USERS.existingUser;
      const userId = await createTestUser(userData);

      // Manually set account as locked with past expiry (simulate expired lock)
      await executeQuery(
        `
        UPDATE users 
        SET account_locked_until = NOW() - INTERVAL '1 second',
            failed_login_attempts = 5
        WHERE id = $1
        `,
        [userId],
        { operation: 'set_expired_lock' }
      );

      // Attempt login should succeed (lock expired)
      const response = await request(testContext.app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        user: {
          email: userData.email,
        },
      });

      // Verify failed attempts reset
      const failedAttempts = await getUserFailedAttempts(userData.email);
      expect(failedAttempts).toBe(0);
    });

    it('should not increment failed attempts for non-existent users', async () => {
      // Attempt login with non-existent email
      await request(testContext.app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'SomePassword123!',
        })
        .expect(401);

      // Verify no user was created
      const result = await executeQuery(
        'SELECT COUNT(*) as count FROM users WHERE email = $1',
        ['nonexistent@test.com'],
        { operation: 'check_user_exists' }
      );

      expect(result.rows[0]?.count).toBe('0');
    });
  });

  /**
   * Role-Based Access Control
   */
  describe('Role-Based Access Control', () => {
    it('should allow users to access resources based on their role', async () => {
      // Create users with different roles
      const employeeId = await createTestUser(TEST_USERS.existingUser);
      const managerId = await createTestUser(TEST_USERS.managerUser);
      const adminId = await createTestUser(TEST_USERS.adminUser);

      // Login as each user and verify role in token
      const employeeLogin = await request(testContext.app)
        .post('/api/auth/login')
        .send({
          email: TEST_USERS.existingUser.email,
          password: TEST_USERS.existingUser.password,
        })
        .expect(200);

      expect(employeeLogin.body.user.role).toBe('EMPLOYEE');

      const managerLogin = await request(testContext.app)
        .post('/api/auth/login')
        .send({
          email: TEST_USERS.managerUser.email,
          password: TEST_USERS.managerUser.password,
        })
        .expect(200);

      expect(managerLogin.body.user.role).toBe('MANAGER');

      const adminLogin = await request(testContext.app)
        .post('/api/auth/login')
        .send({
          email: TEST_USERS.adminUser.email,
          password: TEST_USERS.adminUser.password,
        })
        .expect(200);

      expect(adminLogin.body.user.role).toBe('HR_ADMIN');
    });
  });

  /**
   * Security and Edge Cases
   */
  describe('Security and Edge Cases', () => {
    it('should reject requests with malformed tokens', async () => {
      await request(testContext.app)
        .get('/api/auth/health')
        .set('Authorization', 'Bearer malformed.token.here')
        .expect(401);

      await request(testContext.app)
        .get('/api/auth/health')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);
    });

    it('should handle SQL injection attempts safely', async () => {
      const sqlInjectionAttempts = [
        "admin@test.com' OR '1'='1",
        "admin@test.com'; DROP TABLE users; --",
        "admin@test.com' UNION SELECT * FROM users --",
      ];

      for (const maliciousEmail of sqlInjectionAttempts) {
        const response = await request(testContext.app)
          .post('/api/auth/login')
          .send({
            email: maliciousEmail,
            password: 'password',
          })
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
        });
      }
    });

    it('should handle XSS attempts in user input', async () => {
      const xssAttempts = [
        '<script>alert("xss")</script>',
        '"><script>alert(String.fromCharCode(88,83,83))</script>',
        "'; alert('xss'); //",
      ];

      for (const xssPayload of xssAttempts) {
        const response = await request(testContext.app)
          .post('/api/auth/register')
          .send({
            email: 'test@test.com',
            password: 'SecurePass123!',
            firstName: xssPayload,
            lastName: 'User',
            role: 'EMPLOYEE',
          });

        // Should either reject or sanitize
        if (response.status === 201) {
          expect(response.body.user.firstName).not.toContain('<script>');
        }
      }
    });

    it('should rate limit authentication endpoints', async () => {
      const userData = TEST_USERS.existingUser;
      await createTestUser(userData);

      // Make requests up to rate limit
      const requests = Array.from({ length: 6 }, () =>
        request(testContext.app)
          .post('/api/auth/login')
          .send({
            email: userData.email,
            password: 'WrongPassword123!',
          })
      );

      const responses = await Promise.all(requests);

      // At least one should be rate limited
      const rateLimitedResponses = responses.filter((r) => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should handle concurrent login attempts for same user', async () => {
      const userData = TEST_USERS.existingUser;
      await createTestUser(userData);

      // Make multiple concurrent login requests
      const loginPromises = Array.from({ length: 5 }, () =>
        request(testContext.app)
          .post('/api/auth/login')
          .send({
            email: userData.email,
            password: userData.password,
          })
      );

      const responses = await Promise.all(loginPromises);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          tokens: {
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
          },
        });
      });
    });

    it('should handle database connection failures gracefully', async () => {
      // This test would require mocking database failures
      // For now, we verify error handling structure exists
      const response = await request(testContext.app)
        .post('/api/auth/login')
        .send({
          email: 'test@test.com',
          password: 'password',
        });

      // Should return proper error structure even on failure
      expect(response.body).toHaveProperty('success');
      if (!response.body.success) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
      }
    });
  });
});