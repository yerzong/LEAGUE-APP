import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '../../lib/cn.js';

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-sm font-display font-bold whitespace-nowrap caps transition-colors duration-(--duration-fast) ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-brand-bright',
        secondary: 'border border-border bg-surface text-text hover:bg-surface-2',
        outline:
          'border border-brand-dim bg-transparent text-brand hover:border-brand hover:bg-surface-2',
        ghost: 'text-brand hover:bg-surface-2',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'h-auto px-0 text-brand normal-case tracking-normal underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-7 gap-1 px-2 text-xs',
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg',
        icon: 'size-10',
        'icon-sm': 'size-8',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  /** Renders the child element (e.g. a link) with button styles. */
  asChild?: boolean | undefined;
}

export function Button({
  variant = 'primary',
  size = 'md',
  asChild = false,
  type,
  className,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if (asChild) return <Slot.Root data-slot="button" className={classes} {...props} />;
  return <button data-slot="button" type={type ?? 'button'} className={classes} {...props} />;
}
