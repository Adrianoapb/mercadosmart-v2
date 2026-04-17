function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

async function ensureTables(DB) {
  await DB.prepare(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, salt TEXT NOT NULL, workspace_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`).run();
  await DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)`).run();
  await DB.prepare(`CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, payload TEXT NOT NULL, version TEXT, updated_at TEXT NOT NULL)`).run();
}

function getToken(request) {
  const auth = request.headers.get('Authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function derivePasswordHash(password, salt, iterations = 120000) {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations }, keyMaterial, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
  return `pbkdf2$120000$${await derivePasswordHash(password, salt, 120000)}`;
}

async function verifyPassword(password, user) {
  if (!user?.password_hash) return false;
  if (user.password_hash.startsWith('pbkdf2$')) {
    const [, iterationText, storedHash] = user.password_hash.split('$');
    const iterations = Number(iterationText) || 120000;
    const computed = await derivePasswordHash(password, user.salt, iterations);
    return computed === storedHash;
  }
  const legacy = await sha256(`${user.salt}:${password}`);
  return legacy === user.password_hash;
}

async function sessionUser(DB, token) {
  if (!token) return null;
  const row = await DB.prepare(`SELECT s.token, s.expires_at, u.id, u.name, u.email, u.workspace_id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`).bind(token).first();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
    return null;
  }
  return { token: row.token, user: { id: row.id, name: row.name, email: row.email, workspace_id: row.workspace_id } };
}

export async function onRequestGet(context) {
  try {
    const { DB } = context.env;
    await ensureTables(DB);
    const action = new URL(context.request.url).searchParams.get('action') || 'session';
    if (action !== 'session') return json({ ok: false, error: 'Ação inválida' }, 400);
    const current = await sessionUser(DB, getToken(context.request));
    if (!current) return json({ ok: false, error: 'Sessão inválida' }, 401);
    return json({ ok: true, user: current.user });
  } catch (error) {
    return json({ ok: false, error: `AUTH_ERROR: ${error.message}` }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const { DB } = context.env;
    await ensureTables(DB);
    const body = await context.request.json();
    const action = body.action || '';

    if (action === 'register') {
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!name || !email || password.length < 6) return json({ ok: false, error: 'Nome, e-mail e senha válida são obrigatórios.' }, 400);
      const exists = await DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(email).first();
      if (exists) return json({ ok: false, error: 'Este e-mail já está cadastrado.' }, 409);
      const userId = id('usr');
      const salt = crypto.randomUUID();
      const passwordHash = await hashPassword(password, salt);
      const now = new Date().toISOString();
      const workspaceId = `workspace_${userId.slice(-8)}`;
      await DB.prepare(`INSERT INTO users (id, name, email, password_hash, salt, workspace_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(userId, name, email, passwordHash, salt, workspaceId, now, now).run();
      const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
      await DB.prepare(`INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`).bind(token, userId, expiresAt, now).run();
      return json({ ok: true, session_token: token, user: { id: userId, name, email, workspace_id: workspaceId } });
    }

    if (action === 'login') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!email || !password) return json({ ok: false, error: 'Informe e-mail e senha.' }, 400);
      const user = await DB.prepare(`SELECT id, name, email, password_hash, salt, workspace_id FROM users WHERE email = ?`).bind(email).first();
      if (!user) return json({ ok: false, error: 'Usuário não encontrado.' }, 404);
      const passwordOk = await verifyPassword(password, user);
      if (!passwordOk) return json({ ok: false, error: 'Senha inválida.' }, 401);
      if (!String(user.password_hash || '').startsWith('pbkdf2$')) {
        const upgradedHash = await hashPassword(password, user.salt);
        await DB.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`).bind(upgradedHash, new Date().toISOString(), user.id).run();
      }
      const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
      await DB.prepare(`INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`).bind(token, user.id, expiresAt, now).run();
      return json({ ok: true, session_token: token, user: { id: user.id, name: user.name, email: user.email, workspace_id: user.workspace_id } });
    }

    if (action === 'logout') {
      const token = getToken(context.request);
      if (token) await DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
      return json({ ok: true, message: 'Sessão encerrada.' });
    }

    return json({ ok: false, error: 'Ação inválida.' }, 400);
  } catch (error) {
    return json({ ok: false, error: `AUTH_ERROR: ${error.message}` }, 500);
  }
}
