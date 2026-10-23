/** Identity proven by a verified access token. */
export interface AuthenticatedUser {
  id: string;
  email: string | null;
}
