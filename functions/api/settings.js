export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await request.json();

  await env.DB.prepare(`
    INSERT OR REPLACE INTO settings
    (user_id, data_json, updated_at)
    VALUES (?, ?, ?)
  `).bind(
    body.user_id || "local-user",
    JSON.stringify(body.data),
    new Date().toISOString()
  ).run();

  return Response.json({ ok: true });
}