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
      // Log chatbot spam attempts với thông tin chi tiết
      const route = request.url || 'unknown';
      const ip = request.ip || 'unknown';
      const userAgent = request.headers['user-agent'] || 'unknown';

      this.logger.warn(
        `🤖 Chatbot rate limit exceeded - IP: ${ip}, Route: ${route}, UserAgent: ${userAgent.substring(0, 50)}...`,
      );

      // Re-throw the original error
      throw error;
    }
  }
}
