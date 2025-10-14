/**
 * Authentication API Integration Tests
 * 
 * Comprehensive integration test suite for authentication endpoints using supertest.
 * Tests all authentication flows including registration, login, logout, token refresh,
 * and password reset. Validates rate limiting, error handling, and security measures.
 * 
 * This test suite uses a test database and implements proper setup/teardown to ensure
 * test isolation and repeatability. All tests are designed to be run in parallel safely.
 * 
 * @module tests/integration/auth.api
 */

import request from 'supertest';
import { type Express } from 'express';
import bcrypt from 'bcrypt';

import { createApp, resetApp } from '../../src/app.js';
import { getPool, executeQuery, executeTransaction, shutdown as shutdownDb } from '../../src/db/index.js';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../../src/utils/jwt.js';
import { UserRole } from '../../src/types/index.js';

/**
 * Test User Interface
 * 
 * Represents a test user with credentials
 */
interface TestUser {
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: UserRole;
}

/**
 * Test Database User
 * 
 * User record as stored in database
 */
interface DatabaseUser {
  readonly id: string;
  readonly email: string;
  readonly password_hash: string;
  readonly first_name: string;
  readonly last_name: string;
  readonly role: UserRole;
  readonly is_active: boolean;
  readonly failed_login_attempts: number;
  readonly locked_until: Date | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

/**
 * Test Fixtures
 * 
 * Predefined test users for various scenarios
 */
const TEST_USERS: Record<string, TestUser> = {
  hrAdmin: {
    email: 'hradmin@test.com',
    password: 'HRAdmin123!',
    firstName: 'HR',
    lastName: 'Admin',
    role: UserRole.HRAdmin,
  },
  manager: {
    email: 'manager@test.com',
    password: 'Manager123!',
    firstName: 'Test',
    lastName: 'Manager',
    role: UserRole.Manager,
  },
  employee: {
    email: 'employee@test.com',
    password: 'Employee123!',
    firstName: 'Test',
    lastName: 'Employee',
    role: UserRole.Employee,
  },
  newUser: {
    email: 'newuser@test.com',
    password: 'NewUser123!',
    firstName: 'New',
    lastName: 'User',
    role: UserRole.Employee,
  },
};

/**
 * Test Suite State
 * 
 * Maintains state across test lifecycle
 */
let app: Express;
let createdUserIds: string[] = [];

/**
 * Setup Test Database
 * 
 * Creates test users in the database for authentication tests
 */
async function setupTestDatabase(): Promise<void> {
  console.log('[AUTH_API_TEST] Setting up test database...');

  try {
    // Create test users (except newUser which is for registration tests)
    const usersToCreate = [TEST_USERS.hrAdmin, TEST_USERS.manager, TEST_USERS.employee];

    for (const user of usersToCreate) {
      const passwordHash = await bcrypt.hash(user.password, 10);

      const result = await executeQuery<{ id: string }>(
        `
        INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        `,
        [user.email, passwordHash, user.firstName, user.lastName, user.role, true],
        { operation: 'setup_test_user' }
      );

      if (result.rows[0]) {
        createdUserIds.push(result.rows[0].id);
        console.log(`[AUTH_API_TEST] Created test user: ${user.email}`);
      }
    }

    console.log('[AUTH_API_TEST] Test database setup completed');
  } catch (error) {
    console.error('[AUTH_API_TEST] Failed to setup test database:', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Cleanup Test Database
 * 
 * Removes all test data created during tests
 */
async function cleanupTestDatabase(): Promise<void> {
  console.log('[AUTH_API_TEST] Cleaning up test database...');

  try {
    // Delete all test users and related data
    await executeTransaction(async (client) => {
      // Delete refresh tokens
      await client.query('DELETE FROM refresh_tokens WHERE user_id = ANY($1)', [createdUserIds]);

      // Delete password reset tokens
      await client.query('DELETE FROM password_reset_tokens WHERE user_id = ANY($1)', [createdUserIds]);

      // Delete users
      await client.query('DELETE FROM users WHERE id = ANY($1)', [createdUserIds]);

      // Also delete any users created during registration tests
      await client.query('DELETE FROM users WHERE email LIKE $1', ['%@test.com']);
    });

    createdUserIds = [];
    console.log('[AUTH_API_TEST] Test database cleanup completed');
  } catch (error) {
    console.error('[AUTH_API_TEST] Failed to cleanup test database:', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get User from Database
 * 
 * Retrieves user record by email
 */
async function getUserByEmail(email: string): Promise<DatabaseUser | null> {
  const result = await executeQuery<DatabaseUser>(
    `
    SELECT id, email, password_hash, first_name, last_name, role, is_active,
           failed_login_attempts, locked_until, created_at, updated_at
    FROM users
    WHERE email = $1
    `,
    [email],
    { operation: 'get_test_user' }
  );

  return result.rows[0] || null;
}

/**
 * Wait for Rate Limit Reset
 * 
 * Helper to wait for rate limit window to reset
 */
async function waitForRateLimitReset(ms: number = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Test Suite Setup
 * 
 * Runs before all tests
 */
beforeAll(async () => {
  console.log('[AUTH_API_TEST] Starting test suite setup...');

  try {
    // Create Express app
    app = createApp();

    // Setup test database
    await setupTestDatabase();

    console.log('[AUTH_API_TEST] Test suite setup completed');
  } catch (error) {
    console.error('[AUTH_API_TEST] Test suite setup failed:', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}, 30000);

/**
 * Test Suite Teardown
 * 
 * Runs after all tests
 */
afterAll(async () => {
  console.log('[AUTH_API_TEST] Starting test suite teardown...');

  try {
    // Cleanup test database
    await cleanupTestDatabase();

    // Shutdown database connection
    await shutdownDb({ timeout: 5000 });

    // Reset app instance
    resetApp();

    console.log('[AUTH_API_TEST] Test suite teardown completed');
  } catch (error) {
    console.error('[AUTH_API_TEST] Test suite teardown failed:', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}, 30000);

/**
 * Test Suite: User Registration
 * 
 * Tests for POST /api/auth/register endpoint
 */
describe('POST /api/auth/register', () => {
  /**
   * Test: Successful Registration
   */
  it('should register a new user successfully', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: TEST_USERS.newUser.email,
        password: TEST_USERS.newUser.password,
        firstName: TEST_USERS.newUser.firstName,
        lastName: TEST_USERS.newUser.lastName,
        role: TEST_USERS.newUser.role,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      user: {
        email: TEST_USERS.newUser.email,
        firstName: TEST_USERS.newUser.firstName,
        lastName: TEST_USERS.newUser.lastName,
        role: TEST_USERS.newUser.role,
        isActive: true,
      },
      tokens: {
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: expect.any(Number),
      },
    });

    expect(response.body.user.id).toBeDefined();
    expect(response.body.user.createdAt).toBeDefined();

    // Verify user was created in database
    const user = await getUserByEmail(TEST_USERS.newUser.email);
    expect(user).toBeDefined();
    expect(user?.email).toBe(TEST_USERS.newUser.email);
    expect(user?.is_active).toBe(true);

    // Store user ID for cleanup
    if (user) {
      createdUserIds.push(user.id);
    }
  });

  /**
   * Test: Duplicate Email
   */
  it('should reject registration with duplicate email', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: TEST_USERS.hrAdmin.email,
        password: 'Password123!',
        firstName: 'Duplicate',
        lastName: 'User',
        role: UserRole.Employee,
      })
      .expect(409);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'EMAIL_ALREADY_EXISTS',
        message: expect.stringContaining('already registered'),
      },
    });
  });

  /**
   * Test: Invalid Email Format
   */
  it('should reject registration with invalid email format', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'invalid-email',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.Employee,
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('email'),
      },
    });
  });

