import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { JwtPayload, JwtUser } from './jwt.strategy';

const bearerTokenExtractor = (req: Request): string | null => {
  // Access the header in a case-insensitive way
  const header =
    (req.headers &&
      (req.headers as unknown as Record<string, string>)['authorization']) ||
    (req.headers &&
      (req.headers as unknown as Record<string, string>)['Authorization']) ||
    null;
  if (typeof header !== 'string') return null;
  const [type, token] = header.trim().split(/\s+/);
  if (type?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token;
};

/**
 * JWT Strategy for logout endpoint
 * Ignores token expiration - allows logout even with expired access token
 */
@Injectable()
export class JwtLogoutStrategy extends PassportStrategy(Strategy, 'jwt-logout') {
  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      jwtFromRequest: bearerTokenExtractor,
      ignoreExpiration: true, // Allow expired tokens for logout
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    return await Promise.resolve({
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
      fullName: payload.fullName,
    });
  }
}
