import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { ACCESS_TOKEN_VERIFIER, type AccessTokenVerifier } from '../application/ports.js';
import type { AuthenticatedUser } from '../domain/authenticated-user.js';

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/** Requires `Authorization: Bearer <Supabase access token>`; exposes the user on the request. */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(@Inject(ACCESS_TOKEN_VERIFIER) private readonly verifier: AccessTokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme?.toLowerCase() !== 'bearer' || !token) throw new UnauthorizedException();

    const user = await this.verifier.verify(token);
    if (!user) throw new UnauthorizedException();

    request.user = user;
    return true;
  }
}
