import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';

export type JwtPayload = {
  sub: string;
  email?: string;
  roles?: string[];
};

export type JwtUser = {
  id: string;
  email?: string;
  roles?: string[];
};

const bearerTokenExtractor = (req: Request): string | null => {
  const header = req.headers?.authorization ?? req.headers?.Authorization;
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
    // passport-jwt không cung cấp đủ kiểu, cần disable lint tại đây
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
    });
  }
}
