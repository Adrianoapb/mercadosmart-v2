/* ==========================================
   MERCADOSMART - SINCRONIZAÇÃO EM NUVEM
   ========================================== */

const CloudSync = (() => {
  const STATE_KEY = 'mercadosmart_state';
  const META_KEY = 'ms_cloud_meta';

  function getMeta() {
    try {
      return JSON.parse(localStorage.getItem(META_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function setMeta(meta = {}) {
    const current = getMeta();
    const next = { ...current, ...meta };
    localStorage.setItem(META_KEY, JSON.stringify(next));
    updateCloudSyncUI();
    return next;
  }

  async function parseResponse(res) {
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      if (res.ok) throw new Error('A API não retornou JSON. Verifique se /api/health e /api/sync foram publicados no Pages.');
    }
    if (!res.ok) throw new Error((data && data.error) ? data.error : `Erro HTTP ${res.status}`);
    if (!data) throw new Error('Resposta vazia da API.');
    return data;
  }

  async function health() {
    const res = await fetch('/api/health', { cache: 'no-store' });
    return parseResponse(res);
  }

  async function push() {
    const payload = DB.exportAllData();
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: STATE_KEY,
        version: payload.version || '1.4.0',
        updated_at: new Date().toISOString(),
        payload,
      }),
    });
    const data = await parseResponse(res);
    setMeta({ status: 'ok', lastSyncAt: data.updated_at || new Date().toISOString(), lastError: '' });
    return data;
  }

  async function pull() {
    const res = await fetch(`/api/sync?key=${encodeURIComponent(STATE_KEY)}`, { cache: 'no-store' });
    const data = await parseResponse(res);
    if (!data.exists || !data.data?.payload) throw new Error('Nenhum backup encontrado na nuvem ainda.');

    const payload = JSON.parse(data.data.payload);
    DB.importAllData(payload);
    setMeta({ status: 'ok', lastSyncAt: data.data.updated_at || new Date().toISOString(), lastError: '' });
    return data;
  }

  async function autoSync() {
    const settings = DB.getSettings();
    if (!navigator.onLine || settings.cloudSyncAuto !== true) return false;

    try {
      const cloudData = await fetch(`/api/sync?key=${encodeURIComponent(STATE_KEY)}`, { cache: 'no-store' }).then(parseResponse);
      const local = DB.exportAllData();
      const hasLocalData = ((local.currentList?.items || []).length > 0) || (local.purchases || []).length > 0 || (local.stock || []).length > 0;

      if (!hasLocalData && cloudData.exists && cloudData.data?.payload) {
        DB.importAllData(JSON.parse(cloudData.data.payload));
        setMeta({ status: 'ok', lastSyncAt: cloudData.data.updated_at || new Date().toISOString(), lastError: '' });
        if (typeof showToast === 'function') showToast('Dados baixados da nuvem com sucesso', 'success');
      } else {
        await push();
      }
      return true;
    } catch (error) {
      setMeta({ status: 'error', lastError: error.message || 'Falha na sincronização automática.' });
      return false;
    }
  }

  function init() {
    updateCloudSyncUI();
    window.addEventListener('online', () => {
      updateCloudSyncUI();
      autoSync();
    });
    window.addEventListener('offline', updateCloudSyncUI);
    setTimeout(() => autoSync(), 1200);
  }

  return { STATE_KEY, getMeta, setMeta, health, push, pull, autoSync, init };
})();

function updateCloudSyncUI() {
  const settings = DB.getSettings();
  const meta = CloudSync.getMeta();

  const toggle = document.getElementById('cloudSyncAutoToggle');
  if (toggle) toggle.checked = settings.cloudSyncAuto === true;

  const badge = document.getElementById('cloudSyncStatusBadge');
  const text = document.getElementById('cloudSyncStatusText');
  if (!badge || !text) return;

  if (!navigator.onLine) {
    badge.textContent = 'Offline';
    text.textContent = 'Sem internet no momento';
    return;
  }

  if (meta.status === 'ok') {
    badge.textContent = 'OK';
    text.textContent = meta.lastSyncAt ? `Última sincronização: ${new Date(meta.lastSyncAt).toLocaleString('pt-BR')}` : 'Conectado e pronto para sincronizar';
    return;
  }

  if (meta.status === 'error') {
    badge.textContent = 'Erro';
    text.textContent = meta.lastError || 'Falha na sincronização com a nuvem';
    return;
  }

  badge.textContent = 'Pronto';
  text.textContent = 'Ainda sem sincronização';
}

function saveCloudSyncAutoSetting() {
  const settings = DB.getSettings();
  settings.cloudSyncAuto = !!document.getElementById('cloudSyncAutoToggle')?.checked;
  DB.saveSettings(settings);
  updateCloudSyncUI();
  showToast(settings.cloudSyncAuto ? 'Sync automático ativado' : 'Sync automático desativado', 'info');
  if (settings.cloudSyncAuto) CloudSync.autoSync();
}

async function testCloudConnection() {
  try {
    const result = await CloudSync.health();
    CloudSync.setMeta({ status: 'ok', lastError: '' });
    showToast((result && result.message) ? result.message : 'Conexão com a nuvem OK', 'success');
  } catch (error) {
    CloudSync.setMeta({ status: 'error', lastError: error.message || 'Falha na conexão com a nuvem.' });
    showToast(`Falha na conexão com a nuvem: ${error.message || 'erro desconhecido'}`, 'error', 5000);
  }
}

async function pushCloudBackup() {
  try {
    showLoading('Enviando dados para a nuvem...');
    const result = await CloudSync.push();
    hideLoading();
    showToast(result.message || 'Dados enviados com sucesso', 'success');
  } catch (error) {
    hideLoading();
    CloudSync.setMeta({ status: 'error', lastError: error.message || 'Falha ao enviar dados.' });
    showToast(`Falha ao enviar para a nuvem: ${error.message || 'erro desconhecido'}`, 'error', 5000);
  }
}

async function pullCloudBackup() {
  try {
    showLoading('Baixando dados da nuvem...');
    await CloudSync.pull();
    hideLoading();
    if (typeof populateCategorySelects === 'function') populateCategorySelects();
    if (typeof loadSettings === 'function') loadSettings();
    if (typeof refreshDashboard === 'function') refreshDashboard();
    if (typeof renderCurrentList === 'function') renderCurrentList();
    if (typeof renderHistory === 'function') renderHistory();
    if (typeof renderStock === 'function') renderStock();
    if (typeof refreshReports === 'function') refreshReports();
    showToast('Dados baixados da nuvem com sucesso', 'success');
  } catch (error) {
    hideLoading();
    CloudSync.setMeta({ status: 'error', lastError: error.message || 'Falha ao baixar dados.' });
    showToast(`Falha ao baixar da nuvem: ${error.message || 'erro desconhecido'}`, 'error', 5000);
  }
}
