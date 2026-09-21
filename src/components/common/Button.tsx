import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent-500 text-ink-950 hover:bg-accent-400 disabled:bg-ink-700 disabled:text-ink-400 font-semibold',
  secondary:
    'bg-ink-700 text-ink-100 hover:bg-ink-600 disabled:bg-ink-800 disabled:text-ink-500 border border-ink-600',
  ghost: 'bg-transparent text-ink-200 hover:bg-ink-800 disabled:text-ink-500',
  danger: 'bg-transparent text-danger-400 hover:bg-ink-800 border border-ink-700',
};

const SIZES: Record<Size, string> = {
  sm: 'text-xs px-2.5 py-1.5 gap-1.5',
  md: 'text-sm px-3.5 py-2 gap-2',
  lg: 'text-base px-5 py-2.5 gap-2',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className = '',
  ...rest
}: Props) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
