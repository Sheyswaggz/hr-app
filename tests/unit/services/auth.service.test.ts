/**
 * Authentication Service Unit Tests
 * 
 * Comprehensive test suite for the AuthService class covering all authentication
 * operations including registration, login, token refresh, logout, and password
 * reset flows. Tests include success cases, error conditions, edge cases, and
 * security scenarios.
 * 
 * @module tests/unit/services/auth.service.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

import { AuthService } from '../../../src/services/auth.service.js';
import * as dbModule from '../../../src/db/index.js';
import * as authConfigModule from '../../../src/config/auth.js';
import * as jwtModule from '../../../src/utils/jwt.js';
import * as passwordModule from '../../../src/utils/password.js';
import { UserRole } from '../../../src/types/index.js';
import type {
  AuthResponse,
  AuthErrorResponse,
  RegisterData,
  LoginCredentials,
  PasswordResetRequest,
  PasswordResetConfirm,
} from '../../../src/types/auth.js';

// Mock modules
vi.mock('../../../src/db/index.js');
vi.mock('../../../src/config/auth.js');
vi.mock('../../../src/utils/jwt.js');
vi.mock('../../../src/utils/password.js');

describe('AuthService', () => {
  let authService: AuthService;
  let mockQueryOne: ReturnType<typeof vi.fn>;
  let mockExecuteQuery: ReturnType<typeof vi.fn>;
  let mockExecuteTransaction: ReturnType<typeof vi.fn>;
  let mockGetAuthConfig: ReturnType<typeof vi.fn>;
  let mockHashPassword: ReturnType<typeof vi.fn>;
  let mockComparePassword: ReturnType<typeof vi.fn>;
  let mockValidatePasswordStrength: ReturnType<typeof vi.fn>;
  let mockGenerateAccessToken: ReturnType<typeof vi.fn>;
  let mockGenerateRefreshToken: ReturnType<typeof vi.fn>;
  let mockVerifyRefreshToken: ReturnType<typeof vi.fn>;

  const mockAuthConfig = {
    jwt: {
      accessTokenSecret: 'test-access-secret',
      refreshTokenSecret: 'test-refresh-secret',
      expiresIn: '1h',
      refreshExpiresIn: '7d',
      algorithm: 'HS256' as const,
      issuer: 'hr-app',
      audience: 'hr-app-users',
    },
    security: {
      maxLoginAttempts: 5,
      lockoutDurationMs: 900000, // 15 minutes
      passwordResetTokenExpiryMs: 3600000, // 1 hour
      bcryptSaltRounds: 10,
    },
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password_hash: '$2b$10$hashedpassword',
    first_name: 'John',
    last_name: 'Doe',
    role: UserRole.Employee,
    is_active: true,
    failed_login_attempts: 0,
    locked_until: null,
    last_login_at: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create fresh service instance
    authService = new AuthService();

    // Setup mock implementations
    mockQueryOne = vi.fn();
    mockExecuteQuery = vi.fn();
    mockExecuteTransaction = vi.fn();
    mockGetAuthConfig = vi.fn().mockReturnValue(mockAuthConfig);
    mockHashPassword = vi.fn();
    mockComparePassword = vi.fn();
    mockValidatePasswordStrength = vi.fn();
    mockGenerateAccessToken = vi.fn();
    mockGenerateRefreshToken = vi.fn();
    mockVerifyRefreshToken = vi.fn();

    // Assign mocks to modules
    vi.mocked(dbModule.queryOne).mockImplementation(mockQueryOne);
    vi.mocked(dbModule.executeQuery).mockImplementation(mockExecuteQuery);
    vi.mocked(dbModule.executeTransaction).mockImplementation(mockExecuteTransaction);
    vi.mocked(authConfigModule.getAuthConfig).mockImplementation(mockGetAuthConfig);
    vi.mocked(passwordModule.hashPassword).mockImplementation(mockHashPassword);
    vi.mocked(passwordModule.comparePassword).mockImplementation(mockComparePassword);
    vi.mocked(passwordModule.validatePasswordStrength).mockImplementation(mockValidatePasswordStrength);
    vi.mocked(jwtModule.generateAccessToken).mockImplementation(mockGenerateAccessToken);
    vi.mocked(jwtModule.generateRefreshToken).mockImplementation(mockGenerateRefreshToken);
    vi.mocked(jwtModule.verifyRefreshToken).mockImplementation(mockVerifyRefreshToken);

    // Mock console methods to reduce noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    const validRegisterData: RegisterData = {
      email: 'newuser@example.com',
      password: 'SecureP@ssw0rd123',
      passwordConfirm: 'SecureP@ssw0rd123',
      firstName: 'Jane',
      lastName: 'Smith',
      role: UserRole.Employee,
    };

    it('should successfully register a new user', async () => {
      // Arrange
      mockValidatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      mockQueryOne.mockResolvedValue(null); // No existing user
      mockHashPassword.mockResolvedValue({
        success: true,
        hash: '$2b$10$newhash',
      });
      mockExecuteTransaction.mockImplementation(async (callback) => {
        return callback({
          query: vi.fn().mockResolvedValue({
            rows: [{ ...mockUser, id: 'new-user-123', email: validRegisterData.email }],
          }),
        });
      });
      mockGenerateAccessToken.mockReturnValue('access-token-123');
      mockGenerateRefreshToken.mockReturnValue('refresh-token-123');

      // Act
      const result = await authService.register(validRegisterData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user?.email).toBe(validRegisterData.email);
        expect(result.user?.firstName).toBe(validRegisterData.firstName);
        expect(result.user?.lastName).toBe(validRegisterData.lastName);
        expect(result.tokens?.accessToken).toBe('access-token-123');
        expect(result.tokens?.refreshToken).toBe('refresh-token-123');
      }
      expect(mockValidatePasswordStrength).toHaveBeenCalledWith(validRegisterData.password);
      expect(mockQueryOne).toHaveBeenCalledWith(
        'SELECT id FROM users WHERE email = $1',
        [validRegisterData.email.toLowerCase()],
        expect.any(Object)
      );
      expect(mockHashPassword).toHaveBeenCalledWith(validRegisterData.password);
    });

    it('should fail when email already exists', async () => {
      // Arrange
      mockValidatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      mockQueryOne.mockResolvedValue({ id: 'existing-user-123' });

      // Act
      const result = await authService.register(validRegisterData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('EMAIL_EXISTS');
        expect(result.message).toContain('already exists');
      }
      expect(mockHashPassword).not.toHaveBeenCalled();
      expect(mockExecuteTransaction).not.toHaveBeenCalled();
    });

    it('should fail when email is missing', async () => {
      // Arrange
      const invalidData = { ...validRegisterData, email: '' };

      // Act
      const result = await authService.register(invalidData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.details?.errors).toContain('Email is required');
      }
    });

    it('should fail when email format is invalid', async () => {
      // Arrange
      const invalidData = { ...validRegisterData, email: 'invalid-email' };

      // Act
      const result = await authService.register(invalidData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.details?.errors).toContain('Invalid email format');
      }
    });

    it('should fail when first name is missing', async () => {
      // Arrange
      const invalidData = { ...validRegisterData, firstName: '' };

      // Act
      const result = await authService.register(invalidData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.details?.errors).toContain('First name is required');
      }
    });

    it('should fail when last name is missing', async () => {
      // Arrange
      const invalidData = { ...validRegisterData, lastName: '' };

      // Act
      const result = await authService.register(invalidData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.details?.errors).toContain('Last name is required');
      }
    });

    it('should fail when passwords do not match', async () => {
      // Arrange
      const invalidData = { ...validRegisterData, passwordConfirm: 'DifferentP@ssw0rd' };

      // Act
      const result = await authService.register(invalidData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.details?.errors).toContain('Passwords do not match');
      }
    });

    it('should fail when password is weak', async () => {
      // Arrange
      mockValidatePasswordStrength.mockReturnValue({
        isValid: false,
        errors: ['Password must be at least 8 characters', 'Password must contain uppercase letter'],
      });

      // Act
      const result = await authService.register(validRegisterData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.details?.errors).toContain('Password must be at least 8 characters');
      }
    });

    it('should fail when password hashing fails', async () => {
      // Arrange
      mockValidatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      mockQueryOne.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue({
        success: false,
        error: 'Hashing failed',
      });

      // Act
      const result = await authService.register(validRegisterData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('HASH_ERROR');
        expect(result.message).toContain('Failed to process password');
      }
    });

    it('should fail when database transaction fails', async () => {
      // Arrange
      mockValidatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      mockQueryOne.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue({
        success: true,
        hash: '$2b$10$newhash',
      });
      mockExecuteTransaction.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await authService.register(validRegisterData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('REGISTRATION_ERROR');
        expect(result.details?.error).toContain('Database error');
      }
    });

    it('should default role to EMPLOYEE when not provided', async () => {
      // Arrange
      const dataWithoutRole = { ...validRegisterData, role: undefined };
      mockValidatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      mockQueryOne.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue({
        success: true,
        hash: '$2b$10$newhash',
      });
      mockExecuteTransaction.mockImplementation(async (callback) => {
        return callback({
          query: vi.fn().mockResolvedValue({
            rows: [{ ...mockUser, role: UserRole.Employee }],
          }),
        });
      });
      mockGenerateAccessToken.mockReturnValue('access-token-123');
      mockGenerateRefreshToken.mockReturnValue('refresh-token-123');

      // Act
      const result = await authService.register(dataWithoutRole);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user?.role).toBe(UserRole.Employee);
      }
    });
  });

  describe('login', () => {
    const validCredentials: LoginCredentials = {
      email: 'test@example.com',
      password: 'SecureP@ssw0rd123',
    };

    it('should successfully login with valid credentials', async () => {
      // Arrange
      mockQueryOne.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue({
        success: true,
        isMatch: true,
      });
      mockExecuteQuery.mockResolvedValue({ rows: [], rowCount: 1 });
      mockGenerateAccessToken.mockReturnValue('access-token-123');
      mockGenerateRefreshToken.mockReturnValue('refresh-token-123');

      // Act
      const result = await authService.login(validCredentials);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user?.id).toBe(mockUser.id);
        expect(result.user?.email).toBe(mockUser.email);
        expect(result.tokens?.accessToken).toBe('access-token-123');
        expect(result.tokens?.refreshToken).toBe('refresh-token-123');
      }
      expect(mockQueryOne).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1',
        [validCredentials.email.toLowerCase()],
        expect.any(Object)
      );
      expect(mockComparePassword).toHaveBeenCalledWith(
        validCredentials.password,
        mockUser.password_hash
      );
    });

    it('should fail when user does not exist', async () => {
      // Arrange
      mockQueryOne.mockResolvedValue(null);

      // Act
      const result = await authService.login(validCredentials);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('INVALID_CREDENTIALS');
        expect(result.message).toContain('Invalid email or password');
      }
      expect(mockComparePassword).not.toHaveBeenCalled();
    });

    it('should fail when password is incorrect', async () => {
      // Arrange
      mockQueryOne.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue({
        success: true,
        isMatch: false,
      });
      mockExecuteQuery.mockResolvedValue({ rows: [], rowCount: 1 });

      // Act
      const result = await authService.login(validCredentials);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('INVALID_CREDENTIALS');
        expect(result.message).toContain('Invalid email or password');
      }
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining([1]),
        expect.any(Object)
      );
    });

    it('should increment failed login attempts on wrong password', async () => {
      // Arrange
      mockQueryOne.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue({
        success: true,
        isMatch: false,
      });
      mockExecuteQuery.mockResolvedValue({ rows: [], rowCount: 1 });

      // Act
      await authService.login(validCredentials);

      // Assert
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('failed_login_attempts'),
        expect.arrayContaining([1]),
        expect.any(Object)
      );
    });

    it('should lock account after max failed attempts', async () => {
      // Arrange
      const userWithFailedAttempts = {
        ...mockUser,
        failed_login_attempts: 4,
      };
      mockQueryOne.mockResolvedValue(userWithFailedAttempts);
      mockComparePassword.mockResolvedValue({
        success: true,
        isMatch: false,
      });
      mockExecuteQuery.mockResolvedValue({ rows: [], rowCount: 1 });

      // Act
      const result = await authService.login(validCredentials);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('ACCOUNT_LOCKED');
        expect(result.lockout?.isLocked).toBe(true);
        expect(result.lockout?.failedAttempts).toBe(5);
      }
    });

    it('should fail when account is locked', async () => {
      // Arrange
      const lockedUser = {
        ...mockUser,
        failed_login_attempts: 5,
        locked_until: new Date(Date.now() + 900000), // 15 minutes from now
      };
      mockQueryOne.mockResolvedValue(lockedUser);

      // Act
      const result = await authService.login(validCredentials);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('ACCOUNT_LOCKED');
        expect(result.lockout?.isLocked).toBe(true);
        expect(result.lockout?.remainingLockTimeSeconds).toBeGreaterThan(0);
      }
      expect(mockComparePassword).not.toHaveBeenCalled();
    });

    it('should fail when account is inactive', async () => {
      // Arrange
      const inactiveUser = { ...mockUser, is_active: false };
      mockQueryOne.mockResolvedValue(inactiveUser);

      // Act
      const result = await authService.login(validCredentials);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('ACCOUNT_INACTIVE');
        expect(result.message).toContain('inactive');
      }
    });

    it('should fail when email is missing', async () => {
      // Arrange
      const invalidCredentials = { ...validCredentials, email: '' };

      // Act
      const result = await authService.login(invalidCredentials);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should fail when password is missing', async () => {
      // Arrange
      const invalidCredentials = { ...validCredentials, password: '' };

      // Act
      const result = await authService.login(invalidCredentials);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should reset failed attempts on successful login', async () => {
      // Arrange
      const userWithFailedAttempts = {
        ...mockUser,
        failed_login_attempts: 3,
      };
      mockQueryOne.mockResolvedValue(userWithFailedAttempts);
      mockComparePassword.mockResolvedValue({
        success: true,
        isMatch: true,
      });
      mockExecuteQuery.mockResolvedValue({ rows: [], rowCount: 1 });
      mockGenerateAccessToken.mockReturnValue('access-token-123');
      mockGenerateRefreshToken.mockReturnValue('refresh-token-123');

      // Act
      const result = await authService.login(validCredentials);

      // Assert
      expect(result.success).toBe(true);
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('failed_login_attempts = 0'),
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockQueryOne.mockRejectedValue(new Error('Database connection failed'));

      // Act
      const result = await authService.login(validCredentials);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('LOGIN_ERROR');
        expect(result.details?.error).toContain('Database connection failed');
      }
    });
  });

  describe('refreshToken', () => {
    const validRefreshToken = 'valid-refresh-token';
    const mockPayload = {
      userId: mockUser.id,
      email: mockUser.email,
      jti: 'token-jti-123',
      family: 'token-family-123',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 604800,
    };

    it('should successfully refresh tokens', async () => {
      // Arrange
      mockVerifyRefreshToken.mockResolvedValue({
        valid: true,
        payload: mockPayload,
      });
      mockQueryOne.mockResolvedValueOnce(null); // Not blacklisted
      mockQueryOne.mockResolvedValueOnce(mockUser); // User exists
      mockGenerateAccessToken.mockReturnValue('new-access-token');
      mockGenerateRefreshToken.mockReturnValue('new-refresh-token');

      // Act
      const result = await authService.refreshToken(validRefreshToken);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tokens?.accessToken).toBe('new-access-token');
        expect(result.tokens?.refreshToken).toBe('new-refresh-token');
        expect(result.user?.id).toBe(mockUser.id);
      }
      expect(mockVerifyRefreshToken).toHaveBeenCalledWith(
        validRefreshToken,
        expect.any(Object)
      );
    });

    it('should fail when refresh token is invalid', async () => {
      // Arrange
      mockVerifyRefreshToken.mockResolvedValue({
        valid: false,
        error: 'Token expired',
        errorCode: 'TOKEN_EXPIRED',
      });

      // Act
      const result = await authService.refreshToken(validRefreshToken);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('TOKEN_EXPIRED');
        expect(result.message).toContain('Token expired');
      }
    });

    it('should fail when token is blacklisted', async () => {
      // Arrange
      mockVerifyRefreshToken.mockResolvedValue({
        valid: true,
        payload: mockPayload,
      });
      mockQueryOne.mockResolvedValueOnce({ id: 'blacklist-entry-123' }); // Blacklisted

      // Act
      const result = await authService.refreshToken(validRefreshToken);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('TOKEN_REVOKED');
        expect(result.message).toContain('revoked');
      }
    });

    it('should fail when user does not exist', async () => {
      // Arrange
      mockVerifyRefreshToken.mockResolvedValue({
        valid: true,
        payload: mockPayload,
      });
      mockQueryOne.mockResolvedValueOnce(null); // Not blacklisted
      mockQueryOne.mockResolvedValueOnce(null); // User not found

      // Act
      const result = await authService.refreshToken(validRefreshToken);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('USER_NOT_FOUND');
      }
    });

    it('should fail when user account is inactive', async () => {
      // Arrange
      const inactiveUser = { ...mockUser, is_active: false };
      mockVerifyRefreshToken.mockResolvedValue({
        valid: true,
        payload: mockPayload,
      });
      mockQueryOne.mockResolvedValueOnce(null); // Not blacklisted
      mockQueryOne.mockResolvedValueOnce(inactiveUser); // Inactive user

      // Act
      const result = await authService.refreshToken(validRefreshToken);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('ACCOUNT_INACTIVE');
      }
    });

    it('should handle verification errors gracefully', async () => {
      // Arrange
      mockVerifyRefreshToken.mockRejectedValue(new Error('Verification failed'));

      // Act
      const result = await authService.refreshToken(validRefreshToken);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('REFRESH_ERROR');
      }
    });
  });

  describe('logout', () => {
    const tokenJti = 'token-jti-123';
    const userId = 'user-123';
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;

    it('should successfully logout and blacklist token', async () => {
      // Arrange
      mockExecuteQuery.mockResolvedValue({ rows: [], rowCount: 1 });

      // Act
      const result = await authService.logout(tokenJti, userId, expiresAt);

      // Assert
      expect(result.success).toBe(true);
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO token_blacklist'),
        expect.arrayContaining([tokenJti, userId]),
        expect.any(Object)
      );
    });

    it('should handle duplicate blacklist entries gracefully', async () => {
      // Arrange
      mockExecuteQuery.mockResolvedValue({ rows: [], rowCount: 0 }); // ON CONFLICT DO NOTHING

      // Act
      const result = await authService.logout(tokenJti, userId, expiresAt);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should handle database errors during logout', async () => {
      // Arrange
      mockExecuteQuery.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await authService.logout(tokenJti, userId, expiresAt);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
      expect(result.errorCode).toBe('LOGOUT_ERROR');
    });
  });

  describe('resetPassword', () => {
    const validRequest: PasswordResetRequest = {
      email: 'test@example.com',
    };

    it('should successfully initiate password reset', async () => {
      // Arrange
      mockQueryOne.mockResolvedValue(mockUser);
      mockExecuteQuery.mockResolvedValue({ rows: [], rowCount: 1 });

      // Act
      const result = await authService.resetPassword(validRequest);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.token).toBeDefined();
      expect(result.data?.token).not.toBe('dummy_token_for_security');
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, email, is_active FROM users'),
        [validRequest.email.toLowerCase()],
        expect.any(Object)
      );
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO password_reset_tokens'),
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('should return dummy token when user does not exist', async () => {
      // Arrange
      mockQueryOne.mockResolvedValue(null);

      // Act
      const result = await authService.resetPassword(validRequest);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.token).toBe('dummy_token_for_security');
      expect(mockExecuteQuery).not.toHaveBeenCalled();
    });

    it('should return dummy token when user is inactive', async () => {
      // Arrange
      const inactiveUser = { ...mockUser, is_active: false };
      mockQueryOne.mockResolvedValue(inactiveUser);

      // Act
      const result = await authService.resetPassword(validRequest);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.token).toBe('dummy_token_for_security');
      expect(mockExecuteQuery).not.toHaveBeenCalled();
    });

    it('should fail when email is invalid', async () => {
      // Arrange
      const invalidRequest = { email: 'invalid-email' };

      // Act
      const result = await authService.resetPassword(invalidRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_EMAIL');
    });

    it('should handle database errors during token storage', async () => {
      // Arrange
      mockQueryOne.mockResolvedValue(mockUser);
      mockExecuteQuery.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await authService.resetPassword(validRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('RESET_ERROR');
    });
  });

  describe('validateResetToken', () => {
    const validToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(validToken).digest('hex');

    it('should successfully validate reset token', async () => {
      // Arrange
      const mockResetToken = {
        id: 'reset-token-123',
        user_id: mockUser.id,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 3600000),
        used_at: null,
        created_at: new Date(),
      };
      mockQueryOne.mockResolvedValue(mockResetToken);

      // Act
      const result = await authService.validateResetToken(validToken);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.userId).toBe(mockUser.id);
    });

    it('should fail when token does not exist', async () => {
      // Arrange
      mockQueryOne.mockResolvedValue(null);

      // Act
      const result = await authService.validateResetToken(validToken);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_TOKEN');
    });

    it('should fail when token is empty', async () => {
      // Act
      const result = await authService.validateResetToken('');

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_TOKEN');
    });

    it('should handle database errors during validation', async () => {
      // Arrange
      mockQueryOne.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await authService.validateResetToken(validToken);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('confirmPasswordReset', () => {
    const validToken = crypto.randomBytes(32).toString('hex');
    const validConfirmData: PasswordResetConfirm = {
      token: validToken,
      password: 'NewSecureP@ssw0rd123',
      passwordConfirm: 'NewSecureP@ssw0rd123',
    };

    it('should successfully reset password', async () => {
      // Arrange
      const tokenHash = crypto.createHash('sha256').update(validToken).digest('hex');
      const mockResetToken = {
        id: 'reset-token-123',
        user_id: mockUser.id,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 3600000),
        used_at: null,
        created_at: new Date(),
      };
      mockValidatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      mockQueryOne.mockResolvedValue(mockResetToken);
      mockHashPassword.mockResolvedValue({
        success: true,
        hash: '$2b$10$newhash',
      });
      mockExecuteTransaction.mockImplementation(async (callback) => {
        return callback({
          query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
        });
      });

      // Act
      const result = await authService.confirmPasswordReset(validConfirmData);

      // Assert
      expect(result.success).toBe(true);
      expect(mockHashPassword).toHaveBeenCalledWith(validConfirmData.password);
    });

    it('should fail when passwords do not match', async () => {
      // Arrange
      const invalidData = {
        ...validConfirmData,
        passwordConfirm: 'DifferentPassword',
      };

      // Act
      const result = await authService.confirmPasswordReset(invalidData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_ERROR');
      expect(result.error).toContain('Passwords do not match');
    });

    it('should fail when password is weak', async () => {
      // Arrange
      mockValidatePasswordStrength.mockReturnValue({
        isValid: false,
        errors: ['Password must be at least 8 characters'],
      });

      // Act
      const result = await authService.confirmPasswordReset(validConfirmData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should fail when token is invalid', async () => {
      // Arrange
      mockValidatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      mockQueryOne.mockResolvedValue(null);

      // Act
      const result = await authService.confirmPasswordReset(validConfirmData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_TOKEN');
    });

    it('should fail when password hashing fails', async () => {
      // Arrange
      const tokenHash = crypto.createHash('sha256').update(validToken).digest('hex');
      const mockResetToken = {
        id: 'reset-token-123',
        user_id: mockUser.id,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 3600000),
        used_at: null,
        created_at: new Date(),
      };
      mockValidatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      mockQueryOne.mockResolvedValue(mockResetToken);
      mockHashPassword.mockResolvedValue({
        success: false,
        error: 'Hashing failed',
      });

      // Act
      const result = await authService.confirmPasswordReset(validConfirmData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('HASH_ERROR');
    });

    it('should handle transaction errors gracefully', async () => {
      // Arrange
      const tokenHash = crypto.createHash('sha256').update(validToken).digest('hex');
      const mockResetToken = {
        id: 'reset-token-123',
        user_id: mockUser.id,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 3600000),
        used_at: null,
        created_at: new Date(),
      };
      mockValidatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: [],
      });
      mockQueryOne.mockResolvedValue(mockResetToken);
      mockHashPassword.mockResolvedValue({
        success: true,
        hash: '$2b$10$newhash',
      });
      mockExecuteTransaction.mockRejectedValue(new Error('Transaction failed'));

      // Act
      const result = await authService.confirmPasswordReset(validConfirmData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('RESET_CONFIRM_ERROR');
    });
  });
});