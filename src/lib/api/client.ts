import type { FieldErrors } from "@/lib/errors";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; message: string; fieldErrors: FieldErrors };

/** Chamada à API a partir do navegador, com o formato de erro padronizado. */
export async function apiRequest<T = unknown>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = undefined;
      }
    }
    if (response.ok) return { ok: true, data: parsed as T };
    const error = (parsed ?? {}) as { code?: string; message?: string; fieldErrors?: FieldErrors };
    return {
      ok: false,
      status: response.status,
      code: error.code ?? "UNKNOWN",
      message: error.message ?? "Não foi possível concluir a operação.",
      fieldErrors: error.fieldErrors ?? {},
    };
  } catch {
    return {
      ok: false,
      status: 0,
      code: "NETWORK_ERROR",
      message: "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
      fieldErrors: {},
    };
  }
}
