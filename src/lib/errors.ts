export type FieldErrors = Record<string, string[]>;

/** Erro esperado de negócio. A mensagem é segura para exibir ao usuário. */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
    public readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthorized = () => new AppError("UNAUTHORIZED", "Faça login para continuar.", 401);

/** Recursos de outro usuário respondem igual a inexistentes, para não revelar sua existência. */
export const notFound = (what = "Registro") =>
  new AppError("NOT_FOUND", `${what} não encontrado.`, 404);

export const validationError = (field: string, message: string) =>
  new AppError("VALIDATION_ERROR", message, 400, { [field]: [message] });
