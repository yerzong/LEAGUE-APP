// Guards the Riot result callback. Riot presents the shared secret in an
// `x-riot-secret` header; without a configured secret the endpoint is closed.
// (Riot does not sign callbacks, so a shared secret in the callback URL path or
// header is the documented way to verify authenticity — docs/06 §6.)

import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { ENV, type Env } from '../../../config/env.js';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

@Injectable()
export class RiotCallbackGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.env.RIOT_CALLBACK_SECRET;
    if (!secret) throw new UnauthorizedException();
    const header = context.switchToHttp().getRequest<Request>().headers['x-riot-secret'];
    const presented = Array.isArray(header) ? header[0] : header;
    if (!presented || !timingSafeEqual(presented, secret)) throw new UnauthorizedException();
    return true;
  }
}
