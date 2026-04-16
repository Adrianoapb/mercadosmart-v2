function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    ...init,
  });
}

export async function onRequestGet(context) {
  try {
    const { DB } = context.env;
    if (!DB) return json({ ok: false, error: 'Binding DB não encontrado.' }, { status: 500 });

    const url = new URL(context.request.url);
    const key = url.searchParams.get('key') || 'mercadosmart_state';
    const row = await DB.prepare('SELECT key, payload, version, updated_at FROM app_state WHERE key = ?').bind(key).first();

    return json({ ok: true, exists: !!row, data: row || null });
  } catch (error) {
    return json({ ok: false, error: error?.message || 'Falha ao buscar dados da nuvem.' }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const { DB } = context.env;
    if (!DB) return json({ ok: false, error: 'Binding DB não encontrado.' }, { status: 500 });

    const body = await context.request.json();
    const key = body?.key || 'mercadosmart_state';
    const payload = typeof body?.payload === 'string' ? body.payload : JSON.stringify(body?.payload ?? null);
    const version = body?.version || '1.0.0';
    const updatedAt = body?.updated_at || new Date().toISOString();

    await DB.prepare(`
      INSERT INTO app_state (key, payload, version, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        payload = excluded.payload,
        version = excluded.version,
        updated_at = excluded.updated_at
    `).bind(key, payload, version, updatedAt).run();

    return json({ ok: true, message: 'Dados enviados para a nuvem com sucesso.', key, updated_at: updatedAt });
  } catch (error) {
    return json({ ok: false, error: error?.message || 'Falha ao enviar dados para a nuvem.' }, { status: 500 });
  }
}
