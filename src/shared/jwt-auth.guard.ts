import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthUser } from './current-user.decorator';

/**
 * Requires a valid staff access token on everything it guards.
 *
 * The token is issued by POST /auth/login and verified with the secret
 * registered in AuthModule, so the signing key lives in one place.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & { user?: AuthUser }
    >();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ')
      ? header.slice(7)
      : undefined;

    if (!token) {
      throw new UnauthorizedException('Authentication is required.');
    }

    try {
      request.user = await this.jwtService.verifyAsync<AuthUser>(token);
    } catch {
      throw new UnauthorizedException('Your session is invalid or expired.');
    }

    return true;
  }
}
