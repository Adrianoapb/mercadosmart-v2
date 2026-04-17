export async function onRequestGet() {
  return Response.json({ ok: false, error: 'LEGACY_ENDPOINT_DISABLED', message: 'Este endpoint pertence a uma versão antiga do app. Use /api/sync e o armazenamento local atual.' }, { status: 410 });
}

export async function onRequestPost() {
  return Response.json({ ok: false, error: 'LEGACY_ENDPOINT_DISABLED', message: 'Este endpoint pertence a uma versão antiga do app. Use /api/sync e o armazenamento local atual.' }, { status: 410 });
}
