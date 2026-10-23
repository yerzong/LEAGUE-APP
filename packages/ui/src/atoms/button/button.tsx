import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-display font-bold uppercase tracking-wide transition-colors duration-(--duration-base) ease-out disabled:pointer-events-none disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-bg hover:bg-brand-bright',
  secondary: 'border border-border bg-surface text-text hover:bg-surface-2',
  ghost: 'text-brand hover:bg-surface-2',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-base',
  lg: 'h-12 px-6 text-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  const classes = [base, variants[variant], sizes[size], className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...props} />;
}
