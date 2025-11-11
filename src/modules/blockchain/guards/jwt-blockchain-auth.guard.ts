import { Injectable, CanActivate, ExecutionContext, BadRequestException, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { BlockchainConfigService } from '../blockchain-config.service';
import { IS_PUBLIC_KEY } from 'src/common/decorators/public.decorator';
import { BLOCKCHAIN_ERRORS } from 'src/common/constants/error-messages.constant';

/**
 * JWT + Blockchain Combined Auth Guard
 * First validates JWT token, then validates blockchain-specific headers
 */
@Injectable()
export class JwtBlockchainAuthGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(
    private blockchainConfig: BlockchainConfigService,
    private reflector: Reflector,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) {
      return true;
    }

    // First validate JWT token using Passport's AuthGuard
    const jwtValid = await super.canActivate(context);
    if (!jwtValid) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    
    // Extract blockchain-specific headers
    const orgName = request.headers['orgname'] || request.headers['x-org-name'];
    const userId = request.headers['userid'] || request.headers['x-user-id'];

    // Validate organization name
    if (!orgName) {
      throw new BadRequestException(BLOCKCHAIN_ERRORS.MISSING_ORG_HEADER);
    }

    if (!this.blockchainConfig.isValidOrganization(orgName)) {
      throw new UnauthorizedException(BLOCKCHAIN_ERRORS.INVALID_ORGANIZATION);
    }

    // Verify user has permission for this organization
    const user = request.user; // From JWT auth
    if (!this.canUserAccessOrganization(user, orgName)) {
      throw new UnauthorizedException(BLOCKCHAIN_ERRORS.INVALID_ORGANIZATION);
    }

    // If userId not provided, use default for organization or user ID from JWT
    const finalUserId = userId || user.id || this.blockchainConfig.getDefaultUserForOrg(orgName);
    
    if (!finalUserId) {
      throw new UnauthorizedException(BLOCKCHAIN_ERRORS.NO_USER_IDENTITY);
    }

    // Attach blockchain user info to request
    request.blockchainUser = {
      userId: finalUserId,
      orgName: orgName,
      mspId: this.blockchainConfig.getOrganization(orgName)?.mspId,
      jwtUser: user // Keep reference to JWT user
    };

    return true;
  }

  /**
   * Check if user has permission to access specific organization
   * You can implement your business logic here
   */
  private canUserAccessOrganization(user: any, orgName: string): boolean {
    // Get user roles (handle both single role and roles array)
    const userRoles = this.getUserRoles(user);
    
    // Admin can access all organizations
    if (userRoles.includes('ADMIN')) {
      return true;
    }

    switch (orgName) {
      case 'OrgProp':
        return userRoles.includes('LANDLORD') || userRoles.includes('PROPERTY_OWNER');
      case 'OrgTenant':
        return userRoles.includes('TENANT');
      case 'OrgLandlord':
        return userRoles.includes('LANDLORD') || userRoles.includes('ADMIN');
      default:
        return false;
    }
  }

  /**
   * Extract user roles from JWT user object (handle different formats)
   */
  private getUserRoles(user: any): string[] {
    if (!user) return [];
    
    // Handle roles array (new format)
    if (user.roles && Array.isArray(user.roles)) {
      return user.roles.map(role => role.toString().toUpperCase());
    }
    
    // Handle single role field (legacy format)
    if (user.role) {
      return [user.role.toString().toUpperCase()];
    }
    
    return [];
  }
}

/**
 * Parameter decorator to extract blockchain user info from request
 */
export const BlockchainUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.blockchainUser;
  },
);