  /**
   * Test: Weak Password
   */
  it('should reject registration with weak password', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'weakpass@test.com',
        password: 'weak',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.Employee,
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('password'),
      },
    });
  });

  /**
   * Test: Missing Required Fields
   */
  it('should reject registration with missing required fields', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'incomplete@test.com',
        password: 'Password123!',
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
      },
    });
  });

  /**
   * Test: Invalid Role
   */
  it('should reject registration with invalid role', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'invalidrole@test.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        role: 'INVALID_ROLE',
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('role'),
      },
    });
  });

  /**
   * Test: Rate Limiting
   */
  it('should enforce rate limiting on registration', async () => {
    // Make multiple requests to trigger rate limit
    const requests = Array.from({ length: 11 }, (_, i) =>
      request(app)
        .post('/api/auth/register')
        .send({
          email: `ratelimit${i}@test.com`,
          password: 'Password123!',
          firstName: 'Rate',
          lastName: 'Limit',
          role: UserRole.Employee,
        })
    );

    const responses = await Promise.all(requests);

    // At least one request should be rate limited
    const rateLimitedResponses = responses.filter((r) => r.status === 429);
    expect(rateLimitedResponses.length).toBeGreaterThan(0);

    if (rateLimitedResponses.length > 0) {
      expect(rateLimitedResponses[0]?.body).toMatchObject({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
        },
      });
    }
  }, 30000);
});

