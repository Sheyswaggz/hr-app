import jwt from 'jsonwebtoken';
import { getJWTConfig } from '../config/auth.js';
import type { JWTPayload } from '../types/auth.js';

export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresIn: string): string {
  const config = getJWTConfig();
  return jwt.sign(payload, config.secret, { expiresIn });
}

export function verifyToken(token: string): JWTPayload {
  const config = getJWTConfig();
  return jwt.verify(token, config.secret) as JWTPayload;
}

export function verifyRefreshToken(token: string): JWTPayload {
  return verifyToken(token);
}