import { googleConfig, randomToken, safeReturnTo, temporaryCookie } from '../../../../lib/auth';

export async function GET(request: Request) {
  try {
    const { clientId } = googleConfig();
    const requestUrl = new URL(request.url);
    const state = randomToken();
    const nonce = randomToken();
    const returnTo = safeReturnTo(requestUrl.searchParams.get('returnTo'));
    const redirectUri = `${requestUrl.origin}/api/auth/callback/google`;
    const authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorization.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile', state, nonce, prompt: 'select_account' }).toString();
    const response = new Response(null, { status: 302, headers: { Location: authorization.toString() } });
    response.headers.append('Set-Cookie', temporaryCookie('cna_oauth_state', state));
    response.headers.append('Set-Cookie', temporaryCookie('cna_oauth_nonce', nonce));
    response.headers.append('Set-Cookie', temporaryCookie('cna_oauth_return', returnTo));
    return response;
  } catch (error) {
    console.error('Google OAuth initialization failed', error instanceof Error ? error.message : error);
    return Response.json({ error: 'Google sign-in is not configured yet.' }, { status: 503 });
  }
}
