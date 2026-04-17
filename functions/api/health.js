function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

async function ensureTables(DB) {
  await DB.prepare(`CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, payload TEXT NOT NULL, version TEXT, updated_at TEXT NOT NULL)`).run();
  await DB.prepare(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, salt TEXT NOT NULL, workspace_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`).run();
  await DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)`).run();
}

export async function onRequestGet(context) {
  try {
    await ensureTables(context.env.DB);
    await context.env.DB.prepare(`SELECT COUNT(*) AS total FROM app_state`).first();
    return json({ ok: true, message: 'API e D1 conectados com sucesso.' });
  } catch (error) {
    return json({ ok: false, error: `D1_ERROR: ${error.message}` }, 500);
  }
}
