type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'amber';

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const styles: Record<ButtonVariant, string> = {
    primary: 'bg-[#0F6E56] text-[#E1F5EE] hover:bg-[#085041]',
    secondary: 'bg-[#E1F5EE] text-[#085041] hover:bg-[#9FE1CB]',
    ghost: 'text-[#2C2C2A] hover:bg-[#E1F5EE]',
    outline:
      'border border-[#b7d7ca] bg-transparent text-[#085041] hover:border-[#0F6E56] hover:bg-[#E1F5EE]',
    amber: 'bg-[#EF9F27] text-[#2C2C2A] hover:bg-[#e6a53d]',
  };

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold transition-all duration-200 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    />
  );
}