/**
 * Test Suite: User Login
 * 
 * Tests for POST /api/auth/login endpoint
 */
describe('POST /api/auth/login', () => {
  /**
   * Test: Successful Login
   */
  it('should login user with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USERS.employee.email,
        password: TEST_USERS.employee.password,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      user: {
        email: TEST_USERS.employee.email,
        firstName: TEST_USERS.employee.firstName,
        lastName: TEST_USERS.employee.lastName,
        role: TEST_USERS.employee.role,
        isActive: true,
      },
      tokens: {
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: expect.any(Number),
      },
    });

    // Verify tokens are valid
    const accessTokenPayload = await verifyToken(response.body.tokens.accessToken, 'access');
    expect(accessTokenPayload.email).toBe(TEST_USERS.employee.email);

    const refreshTokenPayload = await verifyToken(response.body.tokens.refreshToken, 'refresh');
    expect(refreshTokenPayload.email).toBe(TEST_USERS.employee.email);
  });

  /**
   * Test: Invalid Password
   */
  it('should reject login with invalid password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USERS.employee.email,
        password: 'WrongPassword123!',
      })
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: expect.stringContaining('Invalid'),
      },
    });
  });

  /**
   * Test: Non-existent User
   */
  it('should reject login with non-existent email', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@test.com',
        password: 'Password123!',
      })
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
      },
    });
  });

  /**
   * Test: Missing Credentials
   */
  it('should reject login with missing credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USERS.employee.email,
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
      },
    });
  });

  /**
   * Test: Account Lockout
   */
  it('should lock account after multiple failed login attempts', async () => {
    const testEmail = 'lockout@test.com';
    const testPassword = 'Lockout123!';

    // Create test user
    const passwordHash = await bcrypt.hash(testPassword, 10);
    const userResult = await executeQuery<{ id: string }>(
      `
      INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
      `,
      [testEmail, passwordHash, 'Lockout', 'Test', UserRole.Employee, true]
    );

    if (userResult.rows[0]) {
      createdUserIds.push(userResult.rows[0].id);
    }

    // Make 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123!',
        });

      await waitForRateLimitReset(100);
    }

    // 6th attempt should be locked
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      })
      .expect(423);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'ACCOUNT_LOCKED',
        message: expect.stringContaining('locked'),
      },
    });
  }, 30000);

  /**
   * Test: Rate Limiting
   */
  it('should enforce rate limiting on login', async () => {
    // Make multiple requests to trigger rate limit
    const requests = Array.from({ length: 6 }, () =>
      request(app)
        .post('/api/auth/login')
        .send({
          email: TEST_USERS.employee.email,
          password: 'WrongPassword123!',
        })
    );

    const responses = await Promise.all(requests);

    // At least one request should be rate limited
    const rateLimitedResponses = responses.filter((r) => r.status === 429);
    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  }, 30000);
});

/**
 * Test Suite: User Logout
 * 
 * Tests for POST /api/auth/logout endpoint
 */
describe('POST /api/auth/logout', () => {
  let validRefreshToken: string;

  beforeEach(async () => {
    // Login to get a valid refresh token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USERS.manager.email,
        password: TEST_USERS.manager.password,
      });

    validRefreshToken = loginResponse.body.tokens.refreshToken;
  });

  /**
   * Test: Successful Logout
   */
  it('should logout user successfully', async () => {
    const response = await request(app)
      .post('/api/auth/logout')
      .send({
        refreshToken: validRefreshToken,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      message: expect.stringContaining('Logout successful'),
    });

    // Verify refresh token is invalidated
    const refreshResponse = await request(app)
      .post('/api/auth/refresh-token')
      .send({
        refreshToken: validRefreshToken,
      })
      .expect(401);

    expect(refreshResponse.body.error.code).toBe('INVALID_TOKEN');
  });

  /**
   * Test: Invalid Refresh Token
   */
  it('should reject logout with invalid refresh token', async () => {
    const response = await request(app)
      .post('/api/auth/logout')
      .send({
        refreshToken: 'invalid-token',
      })
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
      },
    });
  });

  /**
   * Test: Missing Refresh Token
   */
  it('should reject logout without refresh token', async () => {
    const response = await request(app)
      .post('/api/auth/logout')
      .send({})
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
      },
    });
  });
});

