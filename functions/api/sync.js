function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

async function ensureTable(DB) {
  await DB.prepare(`CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, payload TEXT NOT NULL, version TEXT, updated_at TEXT NOT NULL)`).run();
}

function sanitizeNamespace(namespace = '') {
  return String(namespace || '').trim().slice(0, 120);
}

export async function onRequestGet(context) {
  try {
    const { env, request } = context;
    await ensureTable(env.DB);
    const url = new URL(request.url);
    const namespace = sanitizeNamespace(url.searchParams.get('namespace'));
    if (!namespace) return json({ ok: false, error: 'namespace é obrigatório' }, 400);

    const row = await env.DB.prepare(`SELECT key, payload, version, updated_at FROM app_state WHERE key = ?`).bind(namespace).first();
    return json({ ok: true, exists: !!row, row: row || null });
  } catch (error) {
    return json({ ok: false, error: `D1_ERROR: ${error.message}` }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const { env, request } = context;
    await ensureTable(env.DB);
    const body = await request.json();
    const namespace = sanitizeNamespace(body.namespace);
    if (!namespace) return json({ ok: false, error: 'namespace é obrigatório' }, 400);
    if (typeof body.payload === 'undefined') return json({ ok: false, error: 'payload é obrigatório' }, 400);

    const existing = await env.DB.prepare(`SELECT updated_at FROM app_state WHERE key = ?`).bind(namespace).first();
    const now = new Date().toISOString();
    const force = !!body.force;
    const baseUpdatedAt = body.baseUpdatedAt || null;

    if (existing && !force && baseUpdatedAt && existing.updated_at !== baseUpdatedAt) {
      return json({ ok: false, error: 'CONFLICT', message: 'A nuvem foi atualizada por outro aparelho. Baixe da nuvem antes de enviar novamente.', current_updated_at: existing.updated_at }, 409);
    }

    await env.DB.prepare(`
      INSERT INTO app_state (key, payload, version, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        payload = excluded.payload,
        version = excluded.version,
        updated_at = excluded.updated_at
    `).bind(namespace, JSON.stringify(body.payload), body.version || '2.0.0', now).run();

    return json({ ok: true, message: 'Backup em nuvem atualizado com sucesso.', updated_at: now });
  } catch (error) {
    return json({ ok: false, error: `D1_ERROR: ${error.message}` }, 500);
  }
}
