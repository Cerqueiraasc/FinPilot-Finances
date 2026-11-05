import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { Input, Select } from "@/components/atoms/Input";
import { Textarea } from "@/components/atoms/Input";
import type { TextareaHTMLAttributes } from "react";

interface FieldBaseProps {
  label: string;
  hint?: string;
  errors?: string[];
}

function FieldShell({
  id,
  label,
  hint,
  errors,
  children,
}: FieldBaseProps & { id: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {errors?.map((error) => (
        <p key={error} id={`${id}-error`} className="text-xs font-medium text-negative">
          {error}
        </p>
      ))}
    </div>
  );
}

function describedBy(id: string, hint?: string, errors?: string[]) {
  const parts = [hint ? `${id}-hint` : null, errors?.length ? `${id}-error` : null].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}

export function TextField({
  label,
  hint,
  errors,
  ...props
}: FieldBaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} errors={errors}>
      <Input
        id={id}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(id, hint, errors)}
        {...props}
      />
    </FieldShell>
  );
}

/** Campo monetário como texto: a conversão para centavos não passa por float. */
export function MoneyField({
  label,
  hint,
  errors,
  ...props
}: FieldBaseProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <TextField
      label={label}
      hint={hint}
      errors={errors}
      inputMode="decimal"
      placeholder="0,00"
      autoComplete="off"
      {...props}
    />
  );
}

export function SelectField({
  label,
  hint,
  errors,
  children,
  ...props
}: FieldBaseProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} errors={errors}>
      <Select
        id={id}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(id, hint, errors)}
        {...props}
      >
        {children}
      </Select>
    </FieldShell>
  );
}

export function TextareaField({
  label,
  hint,
  errors,
  ...props
}: FieldBaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} errors={errors}>
      <Textarea
        id={id}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(id, hint, errors)}
        {...props}
      />
    </FieldShell>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-negative-soft px-3 py-2 text-sm font-medium text-negative">
      {message}
    </p>
  );
}
