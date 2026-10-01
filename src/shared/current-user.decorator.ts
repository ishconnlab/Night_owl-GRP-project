import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Identity attached by JwtAuthGuard, and injected by @CurrentUser(). */
export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    return request.user ?? { id: '' };
  },
);