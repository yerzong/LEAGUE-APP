import { z } from 'zod';

// Normalize first: the email format check must see the trimmed value.
export const EmailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

// bcrypt (Supabase Auth) ignores bytes beyond 72.
export const PasswordSchema = z.string().min(8).max(72);

export const SignInWithPasswordSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(72),
});

export const SignUpSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

export const MagicLinkSchema = z.object({
  email: EmailSchema,
});

export const OAuthProviderSchema = z.enum(['discord', 'google']);

export type SignInWithPassword = z.infer<typeof SignInWithPasswordSchema>;
export type SignUp = z.infer<typeof SignUpSchema>;
export type MagicLink = z.infer<typeof MagicLinkSchema>;
export type OAuthProvider = z.infer<typeof OAuthProviderSchema>;
