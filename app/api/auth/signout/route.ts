import { clearSessionCookie, safeReturnTo } from '../../../../lib/auth';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = new URL(safeReturnTo(url.searchParams.get('returnTo'), '/'), url.origin);
  const response = new Response(null, { status: 302, headers: { Location: destination.toString() } });
  response.headers.append('Set-Cookie', clearSessionCookie());
  return response;
}
