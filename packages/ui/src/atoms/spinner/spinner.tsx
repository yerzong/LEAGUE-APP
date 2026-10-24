import { cn } from '../../lib/cn.js';
import { Loader2Icon } from 'lucide-react';

import type { ComponentProps } from 'react';

function Spinner({ className, label, ...props }: ComponentProps<'svg'> & { label: string }) {
  return (
    <Loader2Icon
      role="status"
      aria-label={label}
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  );
}

export { Spinner };
