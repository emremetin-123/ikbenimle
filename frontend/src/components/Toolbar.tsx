import type { HTMLAttributes, ReactNode } from 'react';

type ToolbarProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Toolbar({ children, className = '', ...props }: ToolbarProps) {
  return (
    <div className={`ui-toolbar ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
