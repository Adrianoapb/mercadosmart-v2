/* ==========================================
   MERCADOSMART - AUTENTICACAO PROFISSIONAL
   ========================================== */

window.Auth = (() => {
  const STORAGE_KEY = 'ms_auth_session_v1';
  let state = { token: '', user: null, checked: false };

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state = { ...state, ...JSON.parse(raw) };
    } catch (e) {}
  }

  function clearState() {
    state = { token: '', user: null, checked: true };
    localStorage.removeItem(STORAGE_KEY);
  }

  function getToken() { return state.token || ''; }
  function getUser() { return state.user || null; }
  function getUserId() { return state.user?.id || ''; }
  function isAuthenticated() { return !!(state.token && state.user); }

  function showAuthScreen(mode = 'login') {
    document.getElementById('authOverlay')?.classList.remove('hidden');
    document.getElementById('app')?.classList.add('hidden');
    document.getElementById('splashScreen')?.classList.add('hidden');
    switchMode(mode);
  }

  function hideAuthScreen() {
    document.getElementById('authOverlay')?.classList.add('hidden');
  }

  function switchMode(mode = 'login') {
    const loginCard = document.getElementById('authLoginCard');
    const registerCard = document.getElementById('authRegisterCard');
    if (loginCard) loginCard.classList.toggle('hidden', mode !== 'login');
    if (registerCard) registerCard.classList.toggle('hidden', mode !== 'register');
  }

  async function api(action, body = {}, method = 'POST') {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (getToken()) opts.headers.Authorization = `Bearer ${getToken()}`;
    if (method !== 'GET') opts.body = JSON.stringify({ action, ...body });
    const res = await fetch(method === 'GET' ? `/api/auth?action=${encodeURIComponent(action)}` : '/api/auth', opts);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok === false) throw new Error(data?.error || data?.message || `Erro HTTP ${res.status}`);
    return data;
  }

  function applyUserContext() {
    if (!state.user) return;
    DB.setWorkspace(`user_${state.user.id}`);
    DB.CloudSync.saveProfile({ name: state.user.name || state.user.email || '', workspaceId: state.user.workspace_id || `workspace_${state.user.id}` });
    const header = document.getElementById('headerUserChip');
    if (header) header.textContent = `👤 ${state.user.name || state.user.email}`;
    const mini = document.getElementById('accountUserName');
    if (mini) mini.textContent = state.user.name || '-';
    const mail = document.getElementById('accountUserEmail');
    if (mail) mail.textContent = state.user.email || '-';
    const ws = document.getElementById('accountWorkspace');
    if (ws) ws.textContent = state.user.workspace_id || '-';
  }

  async function bootstrap() {
    loadState();
    if (!state.token) {
      clearState();
      showAuthScreen('login');
      return false;
    }
    try {
      const data = await api('session', {}, 'GET');
      state.user = data.user;
      state.checked = true;
      saveState();
      applyUserContext();
      hideAuthScreen();
      return true;
    } catch (e) {
      clearState();
      showAuthScreen('login');
      setTimeout(() => {
        try {
          showToast('Sua sessão expirou ou ainda não foi iniciada. Entre novamente para usar a nuvem.', 'warning', 5000);
        } catch (_) {}
      }, 200);
      return false;
    }
  }

  async function login(email, password) {
    const data = await api('login', { email, password });
    state = { token: data.session_token, user: data.user, checked: true };
    saveState();
    applyUserContext();
    hideAuthScreen();
    return data;
  }

  async function register(name, email, password) {
    const data = await api('register', { name, email, password });
    state = { token: data.session_token, user: data.user, checked: true };
    saveState();
    applyUserContext();
    hideAuthScreen();
    return data;
  }

  async function logout() {
    try { await api('logout'); } catch (e) {}
    clearState();
    DB.setWorkspace('guest');
    location.reload();
  }

  function bindUI() {
    document.getElementById('goRegisterBtn')?.addEventListener('click', () => switchMode('register'));
    document.getElementById('goLoginBtn')?.addEventListener('click', () => switchMode('login'));
    document.getElementById('authLogoutBtn')?.addEventListener('click', logout);

    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        showLoading('Entrando na sua conta...');
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        await login(email, password);
        hideLoading();
        showAppAfterAuth();
        showToast('Login realizado com sucesso!', 'success');
      } catch (err) {
        hideLoading();
        showToast(err.message || 'Falha no login', 'error', 4500);
      }
    });

    document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        showLoading('Criando sua conta...');
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirm = document.getElementById('registerPasswordConfirm').value;
        if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
        if (password !== confirm) throw new Error('As senhas não conferem.');
        await register(name, email, password);
        hideLoading();
        showAppAfterAuth();
        showToast('Conta criada com sucesso!', 'success');
      } catch (err) {
        hideLoading();
        showToast(err.message || 'Falha no cadastro', 'error', 4500);
      }
    });
  }

  function showAppAfterAuth() {
    if (typeof window.showApp === 'function') {
      window.showApp();
      setTimeout(async () => {
        try {
          if (navigator.onLine) {
            await DB.CloudSync.syncSmart({ silent: true });
            if (typeof loadSettings === 'function') loadSettings();
            if (typeof refreshDashboard === 'function') refreshDashboard();
          }
        } catch (e) {}
      }, 300);
    }
  }

  return { bootstrap, bindUI, getToken, getUser, getUserId, isAuthenticated, logout, switchMode };
})();
