// Guards the /bot endpoints: the bot process presents the shared secret in an
// `x-bot-secret` header. Rejects everything when no secret is configured, so
// the endpoints are closed unless the operator opted in (DISCORD_PROVIDER=bot).

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
export class BotSecretGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.env.DISCORD_BOT_API_SECRET;
    if (!secret) throw new UnauthorizedException();
    const header = context.switchToHttp().getRequest<Request>().headers['x-bot-secret'];
    const presented = Array.isArray(header) ? header[0] : header;
    if (!presented || !timingSafeEqual(presented, secret)) throw new UnauthorizedException();
    return true;
  }
}
