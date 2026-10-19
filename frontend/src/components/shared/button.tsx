type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'amber';

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
    outline:
      'border border-outline bg-transparent text-pine hover:border-shutter hover:bg-mint-mist',
    amber: 'bg-sun text-ink hover:bg-sun-hover',
  };

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold transition-all duration-200 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
