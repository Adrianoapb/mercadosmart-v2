export async function onRequestGet(context) {
  try {
    const { env } = context;
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, payload TEXT NOT NULL, version TEXT, updated_at TEXT NOT NULL)`).run();
    await env.DB.prepare(`SELECT COUNT(*) AS total FROM app_state`).first();
    return Response.json({ ok: true, message: 'API e D1 conectados com sucesso.' });
  } catch (error) {
    return Response.json({ ok: false, error: `D1_ERROR: ${error.message}` }, { status: 500 });
  }
}
