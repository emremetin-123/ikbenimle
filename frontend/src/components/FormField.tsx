import type { ReactNode } from 'react';

type FormFieldProps = {
  controlId: string;
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
};

export function FormField({
  controlId,
  label,
  children,
  hint,
  error,
  className = '',
}: FormFieldProps) {
  return (
    <div className={`input-group ui-form-field ${className}`.trim()}>
      <label className="input-label" htmlFor={controlId}>{label}</label>
      {children}
      {hint && <small id={`${controlId}-hint`} className="ui-form-field-hint">{hint}</small>}
      {error && <small id={`${controlId}-error`} className="ui-form-field-error" role="alert">{error}</small>}
    </div>
  );
}
