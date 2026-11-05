type Level = "info" | "warn" | "error";

const SENSITIVE_KEY = /password|token|secret|authorization|cookie|email|description|notes|csv/i;

function sanitize(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[redacted]" : value,
    ]),
  );
}

/** Log estruturado em JSON. Campos sensíveis são removidos pelo nome da chave. */
export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({
    level,
    event,
    at: new Date().toISOString(),
    ...sanitize(fields),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function errorFields(error: unknown): Record<string, unknown> {
  // Mensagens de erro podem conter dados de consulta; registra apenas o tipo e o código.
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return { errorName: error.name, errorCode: typeof code === "string" ? code : undefined };
  }
  return { errorName: "UnknownError" };
}
