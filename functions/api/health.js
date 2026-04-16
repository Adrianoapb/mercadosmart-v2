export async function onRequestGet(context) {
  try {
    const { DB } = context.env;
    if (!DB) {
      return Response.json({ ok: false, error: 'Binding DB não encontrado.' }, { status: 500 });
    }

    await DB.prepare('SELECT COUNT(*) AS total FROM app_state').first();
    return Response.json({ ok: true, message: 'API e D1 conectados com sucesso.' });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Falha ao verificar conexão com D1.' }, { status: 500 });
  }
}
