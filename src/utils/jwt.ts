*/
export function verifyRefreshToken(
  token: string,
  options?: {
    readonly correlationId?: string;
  }
): RefreshTokenPayload {
  const correlationId = options?.correlationId ?? generateCorrelationId();
  const startTime = Date.now();

  try {
    // Validate input
    if (!token || token.trim().length === 0) {
      throw new TokenVerificationError(
        'Refresh token is required for verification',
        'MISSING_TOKEN',
        { correlationId }
      );
    }

    console.log('[JWT] Verifying refresh token:', {
      correlationId,
      timestamp: new Date().toISOString(),
    });

    const config = getJWTConfig();

    // Verify token with refresh secret
    const verifyOptions: VerifyOptions = {
      algorithms: [config.algorithm],
      issuer: config.issuer,
      audience: config.audience,
    };

    const decoded = jwt.verify(token, config.refreshSecret, verifyOptions) as JwtPayload;

    // Validate payload structure
    if (!decoded.userId || typeof decoded.userId !== 'string') {
      throw new TokenVerificationError(
        'Invalid refresh token payload: missing or invalid userId',
        'INVALID_PAYLOAD',
        { correlationId }
      );
    }

    if (!decoded.email || typeof decoded.email !== 'string') {
      throw new TokenVerificationError(
        'Invalid refresh token payload: missing or invalid email',
        'INVALID_PAYLOAD',
        { correlationId }
      );
    }

    if (!decoded.tokenId || typeof decoded.tokenId !== 'string') {
      throw new TokenVerificationError(
        'Invalid refresh token payload: missing or invalid tokenId',
        'INVALID_PAYLOAD',
        { correlationId }
      );
    }

    if (decoded.tokenType !== 'refresh') {
      throw new TokenVerificationError(
        'Invalid token type: expected refresh token',
        'INVALID_TOKEN_TYPE',
        { tokenType: decoded.tokenType, correlationId }
      );
    }

    const payload: RefreshTokenPayload = {
      userId: decoded.userId,
      email: decoded.email,
      tokenId: decoded.tokenId,
      iat: decoded.iat ?? 0,
      exp: decoded.exp ?? 0,
      tokenType: 'refresh',
    };

    const executionTimeMs = Date.now() - startTime;

    console.log('[JWT] Refresh token verified successfully:', {
      userId: payload.userId,
      email: payload.email,
      tokenId: payload.tokenId,
      executionTimeMs,
      correlationId,
      timestamp: new Date().toISOString(),
    });

    return payload;
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;

    if (error instanceof TokenVerificationError) {
      console.error('[JWT] Refresh token verification failed:', {
        error: error.message,
        code: error.code,
        details: error.details,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }

    // Handle JWT library errors
    if (error instanceof jwt.JsonWebTokenError) {
      console.error('[JWT] Invalid refresh token:', {
        error: error.message,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new TokenVerificationError(
        `Invalid refresh token: ${error.message}`,
        'INVALID_TOKEN',
        { correlationId }
      );
    }

    if (error instanceof jwt.TokenExpiredError) {
      console.error('[JWT] Refresh token expired:', {
        expiredAt: error.expiredAt.toISOString(),
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new TokenVerificationError(
        'Refresh token has expired',
        'TOKEN_EXPIRED',
        { expiredAt: error.expiredAt, correlationId }
      );
    }

    if (error instanceof jwt.NotBeforeError) {
      console.error('[JWT] Refresh token not yet valid:', {
        date: error.date.toISOString(),
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new TokenVerificationError(
        'Refresh token is not yet valid',
        'TOKEN_NOT_ACTIVE',
        { date: error.date, correlationId }
      );
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[JWT] Unexpected error during refresh token verification:', {
      error: errorMessage,
      executionTimeMs,
      correlationId,
      timestamp: new Date().toISOString(),
    });

    throw new TokenVerificationError(
      `Refresh token verification failed: ${errorMessage}`,
      'VERIFICATION_FAILED',
      { correlationId }
    );
  }
}

/**
 * Decode JWT token without verification
 * 
 * Decodes a JWT token without verifying its signature or expiration. Useful
 * for inspecting token contents or extracting information before verification.
 * 
 * WARNING: This function does not validate the token. Always verify tokens
 * before trusting their contents in security-sensitive operations.
 * 
 * @param token - JWT token to decode
 * @param options - Optional decoding options
 * @returns Decoded token payload or null if decoding fails
 * 
 * @example
 *