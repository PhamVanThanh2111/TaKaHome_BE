import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtUser } from 'src/modules/core/auth/strategies/jwt.strategy';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser | undefined => {
    const req = ctx.switchToHttp().getRequest<{ user?: JwtUser | undefined }>();
    return req.user; // được gắn bởi JwtStrategy.validate()
  },
);