/**
 * Test Suite: Token Refresh
 * 
 * Tests for POST /api/auth/refresh-token endpoint
 */
describe('POST /api/auth/refresh-token', () => {
  let validRefreshToken: string;
  let userId: string;

  beforeEach(async () => {
    // Login to get a valid refresh token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USERS.hrAdmin.email,
        password: TEST_USERS.hrAdmin.password,
      });

    validRefreshToken = loginResponse.body.tokens.refreshToken;
    userId = loginResponse.body.user.id;
  });

  /**
   * Test: Successful Token Refresh
   */
  it('should refresh tokens successfully', async () => {
    const response = await request(app)
      .post('/api/auth/refresh-token')
      .send({
        refreshToken: validRefreshToken,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      tokens: {
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: expect.any(Number),
      },
      message: expect.stringContaining('Token refresh successful'),
    });

    // Verify new tokens are different
    expect(response.body.tokens.accessToken).not.toBe(validRefreshToken);
    expect(response.body.tokens.refreshToken).not.toBe(validRefreshToken);

    // Verify new tokens are valid
    const accessTokenPayload = await verifyToken(response.body.tokens.accessToken, 'access');
    expect(accessTokenPayload.userId).toBe(userId);
  });

  /**
   * Test: Invalid Refresh Token
   */
  it('should reject refresh with invalid token', async () => {
    const response = await request(app)
      .post('/api/auth/refresh-token')
      .send({
        refreshToken: 'invalid-token',
      })
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
      },
    });
  });

  /**
   * Test: Expired Refresh Token
   */
  it('should reject refresh with expired token', async () => {
    // Generate an expired token
    const user = await getUserByEmail(TEST_USERS.hrAdmin.email);
    if (!user) {
      throw new Error('Test user not found');
    }

    const expiredToken = await generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    }, -3600); // Expired 1 hour ago

    const response = await request(app)
      .post('/api/auth/refresh-token')
      .send({
        refreshToken: expiredToken,
      })
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
      },
    });
  });

  /**
   * Test: Reused Refresh Token
   */
  it('should reject reused refresh token', async () => {
    // Use the refresh token once
    await request(app)
      .post('/api/auth/refresh-token')
      .send({
        refreshToken: validRefreshToken,
      })
      .expect(200);

    // Try to use it again
    const response = await request(app)
      .post('/api/auth/refresh-token')
      .send({
        refreshToken: validRefreshToken,
      })
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
      },
    });
  });
});

/**
 * Test Suite: Password Reset Request
 * 
 * Tests for POST /api/auth/request-password-reset endpoint
 */
