function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

async function ensureTables(DB) {
  await DB.prepare(`CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, payload TEXT NOT NULL, version TEXT, updated_at TEXT NOT NULL)`).run();
  await DB.prepare(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, salt TEXT NOT NULL, workspace_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`).run();
  await DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)`).run();
}

function sanitizeNamespace(namespace = '') {
  return String(namespace || '').trim().slice(0, 180);
}

async function authUser(DB, request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;
  const row = await DB.prepare(`SELECT s.token, s.expires_at, u.id, u.workspace_id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`).bind(token).first();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
    return null;
  }
  return row;
}

export async function onRequestGet(context) {
  try {
    const { DB, request } = context.env ? { DB: context.env.DB, request: context.request } : context;
    await ensureTables(DB);
    const session = await authUser(DB, request);
    if (!session) return json({ ok: false, error: 'Não autenticado.' }, 401);
    const url = new URL(request.url);
    const namespace = sanitizeNamespace(url.searchParams.get('namespace'));
    if (!namespace) return json({ ok: false, error: 'namespace é obrigatório' }, 400);
    if (!namespace.startsWith(`user:${session.id}:`)) return json({ ok: false, error: 'namespace não pertence ao usuário atual' }, 403);
    const row = await DB.prepare(`SELECT key, payload, version, updated_at FROM app_state WHERE key = ?`).bind(namespace).first();
    return json({ ok: true, exists: !!row, row: row || null });
  } catch (error) {
    return json({ ok: false, error: `D1_ERROR: ${error.message}` }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const { DB, request } = context.env ? { DB: context.env.DB, request: context.request } : context;
    await ensureTables(DB);
    const session = await authUser(DB, request);
    if (!session) return json({ ok: false, error: 'Não autenticado.' }, 401);
    const body = await request.json();
    const namespace = sanitizeNamespace(body.namespace);
    if (!namespace) return json({ ok: false, error: 'namespace é obrigatório' }, 400);
    if (!namespace.startsWith(`user:${session.id}:`)) return json({ ok: false, error: 'namespace não pertence ao usuário atual' }, 403);
    if (typeof body.payload === 'undefined') return json({ ok: false, error: 'payload é obrigatório' }, 400);
    const existing = await DB.prepare(`SELECT updated_at FROM app_state WHERE key = ?`).bind(namespace).first();
    const now = new Date().toISOString();
    const force = !!body.force;
    const baseUpdatedAt = body.baseUpdatedAt || null;
    if (existing && !force && baseUpdatedAt && existing.updated_at !== baseUpdatedAt) {
      return json({ ok: false, error: 'CONFLICT', message: 'A nuvem foi atualizada em outro aparelho. Baixe da nuvem antes de enviar novamente.', current_updated_at: existing.updated_at }, 409);
    }
    await DB.prepare(`INSERT INTO app_state (key, payload, version, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, version = excluded.version, updated_at = excluded.updated_at`).bind(namespace, JSON.stringify(body.payload), body.version || '3.0.0', now).run();
    return json({ ok: true, message: 'Backup em nuvem atualizado com sucesso.', updated_at: now });
  } catch (error) {
    return json({ ok: false, error: `D1_ERROR: ${error.message}` }, 500);
  }
}
