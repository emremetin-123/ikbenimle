import type { CSSProperties } from 'react';

const DEFAULT_SERVICE_COLOR = '#2563eb';
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

type ServiceRouteStyleOptions = {
  ring?: boolean;
  soft?: boolean;
};

export const normalizeServiceColor = (color?: string | null) => (
  color && HEX_COLOR_PATTERN.test(color) ? color.toLowerCase() : DEFAULT_SERVICE_COLOR
);

export const serviceRouteStyle = (
  color?: string | null,
  options: ServiceRouteStyleOptions = {},
): CSSProperties => {
  const normalized = normalizeServiceColor(color);
  return {
    '--service-color': normalized,
    ...(options.ring ? { '--service-color-ring': `${normalized}22` } : {}),
    ...(options.soft ? { '--service-color-soft': `${normalized}18` } : {}),
  } as CSSProperties;
};

export const serviceMapHeightStyle = (height: number): CSSProperties => {
  const normalized = Number.isFinite(height)
    ? Math.max(240, Math.min(720, Math.round(height)))
    : 460;
  return { '--service-map-height': `${normalized}px` } as CSSProperties;
};
