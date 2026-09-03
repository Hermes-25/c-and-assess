import { getRequestSession } from '../../../../lib/auth';

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return Response.json({ authenticated: false }, { status: 401 });
  return Response.json({ authenticated: true, user: { email: session.email, name: session.name, picture: session.picture, role: session.role } });
}
