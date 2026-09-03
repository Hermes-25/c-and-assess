import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { env as processEnv } from 'node:process';

export type AuthSession = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  role: 'candidate' | 'organizer';
  iat: number;
  exp: number;
};

type GoogleClaims = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  nonce?: string;
  iss: string;
  aud: string;
  exp: number;
};

const SESSION_COOKIE = 'cna_session';
const ORGANIZER_EMAILS = new Set(['caciitg@gmail.com', 'cac@iitg.ac.in']);
const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJson<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as T;
}

function getSecret() {
  const secret = env.AUTH_SECRET || processEnv.AUTH_SECRET;
  if (!secret) throw new Error('Authentication is not configured.');
  return secret;
}

async function importHmacKey() {
  return crypto.subtle.importKey('raw', encoder.encode(getSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createSessionToken(session: AuthSession) {
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify(session)));
  const signature = await crypto.subtle.sign('HMAC', await importHmacKey(), encoder.encode(payload));
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token?: string | null): Promise<AuthSession | null> {
  if (!token) return null;
  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    const valid = await crypto.subtle.verify('HMAC', await importHmacKey(), base64UrlToBytes(signature), encoder.encode(payload));
    if (!valid) return null;
    const session = decodeJson<AuthSession>(payload);
    if (!session.sub || !session.email || !session.exp || session.exp <= Math.floor(Date.now() / 1000)) return null;
    const email = session.email.trim().toLowerCase();
    return { ...session, email, role: ORGANIZER_EMAILS.has(email) ? 'organizer' : 'candidate' };
  } catch {
    return null;
  }
}

function readCookie(header: string | null, name: string) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

export async function getSession() {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function getRequestSession(request: Request) {
  return verifySessionToken(readCookie(request.headers.get('cookie'), SESSION_COOKIE));
}

export async function requireOrganizerRequest(request: Request) {
  const session = await getRequestSession(request);
  return session?.role === 'organizer' ? session : null;
}

export function safeReturnTo(value: string | null | undefined, fallback = '/attempt/demo') {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

export function sessionCookie(token: string, maxAge = 60 * 60 * 24 * 7) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function temporaryCookie(name: string, value: string, maxAge = 600) {
  return `${name}=${encodeURIComponent(value)}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearTemporaryCookie(name: string) {
  return `${name}=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function randomToken() {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function googleConfig() {
  const clientId = env.GOOGLE_CLIENT_ID || processEnv.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET || processEnv.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google sign-in is not configured.');
  return { clientId, clientSecret };
}

export async function verifyGoogleIdToken(idToken: string, expectedNonce: string) {
  const [encodedHeader, encodedPayload, encodedSignature] = idToken.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error('Google returned an invalid identity token.');
  const header = decodeJson<{ alg?: string; kid?: string }>(encodedHeader);
  const claims = decodeJson<GoogleClaims>(encodedPayload);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Google returned an unsupported identity token.');
  const keysResponse = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!keysResponse.ok) throw new Error('Google identity verification is temporarily unavailable.');
  const keySet = await keysResponse.json() as { keys?: Array<JsonWebKey & { kid?: string }> };
  const jwk = keySet.keys?.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error('Google identity key was not found.');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64UrlToBytes(encodedSignature), encoder.encode(`${encodedHeader}.${encodedPayload}`));
  const now = Math.floor(Date.now() / 1000);
  const { clientId } = googleConfig();
  if (!verified || !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) || claims.aud !== clientId || claims.exp <= now || claims.nonce !== expectedNonce || !claims.email_verified) {
    throw new Error('Google identity verification failed.');
  }
  return claims;
}

export async function saveGoogleUser(claims: GoogleClaims) {
  const email = claims.email.trim().toLowerCase();
  const role = ORGANIZER_EMAILS.has(email) ? 'organizer' : 'candidate';
  await env.DB.prepare(`
    INSERT INTO users (id, email, name, provider, role, created_at)
    VALUES (?, ?, ?, 'google', ?, ?)
    ON CONFLICT(email) DO UPDATE SET name=excluded.name, provider='google', role=excluded.role
  `).bind(`google:${claims.sub}`, email, claims.name || email, role, Math.floor(Date.now() / 1000)).run();
  const user = await env.DB.prepare('SELECT id, email, name, role FROM users WHERE email = ?').bind(email).first<{ id: string; email: string; name: string | null; role: 'candidate' | 'organizer' }>();
  if (!user) throw new Error('Could not create your C&Assess account.');
  return { ...user, name: user.name || email, picture: claims.picture };
}
