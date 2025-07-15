/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // Không yêu cầu role, ai cũng được truy cập
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !user.roles) return false;

    // roles: ['ADMIN', 'TENANT', 'LANDLORD']
    const hasRole = user.roles.some((role: string) =>
      requiredRoles.includes(role),
    );
    if (!hasRole) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập chức năng này!',
      );
    }
    return true;
  }
}
