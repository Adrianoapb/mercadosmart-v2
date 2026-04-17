export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await request.json();

  await env.DB.prepare(`
    INSERT INTO purchase_history
    (id, user_id, item_name, qty, unit, price, purchased_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.id,
    body.user_id || "local-user",
    body.item_name,
    body.qty,
    body.unit,
    body.price,
    new Date().toISOString()
  ).run();

  return Response.json({ ok: true });
}