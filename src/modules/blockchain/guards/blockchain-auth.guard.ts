import { Injectable, CanActivate, ExecutionContext, BadRequestException, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { BlockchainConfigService } from '../blockchain-config.service';

/**
 * Blockchain Auth Guard
 * Validates required headers for blockchain operations:
 * - orgName: Organization name (OrgProp, OrgTenant, OrgLandlord)
 * - userId: User identity (optional, will use default if not provided)
 */
@Injectable()
export class BlockchainAuthGuard implements CanActivate {
  constructor(private blockchainConfig: BlockchainConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // Extract headers
    const orgName = request.headers['orgname'] || request.headers['x-org-name'];
    const userId = request.headers['userid'] || request.headers['x-user-id'];

    // Validate organization name
    if (!orgName) {
      throw new BadRequestException('Missing required header: orgName or x-org-name');
    }

    if (!this.blockchainConfig.isValidOrganization(orgName)) {
      throw new UnauthorizedException(`Invalid organization: ${orgName}. Supported organizations: ${this.blockchainConfig.getOrganizations()}`);
    }

    // If userId not provided, use default for organization
    let finalUserId = userId;
    if (!finalUserId) {
      finalUserId = this.blockchainConfig.getDefaultUserForOrg(orgName);
      if (!finalUserId) {
        throw new UnauthorizedException(`No default user configured for organization: ${orgName}`);
      }
    }

    // Attach blockchain user info to request
    request.blockchainUser = {
      userId: finalUserId,
      orgName: orgName,
      mspId: this.blockchainConfig.getOrganization(orgName)?.mspId
    };

    return true;
  }
}

/**
 * Decorator to extract blockchain user from request
 */
export const BlockchainUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.blockchainUser;
  },
);
