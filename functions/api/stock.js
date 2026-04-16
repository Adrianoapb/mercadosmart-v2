export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id") || "local-user";

  const { results } = await env.DB
    .prepare("SELECT * FROM stock_items WHERE user_id = ?")
    .bind(userId)
    .all();

  return Response.json(results || []);
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await request.json();

  await env.DB.prepare(`
    INSERT OR REPLACE INTO stock_items
    (id, user_id, name, category, qty, unit, ideal_qty, barcode, brand, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.id,
    body.user_id || "local-user",
    body.name,
    body.category,
    body.qty,
    body.unit,
    body.ideal_qty,
    body.barcode,
    body.brand,
    body.notes,
    new Date().toISOString()
  ).run();

  return Response.json({ ok: true });
}