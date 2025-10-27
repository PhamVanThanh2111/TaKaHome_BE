import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';

export type JwtPayload = {
  sub: string;
  email?: string;
  roles?: string[];
  fullName?: string;
};

export type JwtUser = {
  id: string;
  email?: string;
  roles?: string[];
  fullName?: string;
};

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

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      jwtFromRequest: bearerTokenExtractor,
      ignoreExpiration: false,
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
