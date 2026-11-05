import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { requireApiSession, type CurrentSession } from "@/lib/auth/session";
import { AppError, type FieldErrors } from "@/lib/errors";
import { errorFields, log } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const DEFAULT_BODY_LIMIT = 64 * 1024;

export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors?: FieldErrors;
}

interface RouteContext<P> {
  params: Promise<P>;
}

function errorResponse(body: ApiErrorBody, status: number) {
  return NextResponse.json(body, { status });
}

function zodFieldErrors(error: ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

function toResponse(error: unknown) {
  if (error instanceof AppError) {
    return errorResponse(
      { code: error.code, message: error.message, fieldErrors: error.fieldErrors },
      error.status,
    );
  }
  if (error instanceof ZodError) {
    return errorResponse(
      {
        code: "VALIDATION_ERROR",
        message: "Revise os campos informados.",
        fieldErrors: zodFieldErrors(error),
      },
      400,
    );
  }
  log("error", "api.unhandled_error", errorFields(error));
  return errorResponse(
    { code: "INTERNAL_ERROR", message: "Não foi possível concluir a operação. Tente novamente." },
    500,
  );
}

/**
 * SameSite=Lax já barra a maioria dos envios entre sites; a checagem de Origin
 * cobre o restante em mutações autenticadas por cookie.
 */
async function assertSameOrigin(request: Request): Promise<void> {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host || new URL(origin).host !== host) {
    throw new AppError("FORBIDDEN_ORIGIN", "Origem da requisição não permitida.", 403);
  }
}

async function readJson(request: Request, limit: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > limit) {
    throw new AppError("PAYLOAD_TOO_LARGE", "Os dados enviados excedem o tamanho permitido.", 413);
  }
  const text = await request.text();
  if (text.length > limit) {
    throw new AppError("PAYLOAD_TOO_LARGE", "Os dados enviados excedem o tamanho permitido.", 413);
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("INVALID_JSON", "Corpo da requisição inválido.", 400);
  }
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local"
  );
}

interface RateLimitOption {
  scope: string;
  limit: number;
  windowMs: number;
}

interface HandlerArgs<P, B> {
  request: Request;
  params: P;
  body: B;
}

/** Rota pública: valida origem, tamanho e corpo; nunca expõe detalhes internos. */
export function publicRoute<B = undefined, P = object>(
  options: { schema?: ZodType<B>; bodyLimit?: number; rateLimit?: RateLimitOption },
  handler: (args: HandlerArgs<P, B>) => Promise<Response | object | void>,
) {
  return async (request: Request, context: RouteContext<P>): Promise<Response> => {
    try {
      await assertSameOrigin(request);
      if (options.rateLimit) {
        const { scope, limit, windowMs } = options.rateLimit;
        await enforceRateLimit(scope, clientIp(request), limit, windowMs);
      }
      const body = options.schema
        ? options.schema.parse(await readJson(request, options.bodyLimit ?? DEFAULT_BODY_LIMIT))
        : (undefined as B);
      const result = await handler({ request, params: await context.params, body });
      if (result instanceof Response) return result;
      return result ? NextResponse.json(result) : new NextResponse(null, { status: 204 });
    } catch (error) {
      return toResponse(error);
    }
  };
}

/** Rota autenticada: a sessão vem do servidor; o userId nunca é aceito do cliente. */
export function authedRoute<B = undefined, P = object>(
  options: { schema?: ZodType<B>; bodyLimit?: number; rateLimit?: RateLimitOption },
  handler: (args: HandlerArgs<P, B> & { session: CurrentSession; userId: string }) => Promise<
    Response | object | void
  >,
) {
  return async (request: Request, context: RouteContext<P>): Promise<Response> => {
    try {
      await assertSameOrigin(request);
      const session = await requireApiSession();
      if (options.rateLimit) {
        const { scope, limit, windowMs } = options.rateLimit;
        await enforceRateLimit(scope, session.user.id, limit, windowMs);
      }
      const body = options.schema
        ? options.schema.parse(await readJson(request, options.bodyLimit ?? DEFAULT_BODY_LIMIT))
        : (undefined as B);
      const result = await handler({
        request,
        params: await context.params,
        body,
        session,
        userId: session.user.id,
      });
      if (result instanceof Response) return result;
      return result ? NextResponse.json(result) : new NextResponse(null, { status: 204 });
    } catch (error) {
      return toResponse(error);
    }
  };
}

export function searchParamsOf(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}
