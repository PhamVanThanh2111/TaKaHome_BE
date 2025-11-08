import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'src/common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // Check if error is due to token expiration
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (info?.name === 'TokenExpiredError') {
      throw new UnauthorizedException('Token expired');
    }

    // Check if error is due to invalid token
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (info?.name === 'JsonWebTokenError') {
      throw new UnauthorizedException('Invalid token');
    }

    // If there's an error or no user, throw unauthorized
    if (err || !user) {
      throw err || new UnauthorizedException('Unauthorized');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return user;
  }
}
