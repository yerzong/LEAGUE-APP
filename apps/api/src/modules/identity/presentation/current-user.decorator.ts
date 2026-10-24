import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedUser } from '../domain/authenticated-user.js';
import type { AuthenticatedRequest } from './access-token.guard.js';

/** The user set by AccessTokenGuard. Only valid on guarded routes. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) throw new Error('CurrentUser used on a route without AccessTokenGuard');
    return user;
  },
);
