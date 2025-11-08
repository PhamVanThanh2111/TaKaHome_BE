import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard for logout endpoint
 * Uses jwt-logout strategy which ignores token expiration
 */
@Injectable()
export class JwtLogoutGuard extends AuthGuard('jwt-logout') {}
