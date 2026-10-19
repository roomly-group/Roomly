type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'amber' | 'destructive';

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const styles: Record<ButtonVariant, string> = {
    primary: 'bg-shutter text-mint-mist hover:bg-pine',
    secondary: 'bg-mint-mist text-pine hover:bg-mint-wash',
    ghost: 'text-ink hover:bg-mint-mist',
    outline: 'border border-outline bg-transparent text-pine hover:border-shutter hover:bg-mint-mist',
    amber: 'bg-sun text-ink hover:bg-sun-hover',
    destructive: 'bg-terracotta text-paper hover:bg-terracotta/90',
  };

  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-extrabold transition-[background-color,border-color,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
