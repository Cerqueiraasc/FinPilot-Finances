"use client";

import { useState, type ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/atoms/Button";
import { FormError } from "./FormField";
import { Modal } from "./Modal";
import { useApiSubmit } from "@/lib/api/use-api-submit";

/** Ação destrutiva sempre passa por confirmação explícita. */
export function ConfirmButton({
  label,
  title,
  description,
  confirmLabel = "Confirmar",
  url,
  method = "DELETE",
  success,
  variant = "secondary",
  ariaLabel,
  children,
  onDone,
}: {
  label?: string;
  title: string;
  description: string;
  confirmLabel?: string;
  url: string;
  method?: "DELETE" | "POST" | "PATCH";
  success?: string;
  variant?: ButtonVariant;
  ariaLabel?: string;
  children?: ReactNode;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { submit, pending, formError } = useApiSubmit();

  return (
    <>
      <Button size="sm" variant={variant} aria-label={ariaLabel} onClick={() => setOpen(true)}>
        {children ?? label}
      </Button>
      <Modal open={open} title={title} onClose={() => setOpen(false)}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">{description}</p>
          <FormError message={formError} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={async () => {
                const result = await submit(method, url, undefined, { success });
                if (result.ok) {
                  setOpen(false);
                  onDone?.();
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
