import { Download } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

type ExportExcelButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
  iconSize?: number;
};

export const ExportExcelButton = ({ label = "Excel'e Aktar", iconSize = 18, className, ...props }: ExportExcelButtonProps) => (
  <button
    type="button"
    className={`btn-primary export-excel-button${className ? ` ${className}` : ''}`}
    {...props}
  >
    <Download size={iconSize} /> <span>{label}</span>
  </button>
);
