import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-12 w-full rounded-control border border-field bg-paper px-3.5 text-base text-ink transition-[border-color,box-shadow] file:border-0 file:bg-transparent file:text-sm file:font-bold file:text-pine placeholder:text-sage focus-visible:border-shutter focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-mint-wash/40 aria-[invalid=true]:border-terracotta disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
