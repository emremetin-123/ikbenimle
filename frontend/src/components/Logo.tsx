import React from 'react';

interface LogoProps {
  size?: number | string;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 180, className = '' }) => {
  const logoSize = typeof size === 'number' ? `${size}px` : size;

  return (
    <div
      className={`logo-container ${className}`}
      style={{ '--logo-size': logoSize } as React.CSSProperties}
    >
      <img
        src="/logo.png"
        alt="IKBenimle"
      />
    </div>
  );
};