describe('POST /api/auth/request-password-reset', () => {
  /**
   * Test: Successful Password Reset Request
   */
  it('should request password reset successfully', async () => {
    const response = await request(app)
      .post('/api/auth/request-password-reset')
      .send({
        email: TEST_USERS.employee.email,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      message: expect.stringContaining('password reset'),
    });

    // Verify reset token was created in database
    const result = await executeQuery<{ token: string; expires_at: Date }>(
      `
      SELECT token, expires_at
      FROM password_reset_tokens
      WHERE user_id = (SELECT id FROM users WHERE email = $1)
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [TEST_USERS.employee.email]
    );

    expect(result.rows[0]).toBeDefined();
    expect(result.rows[0]?.token).toBeDefined();
    expect(new Date(result.rows[0]!.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  /**
   * Test: Non-existent Email (Security)
   */
  it('should return success for non-existent email (prevent enumeration)', async () => {
    const response = await request(app)
      .post('/api/auth/request-password-reset')
      .send({
        email: 'nonexistent@test.com',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      message: expect.stringContaining('password reset'),
    });
  });

  /**
   * Test: Invalid Email Format
   */
  it('should reject invalid email format', async () => {
    const response = await request(app)
      .post('/api/auth/request-password-reset')
      .send({
        email: 'invalid-email',
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
      },
    });
  });

  /**
   * Test: Rate Limiting
   */
  it('should enforce rate limiting on password reset requests', async () => {
    // Make multiple requests to trigger rate limit
    const requests = Array.from({ length: 6 }, () =>
      request(app)
        .post('/api/auth/request-password-reset')
        .send({
          email: TEST_USERS.employee.email,
        })
    );

    const responses = await Promise.all(requests);

    // At least one request should be rate limited
    const rateLimitedResponses = responses.filter((r) => r.status === 429);
    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  }, 30000);
});

/**
 * Test Suite: Password Reset Confirmation
 * 
 * Tests for POST /api/auth/reset-password endpoint
 */
describe('POST /api/auth/reset-password', () => {
  let resetToken: string;
  let testUserEmail: string;

  beforeEach(async () => {
    testUserEmail = 'resettest@test.com';
    const testPassword = 'ResetTest123!';

    // Create test user
    const passwordHash = await bcrypt.hash(testPassword, 10);
    const userResult = await executeQuery<{ id: string }>(
      `
      INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
      `,
      [testUserEmail, passwordHash, 'Reset', 'Test', UserRole.Employee, true]
    );

    if (userResult.rows[0]) {
      createdUserIds.push(userResult.rows[0].id);

      // Create password reset token
      resetToken = `reset_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

      await executeQuery(
        `
        INSERT INTO password_reset_tokens (user_id, token, expires_at)
        VALUES ($1, $2, $3)
        `,
        [userResult.rows[0].id, resetToken, expiresAt]
      );
    }
  });

  /**
   * Test: Successful Password Reset
   */
  it('should reset password successfully', async () => {
    const newPassword = 'NewPassword123!';

    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: resetToken,
        newPassword,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      message: expect.stringContaining('Password has been reset'),
    });

    // Verify can login with new password
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUserEmail,
        password: newPassword,
      })
      .expect(200);

    expect(loginResponse.body.success).toBe(true);

    // Verify reset token was deleted
    const tokenResult = await executeQuery(
      `
      SELECT id FROM password_reset_tokens
      WHERE token = $1
      `,
      [resetToken]
    );

    expect(tokenResult.rows.length).toBe(0);
  });

  /**
   * Test: Invalid Reset Token
   */
  it('should reject invalid reset token', async () => {
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: 'invalid-token',
        newPassword: 'NewPassword123!',
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
      },
    });
  });

  /**
   * Test: Expired Reset Token
   */
  it('should reject expired reset token', async () => {
    // Create expired token
    const user = await getUserByEmail(testUserEmail);
    if (!user) {
      throw new Error('Test user not found');
    }

    const expiredToken = `expired_${Date.now()}`;
    const expiredAt = new Date(Date.now() - 3600000); // 1 hour ago

    await executeQuery(
      `
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES ($1, $2, $3)
      `,
      [user.id, expiredToken, expiredAt]
    );

    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: expiredToken,
        newPassword: 'NewPassword123!',
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
      },
    });
  });

  /**
   * Test: Weak New Password
   */
  it('should reject weak new password', async () => {
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: resetToken,
        newPassword: 'weak',
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('password'),
      },
    });
  });

  /**
   * Test: Rate Limiting
   */
  it('should enforce rate limiting on password reset', async () => {
    // Make multiple requests to trigger rate limit
    const requests = Array.from({ length: 4 }, () =>
      request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'some-token',
          newPassword: 'NewPassword123!',
        })
    );

    const responses = await Promise.all(requests);

    // At least one request should be rate limited
    const rateLimitedResponses = responses.filter((r) => r.status === 429);
    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  }, 30000);
});

/**
 * Test Suite: Authentication Health Check
 * 
 * Tests for GET /api/auth/health endpoint
 */
describe('GET /api/auth/health', () => {
  /**
   * Test: Health Check Success
   */
  it('should return healthy status', async () => {
    const response = await request(app)
      .get('/api/auth/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'healthy',
      service: 'authentication',
      timestamp: expect.any(String),
    });
  });
});