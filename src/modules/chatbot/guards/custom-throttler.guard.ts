import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(CustomThrottlerGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    try {
      const canActivate = await super.canActivate(context);
      return canActivate;
    } catch (error) {
      // Log spam attempts
      const route = request.url || 'unknown';
      this.logger.warn(`🚨 Rate limit exceeded for ${request.ip} on ${route}`);

      // Re-throw the original error
      throw error;
    }
  }
}
