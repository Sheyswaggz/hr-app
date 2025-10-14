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
import { randomBytes } from 'crypto';

import { AuthService, AuthServiceError, AuthErrorCode } from '../../../src/services/auth.service.js';
import * as db from '../../../src/db/index.js';
import * as passwordUtils from '../../../src/utils/password.js';
import * as jwtUtils from '../../../src/utils/jwt.js';
import * as authConfig from '../../../src/config/auth.js';
import { UserRole } from '../../../src/types/index.js';
import type {
  RegisterData,
  LoginCredentials,
  PasswordResetRequest,
  PasswordResetConfirmation,
} from '../../../src/types/auth.js';

// Mock modules
vi.mock('../../../src/db/index.js');
vi.mock('../../../src/utils/password.js');
vi.mock('../../../src/utils/jwt.js');
vi.mock('../../../src/config/auth.js');

describe('AuthService', () => {
  let authService: AuthService;

  // Mock data
  const mockUserId = 'user-123';
  const mockEmail = 'test@example.com';
  const mockPassword = 'SecurePass123!';
  const mockPasswordHash = '$2b$10$hashedpassword';
  const mockTokenId = 'token-123';
  const mockAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access';
  const mockRefreshToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh';
  const mockResetToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.reset';

  const mockUserRecord = {
    id: mockUserId,
    email: mockEmail,
    password_hash: mockPasswordHash,
    first_name: 'John',
    last_name: 'Doe',
    role: UserRole.Employee,
    is_active: true,
    failed_login_attempts: 0,
    locked_until: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  };

  const mockJWTConfig = {
    accessTokenExpiry: 3600,
    refreshTokenExpiry: 86400,
    passwordResetTokenExpiry: 3600,
    issuer: 'hr-app',
    audience: 'hr-app-users',
  };

  beforeEach(() => {
    authService = new AuthService();
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(authConfig.getJWTConfig).mockReturnValue(mockJWTConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    const validRegisterData: RegisterData = {
      email: mockEmail,
      password: mockPassword,
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.Employee,
    };

    it('should successfully register a new user', async () => {
      // Arrange
      vi.mocked(passwordUtils.validatePassword).mockReturnValue({
        isValid: true,
        errors: [],
        strengthScore: 4,
      });

      vi.mocked(db.queryOne).mockResolvedValue(null); // No existing user

      vi.mocked(passwordUtils.hashPassword).mockResolvedValue({
        hash: mockPasswordHash,
        algorithm: 'bcrypt',
        saltRounds: 10,
      });

      vi.mocked(db.executeTransaction).mockResolvedValue(mockUserRecord);

      vi.mocked(jwtUtils.generateAccessToken).mockReturnValue(mockAccessToken);
      vi.mocked(jwtUtils.generateRefreshToken).mockReturnValue(mockRefreshToken);

      // Act
      const result = await authService.register(validRegisterData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.user).toEqual({
        id: mockUserId,
        email: mockEmail,
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.Employee,
        isActive: true,
      });
      expect(result.tokens).toEqual({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresIn: 3600,
        tokenType: 'Bearer',
      });
      expect(result.message).toBe('Registration successful');

      // Verify password validation was called
      expect(passwordUtils.validatePassword).toHaveBeenCalledWith(mockPassword);

      // Verify email check was performed
      expect(db.queryOne).toHaveBeenCalledWith(
        'SELECT id FROM users WHERE email = $1',
        [mockEmail.toLowerCase()],
        expect.objectContaining({ operation: 'check_email_exists' })
      );

      // Verify password was hashed
      expect(passwordUtils.hashPassword).toHaveBeenCalledWith(mockPassword);

      // Verify user was created in transaction
      expect(db.executeTransaction).toHaveBeenCalled();

      // Verify tokens were generated
      expect(jwtUtils.generateAccessToken).toHaveBeenCalled();
      expect(jwtUtils.generateRefreshToken).toHaveBeenCalled();
    });

    it('should reject registration with duplicate email', async () => {
      // Arrange
      vi.mocked(passwordUtils.validatePassword).mockReturnValue({
        isValid: true,
        errors: [],
        strengthScore: 4,
      });

      vi.mocked(db.queryOne).mockResolvedValue({ id: 'existing-user-id' });

      // Act & Assert
      await expect(authService.register(validRegisterData)).rejects.toThrow(AuthServiceError);

      try {
        await authService.register(validRegisterData);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.EMAIL_ALREADY_EXISTS);
        expect((error as AuthServiceError).message).toBe('Email address is already registered');
      }

      // Verify password hashing was not called
      expect(passwordUtils.hashPassword).not.toHaveBeenCalled();
      expect(db.executeTransaction).not.toHaveBeenCalled();
    });

    it('should reject registration with invalid email format', async () => {
      // Arrange
      const invalidData = { ...validRegisterData, email: 'invalid-email' };

      // Act & Assert
      await expect(authService.register(invalidData)).rejects.toThrow(AuthServiceError);

      try {
        await authService.register(invalidData);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.VALIDATION_ERROR);
        expect((error as AuthServiceError).message).toBe('Invalid email format');
      }

      // Verify no database operations were performed
      expect(db.queryOne).not.toHaveBeenCalled();
      expect(passwordUtils.hashPassword).not.toHaveBeenCalled();
    });

    it('should reject registration with weak password', async () => {
      // Arrange
      vi.mocked(passwordUtils.validatePassword).mockReturnValue({
        isValid: false,
        errors: ['Password must be at least 8 characters', 'Password must contain uppercase letter'],
        strengthScore: 1,
      });

      // Act & Assert
      await expect(authService.register(validRegisterData)).rejects.toThrow(AuthServiceError);

      try {
        await authService.register(validRegisterData);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.WEAK_PASSWORD);
        expect((error as AuthServiceError).message).toBe('Password does not meet strength requirements');
        expect((error as AuthServiceError).details).toHaveProperty('errors');
        expect((error as AuthServiceError).details).toHaveProperty('strengthScore', 1);
      }

      // Verify no database operations were performed
      expect(db.queryOne).not.toHaveBeenCalled();
      expect(passwordUtils.hashPassword).not.toHaveBeenCalled();
    });

    it('should reject registration with empty first name', async () => {
      // Arrange
      const invalidData = { ...validRegisterData, firstName: '' };

      vi.mocked(passwordUtils.validatePassword).mockReturnValue({
        isValid: true,
        errors: [],
        strengthScore: 4,
      });

      // Act & Assert
      await expect(authService.register(invalidData)).rejects.toThrow(AuthServiceError);

      try {
        await authService.register(invalidData);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.VALIDATION_ERROR);
        expect((error as AuthServiceError).message).toBe('First name is required');
      }
    });

    it('should reject registration with empty last name', async () => {
      // Arrange
      const invalidData = { ...validRegisterData, lastName: '   ' };

      vi.mocked(passwordUtils.validatePassword).mockReturnValue({
        isValid: true,
        errors: [],
        strengthScore: 4,
      });

      // Act & Assert
      await expect(authService.register(invalidData)).rejects.toThrow(AuthServiceError);

      try {
        await authService.register(invalidData);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.VALIDATION_ERROR);
        expect((error as AuthServiceError).message).toBe('Last name is required');
      }
    });

    it('should normalize email to lowercase', async () => {
      // Arrange
      const dataWithUppercaseEmail = { ...validRegisterData, email: 'TEST@EXAMPLE.COM' };

      vi.mocked(passwordUtils.validatePassword).mockReturnValue({
        isValid: true,
        errors: [],
        strengthScore: 4,
      });

      vi.mocked(db.queryOne).mockResolvedValue(null);
      vi.mocked(passwordUtils.hashPassword).mockResolvedValue({
        hash: mockPasswordHash,
        algorithm: 'bcrypt',
        saltRounds: 10,
      });
      vi.mocked(db.executeTransaction).mockResolvedValue(mockUserRecord);
      vi.mocked(jwtUtils.generateAccessToken).mockReturnValue(mockAccessToken);
      vi.mocked(jwtUtils.generateRefreshToken).mockReturnValue(mockRefreshToken);

      // Act
      await authService.register(dataWithUppercaseEmail);

      // Assert
      expect(db.queryOne).toHaveBeenCalledWith(
        'SELECT id FROM users WHERE email = $1',
        ['test@example.com'],
        expect.any(Object)
      );
    });
  });

  describe('login', () => {
    const validCredentials: LoginCredentials = {
      email: mockEmail,
      password: mockPassword,
    };

    it('should successfully login with valid credentials', async () => {
      // Arrange
      vi.mocked(db.queryOne).mockResolvedValue(mockUserRecord);

      vi.mocked(passwordUtils.comparePassword).mockResolvedValue({
        match: true,
        timingMs: 50,
      });

      vi.mocked(db.executeQuery).mockResolvedValue({
        rows: [],
        rowCount: 1,
        executionTimeMs: 10,
        context: {} as any,
      });

      vi.mocked(jwtUtils.generateAccessToken).mockReturnValue(mockAccessToken);
      vi.mocked(jwtUtils.generateRefreshToken).mockReturnValue(mockRefreshToken);

      // Act
      const result = await authService.login(validCredentials);

      // Assert
      expect(result.success).toBe(true);
      expect(result.user).toEqual({
        id: mockUserId,
        email: mockEmail,
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.Employee,
        isActive: true,
      });
      expect(result.tokens).toBeDefined();
      expect(result.message).toBe('Login successful');

      // Verify user lookup
      expect(db.queryOne).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1',
        [mockEmail.toLowerCase()],
        expect.objectContaining({ operation: 'find_user_by_email' })
      );

      // Verify password comparison
      expect(passwordUtils.comparePassword).toHaveBeenCalledWith(mockPassword, mockPasswordHash);

      // Verify failed attempts were reset
      expect(db.executeQuery).toHaveBeenCalledWith(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
        [mockUserId],
        expect.objectContaining({ operation: 'reset_failed_attempts' })
      );
    });

    it('should reject login with non-existent user', async () => {
      // Arrange
      vi.mocked(db.queryOne).mockResolvedValue(null);

      // Act & Assert
      await expect(authService.login(validCredentials)).rejects.toThrow(AuthServiceError);

      try {
        await authService.login(validCredentials);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
        expect((error as AuthServiceError).message).toBe('Invalid email or password');
      }

      // Verify password comparison was not called
      expect(passwordUtils.comparePassword).not.toHaveBeenCalled();
    });

    it('should reject login with wrong password', async () => {
      // Arrange
      vi.mocked(db.queryOne).mockResolvedValue(mockUserRecord);

      vi.mocked(passwordUtils.comparePassword).mockResolvedValue({
        match: false,
        timingMs: 50,
      });

      vi.mocked(db.executeQuery).mockResolvedValue({
        rows: [],
        rowCount: 1,
        executionTimeMs: 10,
        context: {} as any,
      });

      // Act & Assert
      await expect(authService.login(validCredentials)).rejects.toThrow(AuthServiceError);

      try {
        await authService.login(validCredentials);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
        expect((error as AuthServiceError).message).toBe('Invalid email or password');
      }

      // Verify failed login attempt was recorded
      expect(db.executeQuery).toHaveBeenCalledWith(
        'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
        [1, null, mockUserId],
        expect.objectContaining({ operation: 'update_failed_attempts' })
      );
    });

    it('should reject login for locked account', async () => {
      // Arrange
      const lockedUser = {
        ...mockUserRecord,
        locked_until: new Date(Date.now() + 30 * 60 * 1000), // Locked for 30 minutes
      };

      vi.mocked(db.queryOne).mockResolvedValue(lockedUser);

      // Act & Assert
      await expect(authService.login(validCredentials)).rejects.toThrow(AuthServiceError);

      try {
        await authService.login(validCredentials);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.ACCOUNT_LOCKED);
        expect((error as AuthServiceError).message).toContain('Account is locked');
        expect((error as AuthServiceError).details).toHaveProperty('lockedUntil');
        expect((error as AuthServiceError).details).toHaveProperty('remainingMinutes');
      }

      // Verify password comparison was not called
      expect(passwordUtils.comparePassword).not.toHaveBeenCalled();
    });

    it('should reject login for inactive account', async () => {
      // Arrange
      const inactiveUser = {
        ...mockUserRecord,
        is_active: false,
      };

      vi.mocked(db.queryOne).mockResolvedValue(inactiveUser);

      // Act & Assert
      await expect(authService.login(validCredentials)).rejects.toThrow(AuthServiceError);

      try {
        await authService.login(validCredentials);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.ACCOUNT_INACTIVE);
        expect((error as AuthServiceError).message).toBe('Account is inactive. Please contact support.');
      }

      // Verify password comparison was not called
      expect(passwordUtils.comparePassword).not.toHaveBeenCalled();
    });

    it('should lock account after 5 failed login attempts', async () => {
      // Arrange
      const userWithFailedAttempts = {
        ...mockUserRecord,
        failed_login_attempts: 4,
      };

      vi.mocked(db.queryOne).mockResolvedValue(userWithFailedAttempts);

      vi.mocked(passwordUtils.comparePassword).mockResolvedValue({
        match: false,
        timingMs: 50,
      });

      vi.mocked(db.executeQuery).mockResolvedValue({
        rows: [],
        rowCount: 1,
        executionTimeMs: 10,
        context: {} as any,
      });

      // Act & Assert
      await expect(authService.login(validCredentials)).rejects.toThrow(AuthServiceError);

      // Verify account was locked
      expect(db.executeQuery).toHaveBeenCalledWith(
        'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
        [5, expect.any(Date), mockUserId],
        expect.objectContaining({ operation: 'update_failed_attempts' })
      );
    });

    it('should reject login with missing credentials', async () => {
      // Arrange
      const invalidCredentials = { email: '', password: '' };

      // Act & Assert
      await expect(authService.login(invalidCredentials)).rejects.toThrow(AuthServiceError);

      try {
        await authService.login(invalidCredentials);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.VALIDATION_ERROR);
        expect((error as AuthServiceError).message).toBe('Email and password are required');
      }

      // Verify no database operations were performed
      expect(db.queryOne).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    const mockRefreshPayload = {
      userId: mockUserId,
      email: mockEmail,
      tokenId: mockTokenId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    };

    it('should successfully refresh token', async () => {
      // Arrange
      vi.mocked(jwtUtils.verifyRefreshToken).mockReturnValue(mockRefreshPayload);

      vi.mocked(db.queryOne)
        .mockResolvedValueOnce(null) // Token not blacklisted
        .mockResolvedValueOnce(mockUserRecord); // User exists

      vi.mocked(jwtUtils.generateAccessToken).mockReturnValue(mockAccessToken);
      vi.mocked(jwtUtils.generateRefreshToken).mockReturnValue(mockRefreshToken);

      // Act
      const result = await authService.refreshToken(mockRefreshToken);

      // Assert
      expect(result).toEqual({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresIn: 3600,
        tokenType: 'Bearer',
      });

      // Verify token was verified
      expect(jwtUtils.verifyRefreshToken).toHaveBeenCalledWith(
        mockRefreshToken,
        expect.any(Object)
      );

      // Verify blacklist check
      expect(db.queryOne).toHaveBeenCalledWith(
        'SELECT token_id FROM token_blacklist WHERE token_id = $1 AND expires_at > NOW()',
        [mockTokenId],
        expect.objectContaining({ operation: 'check_token_blacklist' })
      );

      // Verify user lookup
      expect(db.queryOne).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        [mockUserId],
        expect.objectContaining({ operation: 'find_user_by_id' })
      );
    });

    it('should reject blacklisted refresh token', async () => {
      // Arrange
      vi.mocked(jwtUtils.verifyRefreshToken).mockReturnValue(mockRefreshPayload);

      vi.mocked(db.queryOne).mockResolvedValue({ token_id: mockTokenId }); // Token is blacklisted

      // Act & Assert
      await expect(authService.refreshToken(mockRefreshToken)).rejects.toThrow(AuthServiceError);

      try {
        await authService.refreshToken(mockRefreshToken);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.TOKEN_BLACKLISTED);
        expect((error as AuthServiceError).message).toBe('Refresh token has been revoked');
      }
    });

    it('should reject refresh token for non-existent user', async () => {
      // Arrange
      vi.mocked(jwtUtils.verifyRefreshToken).mockReturnValue(mockRefreshPayload);

      vi.mocked(db.queryOne)
        .mockResolvedValueOnce(null) // Token not blacklisted
        .mockResolvedValueOnce(null); // User not found

      // Act & Assert
      await expect(authService.refreshToken(mockRefreshToken)).rejects.toThrow(AuthServiceError);

      try {
        await authService.refreshToken(mockRefreshToken);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.USER_NOT_FOUND);
        expect((error as AuthServiceError).message).toBe('User not found');
      }
    });

    it('should reject refresh token for inactive user', async () => {
      // Arrange
      const inactiveUser = { ...mockUserRecord, is_active: false };

      vi.mocked(jwtUtils.verifyRefreshToken).mockReturnValue(mockRefreshPayload);

      vi.mocked(db.queryOne)
        .mockResolvedValueOnce(null) // Token not blacklisted
        .mockResolvedValueOnce(inactiveUser); // User is inactive

      // Act & Assert
      await expect(authService.refreshToken(mockRefreshToken)).rejects.toThrow(AuthServiceError);

      try {
        await authService.refreshToken(mockRefreshToken);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.ACCOUNT_INACTIVE);
        expect((error as AuthServiceError).message).toBe('Account is inactive');
      }
    });

    it('should reject invalid refresh token', async () => {
      // Arrange
      vi.mocked(jwtUtils.verifyRefreshToken).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(authService.refreshToken('invalid-token')).rejects.toThrow(AuthServiceError);

      try {
        await authService.refreshToken('invalid-token');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.INVALID_TOKEN);
      }
    });
  });

  describe('logout', () => {
    const mockRefreshPayload = {
      userId: mockUserId,
      email: mockEmail,
      tokenId: mockTokenId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    };

    it('should successfully logout and blacklist token', async () => {
      // Arrange
      vi.mocked(jwtUtils.verifyRefreshToken).mockReturnValue(mockRefreshPayload);

      vi.mocked(db.executeQuery).mockResolvedValue({
        rows: [],
        rowCount: 1,
        executionTimeMs: 10,
        context: {} as any,
      });

      // Act
      await authService.logout(mockRefreshToken);

      // Assert
      expect(jwtUtils.verifyRefreshToken).toHaveBeenCalledWith(
        mockRefreshToken,
        expect.any(Object)
      );

      expect(db.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO token_blacklist'),
        [mockTokenId, mockUserId, expect.any(Date)],
        expect.objectContaining({ operation: 'blacklist_token' })
      );
    });

    it('should handle invalid token during logout', async () => {
      // Arrange
      vi.mocked(jwtUtils.verifyRefreshToken).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(authService.logout('invalid-token')).rejects.toThrow(AuthServiceError);

      try {
        await authService.logout('invalid-token');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.INVALID_TOKEN);
      }

      // Verify blacklist operation was not called
      expect(db.executeQuery).not.toHaveBeenCalled();
    });

    it('should handle database error during logout gracefully', async () => {
      // Arrange
      vi.mocked(jwtUtils.verifyRefreshToken).mockReturnValue(mockRefreshPayload);

      vi.mocked(db.executeQuery).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(authService.logout(mockRefreshToken)).rejects.toThrow(AuthServiceError);

      try {
        await authService.logout(mockRefreshToken);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.INVALID_TOKEN);
      }
    });
  });

  describe('resetPassword', () => {
    const resetRequest: PasswordResetRequest = {
      email: mockEmail,
    };

    it('should generate password reset token for existing user', async () => {
      // Arrange
      vi.mocked(db.queryOne).mockResolvedValue(mockUserRecord);

      vi.mocked(jwtUtils.generatePasswordResetToken).mockReturnValue(mockResetToken);

      vi.mocked(db.executeQuery).mockResolvedValue({
        rows: [],
        rowCount: 1,
        executionTimeMs: 10,
        context: {} as any,
      });

      // Act
      const result = await authService.resetPassword(resetRequest);

      // Assert
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expiresAt');
      expect(result.token).toBe(mockResetToken);
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Verify user lookup
      expect(db.queryOne).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1',
        [mockEmail.toLowerCase()],
        expect.objectContaining({ operation: 'find_user_by_email' })
      );

      // Verify token generation
      expect(jwtUtils.generatePasswordResetToken).toHaveBeenCalled();

      // Verify token storage
      expect(db.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO password_reset_tokens'),
        expect.arrayContaining([expect.any(String), mockUserId, expect.any(Date), false]),
        expect.objectContaining({ operation: 'store_reset_token' })
      );
    });

    it('should return fake token for non-existent user (prevent enumeration)', async () => {
      // Arrange
      vi.mocked(db.queryOne).mockResolvedValue(null);

      // Act
      const result = await authService.resetPassword(resetRequest);

      // Assert
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expiresAt');
      expect(result.token).toBeTruthy();
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Verify token was not stored
      expect(db.executeQuery).not.toHaveBeenCalled();
      expect(jwtUtils.generatePasswordResetToken).not.toHaveBeenCalled();
    });
  });

  describe('validateResetToken', () => {
    const mockResetPayload = {
      userId: mockUserId,
      email: mockEmail,
      tokenId: mockTokenId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const mockTokenRecord = {
      token_id: mockTokenId,
      user_id: mockUserId,
      expires_at: new Date(Date.now() + 3600000),
      used: false,
      created_at: new Date(),
    };

    it('should successfully validate reset token', async () => {
      // Arrange
      vi.mocked(jwtUtils.verifyPasswordResetToken).mockReturnValue(mockResetPayload);

      vi.mocked(db.queryOne).mockResolvedValue(mockTokenRecord);

      // Act
      const result = await authService.validateResetToken(mockResetToken);

      // Assert
      expect(result).toEqual(mockResetPayload);

      // Verify token verification
      expect(jwtUtils.verifyPasswordResetToken).toHaveBeenCalledWith(
        mockResetToken,
        expect.any(Object)
      );

      // Verify token record lookup
      expect(db.queryOne).toHaveBeenCalledWith(
        'SELECT * FROM password_reset_tokens WHERE token_id = $1',
        [mockTokenId],
        expect.objectContaining({ operation: 'find_reset_token' })
      );
    });

    it('should reject non-existent reset token', async () => {
      // Arrange
      vi.mocked(jwtUtils.verifyPasswordResetToken).mockReturnValue(mockResetPayload);

      vi.mocked(db.queryOne).mockResolvedValue(null);

      // Act & Assert
      await expect(authService.validateResetToken(mockResetToken)).rejects.toThrow(AuthServiceError);

      try {
        await authService.validateResetToken(mockResetToken);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.PASSWORD_RESET_TOKEN_INVALID);
        expect((error as AuthServiceError).message).toBe('Invalid password reset token');
      }
    });

    it('should reject already used reset token', async () => {
      // Arrange
      const usedTokenRecord = { ...mockTokenRecord, used: true };

      vi.mocked(jwtUtils.verifyPasswordResetToken).mockReturnValue(mockResetPayload);

      vi.mocked(db.queryOne).mockResolvedValue(usedTokenRecord);

      // Act & Assert
      await expect(authService.validateResetToken(mockResetToken)).rejects.toThrow(AuthServiceError);

      try {
        await authService.validateResetToken(mockResetToken);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.PASSWORD_RESET_TOKEN_USED);
        expect((error as AuthServiceError).message).toBe('Password reset token has already been used');
      }
    });

    it('should reject invalid reset token signature', async () => {
      // Arrange
      vi.mocked(jwtUtils.verifyPasswordResetToken).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      // Act & Assert
      await expect(authService.validateResetToken('invalid-token')).rejects.toThrow(AuthServiceError);

      try {
        await authService.validateResetToken('invalid-token');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.PASSWORD_RESET_TOKEN_INVALID);
      }
    });
  });

  describe('confirmPasswordReset', () => {
    const mockResetPayload = {
      userId: mockUserId,
      email: mockEmail,
      tokenId: mockTokenId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const mockTokenRecord = {
      token_id: mockTokenId,
      user_id: mockUserId,
      expires_at: new Date(Date.now() + 3600000),
      used: false,
      created_at: new Date(),
    };

    const resetConfirmation: PasswordResetConfirmation = {
      token: mockResetToken,
      newPassword: 'NewSecurePass123!',
    };

    it('should successfully reset password', async () => {
      // Arrange
      vi.mocked(jwtUtils.verifyPasswordResetToken).mockReturnValue(mockResetPayload);

      vi.mocked(db.queryOne).mockResolvedValue(mockTokenRecord);

      vi.mocked(passwordUtils.validatePassword).mockReturnValue({
        isValid: true,
        errors: [],
        strengthScore: 4,
      });

      vi.mocked(passwordUtils.hashPassword).mockResolvedValue({
        hash: 'new-hashed-password',
        algorithm: 'bcrypt',
        saltRounds: 10,
      });

      vi.mocked(db.executeTransaction).mockResolvedValue(undefined);

      // Act
      await authService.confirmPasswordReset(resetConfirmation);

      // Assert
      // Verify password validation
      expect(passwordUtils.validatePassword).toHaveBeenCalledWith(resetConfirmation.newPassword);

      // Verify password hashing
      expect(passwordUtils.hashPassword).toHaveBeenCalledWith(resetConfirmation.newPassword);

      // Verify transaction execution
      expect(db.executeTransaction).toHaveBeenCalled();
    });

    it('should reject password reset with weak password', async () => {
      // Arrange
      vi.mocked(jwtUtils.verifyPasswordResetToken).mockReturnValue(mockResetPayload);

      vi.mocked(db.queryOne).mockResolvedValue(mockTokenRecord);

      vi.mocked(passwordUtils.validatePassword).mockReturnValue({
        isValid: false,
        errors: ['Password too weak'],
        strengthScore: 1,
      });

      // Act & Assert
      await expect(authService.confirmPasswordReset(resetConfirmation)).rejects.toThrow(AuthServiceError);

      try {
        await authService.confirmPasswordReset(resetConfirmation);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.WEAK_PASSWORD);
        expect((error as AuthServiceError).message).toBe('New password does not meet strength requirements');
      }

      // Verify password was not hashed
      expect(passwordUtils.hashPassword).not.toHaveBeenCalled();
      expect(db.executeTransaction).not.toHaveBeenCalled();
    });

    it('should reject password reset with invalid token', async () => {
      // Arrange
      vi.mocked(jwtUtils.verifyPasswordResetToken).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(authService.confirmPasswordReset(resetConfirmation)).rejects.toThrow(AuthServiceError);

      // Verify no password operations were performed
      expect(passwordUtils.validatePassword).not.toHaveBeenCalled();
      expect(passwordUtils.hashPassword).not.toHaveBeenCalled();
      expect(db.executeTransaction).not.toHaveBeenCalled();
    });

    it('should reject password reset with used token', async () => {
      // Arrange
      const usedTokenRecord = { ...mockTokenRecord, used: true };

      vi.mocked(jwtUtils.verifyPasswordResetToken).mockReturnValue(mockResetPayload);

      vi.mocked(db.queryOne).mockResolvedValue(usedTokenRecord);

      // Act & Assert
      await expect(authService.confirmPasswordReset(resetConfirmation)).rejects.toThrow(AuthServiceError);

      try {
        await authService.confirmPasswordReset(resetConfirmation);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).code).toBe(AuthErrorCode.PASSWORD_RESET_TOKEN_USED);
      }

      // Verify no password operations were performed
      expect(passwordUtils.validatePassword).not.toHaveBeenCalled();
      expect(passwordUtils.hashPassword).not.toHaveBeenCalled();
      expect(db.executeTransaction).not.toHaveBeenCalled();
    });
  });
});