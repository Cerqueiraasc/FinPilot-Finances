"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useToast } from "@/components/molecules/ToastProvider";
import type { FieldErrors } from "@/lib/errors";
import { apiRequest } from "./client";

interface SubmitOptions {
  success?: string;
  /** Recarrega os dados do servidor após o sucesso. Padrão: true. */
  refresh?: boolean;
}

/** Estado de envio dos formulários: pendente, erros por campo e erro geral. */
export function useApiSubmit() {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = useCallback(
    async <T = unknown>(
      method: "POST" | "PATCH" | "DELETE",
      url: string,
      body?: unknown,
      options: SubmitOptions = {},
    ): Promise<{ ok: true; data: T } | { ok: false }> => {
      setPending(true);
      setFieldErrors({});
      setFormError(null);
      const result = await apiRequest<T>(method, url, body);
      setPending(false);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setFormError(result.message);
        return { ok: false };
      }
      if (options.success) showToast(options.success);
      if (options.refresh !== false) router.refresh();
      return { ok: true, data: result.data };
    },
    [router, showToast],
  );

  return { submit, pending, fieldErrors, formError, setFieldErrors, setFormError };
}
