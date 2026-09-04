import { env } from 'cloudflare:workers';
import { requireOrganizerRequest } from '../../../../lib/auth';
import { ensureAssessmentSchema } from '../../../../lib/assessment-store';
import { protectMutation } from '../../../../lib/request-security';

export async function POST(request: Request) {
  const blocked=protectMutation(request,{scope:'question-images',limit:10});if(blocked)return blocked;
  const organizer = await requireOrganizerRequest(request);
  if (!organizer) return Response.json({ error: 'Organizer sign-in required.' }, { status: 401 });
  const filesBucket = env.FILES;
  if (!filesBucket) return Response.json({ error: 'Image storage is not enabled on this deployment. Use a text-only paper, or ask the maintainer to enable private R2 storage later.' }, { status: 503 });
  await ensureAssessmentSchema();
  const form = await request.formData();
  const assessmentId = String(form.get('assessmentId') || ''); const importId = String(form.get('importId') || '');
  const files = form.getAll('images').filter((entry): entry is File => entry instanceof File);
  if (!assessmentId || !importId || !files.length) return Response.json({ error: 'Assessment, import session and images are required.' }, { status: 400 });
  const activeImport = await env.DB.prepare("SELECT uploaded_images_json FROM question_imports WHERE id = ? AND assessment_id = ? AND created_by = ? AND status = 'staging'")
    .bind(importId, assessmentId, organizer.email).first<{ uploaded_images_json:string }>();
  if (!activeImport) return Response.json({ error: 'Import session not found.' }, { status: 404 });
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > 10 * 1024 * 1024 || files.some((file) => file.size > 2 * 1024 * 1024)) return Response.json({ error: 'ZIP images must total at most 10 MB and each image at most 2 MB.' }, { status: 400 });
  if (files.some((file) => !/^[^\\/]+\.(png|jpe?g)$/i.test(file.name) || !['image/png','image/jpeg'].includes(file.type))) return Response.json({ error: 'Only safe PNG and JPEG filenames are supported.' }, { status: 400 });
  await Promise.all(files.map((file) => filesBucket.put(`assessments/${assessmentId}/${file.name}`, file.stream(), { httpMetadata: { contentType: file.type } })));
  const names = new Set(JSON.parse(activeImport.uploaded_images_json || '[]') as string[]); files.forEach((file) => names.add(file.name));
  await env.DB.prepare('UPDATE question_imports SET uploaded_images_json = ? WHERE id = ?').bind(JSON.stringify([...names]), importId).run();
  return Response.json({ uploaded: files.length, names: [...names] });
}
