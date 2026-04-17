export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id") || "local-user";

  const { results } = await env.DB
    .prepare("SELECT * FROM shopping_list WHERE user_id = ?")
    .bind(userId)
    .all();

  return Response.json(results || []);
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await request.json();

  await env.DB.prepare(`
    INSERT OR REPLACE INTO shopping_list
    (id, user_id, name, category, qty, unit, price, selected, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.id,
    body.user_id || "local-user",
    body.name,
    body.category,
    body.qty,
    body.unit,
    body.price,
    body.selected ? 1 : 0,
    new Date().toISOString()
  ).run();

  return Response.json({ ok: true });
}