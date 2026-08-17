import { HTMLAttributes, ReactNode } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className = '', ...rest }: Props) {
  return (
    <div className={`bg-card rounded-lg p-5 shadow-card border border-line ${className}`} {...rest}>
      {children}
    </div>
  );
}
