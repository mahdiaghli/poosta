import { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-sageDeep text-white shadow-[0_12px_24px_-10px_rgba(60,84,67,0.55)]',
  secondary: 'bg-card text-sageDeep border-[1.5px] border-sageSoft',
  ghost: 'bg-transparent text-stone font-semibold',
  danger: 'bg-[#FBEEE9] text-coral',
};

export function Button({ variant = 'primary', className = '', children, ...rest }: Props) {
  return (
    <button
      className={`w-full rounded-full py-4 px-5 font-bold text-[15px] flex items-center justify-center gap-2 transition-transform active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
