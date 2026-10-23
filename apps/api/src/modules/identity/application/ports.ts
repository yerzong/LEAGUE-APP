import type { AuthenticatedUser } from '../domain/authenticated-user.js';

export interface AccessTokenVerifier {
  /** Returns the user for a valid, unexpired token; null otherwise. Never throws for bad tokens. */
  verify(accessToken: string): Promise<AuthenticatedUser | null>;
}

export const ACCESS_TOKEN_VERIFIER = Symbol('AccessTokenVerifier');
