/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, CanActivate, ExecutionContext, BadRequestException, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { BlockchainConfigService } from '../blockchain-config.service';
import { BLOCKCHAIN_ERRORS } from 'src/common/constants/error-messages.constant';

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
    let userId = request.headers['userid'] || request.headers['x-user-id'];

    // Validate organization name
    if (!orgName) {
      throw new BadRequestException(BLOCKCHAIN_ERRORS.MISSING_ORG_HEADER);
    }

    if (!this.blockchainConfig.isValidOrganization(orgName)) {
      throw new UnauthorizedException(BLOCKCHAIN_ERRORS.INVALID_ORGANIZATION);
    }

    // Priority for userId:
    // 1. Explicit userId from header
    // 2. User ID from JWT token (if authenticated)
    // 3. Default admin user for organization
    
    if (!userId && request.user?.id) {
      // Use JWT user ID as blockchain identity if available
      userId = request.user.id;
    }
    
    if (!userId) {
      // Fallback to default admin user
      userId = this.blockchainConfig.getDefaultUserForOrg(orgName);
      if (!userId) {
        throw new UnauthorizedException(BLOCKCHAIN_ERRORS.NO_DEFAULT_USER);
      }
    }

    // Attach blockchain user info to request
    request.blockchainUser = {
      userId: userId,
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
