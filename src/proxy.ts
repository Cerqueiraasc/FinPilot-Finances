import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "finpilot_session";

/**
 * Filtro rápido de navegação: só verifica a presença do cookie. A validação real da
 * sessão e do dono dos dados acontece no servidor, em cada página e rota de API.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
