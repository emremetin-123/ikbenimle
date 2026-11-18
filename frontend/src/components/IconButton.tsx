import type { ButtonHTMLAttributes, ReactNode } from 'react';

type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children'
> & {
  label: string;
  children: ReactNode;
};

export function IconButton({
  label,
  title = label,
  type = 'button',
  className = 'btn-icon',
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={className}
      aria-label={label}
      title={title}
    >
      {children}
    </button>
  );
}
