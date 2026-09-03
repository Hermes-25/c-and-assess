import { clearTemporaryCookie, createSessionToken, googleConfig, safeReturnTo, saveGoogleUser, sessionCookie, verifyGoogleIdToken } from '../../../../../lib/auth';

function readCookie(request: Request, name: string) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

function finishRedirect(url: URL, session?: string) {
  const response = new Response(null, { status: 302, headers: { Location: url.toString() } });
  if (session) response.headers.append('Set-Cookie', sessionCookie(session));
  for (const name of ['cna_oauth_state', 'cna_oauth_nonce', 'cna_oauth_return']) response.headers.append('Set-Cookie', clearTemporaryCookie(name));
  return response;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const errorUrl = new URL('/signin?error=google', requestUrl.origin);
  try {
    const code = requestUrl.searchParams.get('code');
    const state = requestUrl.searchParams.get('state');
    const expectedState = readCookie(request, 'cna_oauth_state');
    const nonce = readCookie(request, 'cna_oauth_nonce');
    if (!code || !state || !expectedState || state !== expectedState || !nonce) return finishRedirect(errorUrl);
    const { clientId, clientSecret } = googleConfig();
    const redirectUri = `${requestUrl.origin}/api/auth/callback/google`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    if (!tokenResponse.ok) return finishRedirect(errorUrl);
    const tokenData = await tokenResponse.json() as { id_token?: string };
    if (!tokenData.id_token) return finishRedirect(errorUrl);
    const claims = await verifyGoogleIdToken(tokenData.id_token, nonce);
    const user = await saveGoogleUser(claims);
    const now = Math.floor(Date.now() / 1000);
    const session = await createSessionToken({ sub: user.id, email: user.email, name: user.name, picture: user.picture, role: user.role, iat: now, exp: now + 60 * 60 * 24 * 7 });
    const requestedDestination = safeReturnTo(readCookie(request, 'cna_oauth_return'));
    const destination = user.role === 'organizer' && requestedDestination === '/assessments' ? '/organizer' : requestedDestination;
    return finishRedirect(new URL(destination, requestUrl.origin), session);
  } catch {
    return finishRedirect(errorUrl);
  }
}
