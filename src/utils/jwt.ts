import jwt from 'jsonwebtoken';
import type { JWTPayload } from '../types/auth.js';
import { getJWTConfig } from '../config/auth.js';

export function generateToken(payload: JWTPayload, expiresIn: string): string {
  const config = getJWTConfig();
  return jwt.sign(
    payload,
    config.secret,
    { expiresIn }
  );
}

export function verifyToken(token: string): JWTPayload {
  const config = getJWTConfig();
  return jwt.verify(token, config.secret) as JWTPayload;
}

export function verifyRefreshToken(token: string): JWTPayload {
  const config = getJWTConfig();
  return jwt.verify(token, config.secret) as JWTPayload;
}