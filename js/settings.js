/* ==========================================
   MERCADOSMART - CONFIGURAÇÕES
   ========================================== */

function loadSettings() {
  const settings = DB.getSettings();

  // Tema
  applyTheme(settings.theme || 'dark');

  // Moeda
  const currencyEl = document.getElementById('currencySelect');
  if (currencyEl) currencyEl.value = settings.currency || 'R$';

  // Toggles
  const sortToggle = document.getElementById('sortByCategoryToggle');
  if (sortToggle) sortToggle.checked = settings.sortByCategory !== false;

  const sugToggle = document.getElementById('showSuggestionsToggle');
  if (sugToggle) sugToggle.checked = settings.showSuggestions !== false;

  const lowStockToggle = document.getElementById('lowStockAlertToggle');
  if (lowStockToggle) lowStockToggle.checked = settings.lowStockAlert !== false;

  const autoAddLowStockToggle = document.getElementById('autoAddLowStockToListToggle');
  if (autoAddLowStockToggle) autoAddLowStockToggle.checked = settings.autoAddLowStockToList !== false;

  const idealToggle = document.getElementById('useIdealStockSuggestionsToggle');
  if (idealToggle) idealToggle.checked = settings.useIdealStockSuggestions !== false;

  const thresholdEl = document.getElementById('lowStockThreshold');
  if (thresholdEl) thresholdEl.value = settings.lowStockThreshold || 2;

  const budgetEl = document.getElementById('monthlyBudget');
  if (budgetEl) budgetEl.value = settings.monthlyBudget || 0;

  const notifyToggle = document.getElementById('browserNotificationsToggle');
  if (notifyToggle) notifyToggle.checked = settings.enableBrowserNotifications === true;

  const autoCatToggle = document.getElementById('autoCategorizeProductsToggle');
  if (autoCatToggle) autoCatToggle.checked = settings.autoCategorizeProducts !== false;

  const smartPredToggle = document.getElementById('smartPredictionToggle');
  if (smartPredToggle) smartPredToggle.checked = settings.smartPredictionEnabled !== false;

  const expiryAlertToggle = document.getElementById('expiryAlertToggle');
  if (expiryAlertToggle) expiryAlertToggle.checked = settings.expiryAlert !== false;

  // Tema botões
  updateThemeButtons(settings.theme || 'dark');

  // Categorias
  renderCategoriesSettings();
  loadCloudSettings();
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
}

function setTheme(theme) {
  applyTheme(theme);
  const settings = DB.getSettings();
  settings.theme = theme;
  DB.saveSettings(settings);
  updateThemeButtons(theme);
  destroyAllCharts();
  setTimeout(() => {
    if (document.getElementById('pageDashboard').classList.contains('active')) refreshDashboard();
    if (document.getElementById('pageReports').classList.contains('active')) refreshReports();
  }, 100);
  showToast(`Tema ${theme === 'dark' ? 'escuro' : 'claro'} ativado`, 'info');
}

function updateThemeButtons(theme) {
  const lightBtn = document.getElementById('themeLight');
  const darkBtn = document.getElementById('themeDark');
  if (lightBtn) lightBtn.classList.toggle('active', theme === 'light');
  if (darkBtn) darkBtn.classList.toggle('active', theme === 'dark');
}

function toggleTheme() {
  const settings = DB.getSettings();
  const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}

function saveCurrencySetting() {
  const cur = document.getElementById('currencySelect')?.value || 'R$';
  const settings = DB.getSettings();
  settings.currency = cur;
  DB.saveSettings(settings);
  showToast(`Moeda alterada para ${cur}`, 'info');
}

function saveSortSetting() {
  const val = document.getElementById('sortByCategoryToggle')?.checked;
  const settings = DB.getSettings();
  settings.sortByCategory = val;
  DB.saveSettings(settings);
}

function saveSuggestionSetting() {
  const val = document.getElementById('showSuggestionsToggle')?.checked;
  const settings = DB.getSettings();
  settings.showSuggestions = val;
  DB.saveSettings(settings);
  renderSuggestions();
}

function saveLowStockSetting() {
  const val = document.getElementById('lowStockAlertToggle')?.checked;
  const settings = DB.getSettings();
  settings.lowStockAlert = val;
  DB.saveSettings(settings);
}

function saveAutoAddLowStockSetting() {
  const val = document.getElementById('autoAddLowStockToListToggle')?.checked;
  const settings = DB.getSettings();
  settings.autoAddLowStockToList = val;
  DB.saveSettings(settings);
  showToast(val ? 'Reposição automática ativada' : 'Reposição automática desativada', 'info');
}

function saveLowStockThreshold() {
  const val = parseInt(document.getElementById('lowStockThreshold')?.value) || 2;
  const settings = DB.getSettings();
  settings.lowStockThreshold = val;
  DB.saveSettings(settings);
  renderStock();
}


function saveIdealSuggestionSetting() {
  const val = document.getElementById('useIdealStockSuggestionsToggle')?.checked;
  const settings = DB.getSettings();
  settings.useIdealStockSuggestions = val;
  DB.saveSettings(settings);
  showToast(val ? 'Sugestão pela meta ideal ativada' : 'Sugestão pela meta ideal desativada', 'info');
}


function saveMonthlyBudget() {
  const val = parseFloat(document.getElementById('monthlyBudget')?.value) || 0;
  const settings = DB.getSettings();
  settings.monthlyBudget = val;
  DB.saveSettings(settings);
  if (typeof refreshDashboard === 'function') refreshDashboard();
  if (typeof refreshReports === 'function') refreshReports();
  showToast(val > 0 ? 'Meta mensal salva' : 'Meta mensal removida', 'info');
}

async function saveBrowserNotificationSetting() {
  const checked = document.getElementById('browserNotificationsToggle')?.checked;
  const settings = DB.getSettings();

  if (checked && 'Notification' in window) {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      document.getElementById('browserNotificationsToggle').checked = false;
      settings.enableBrowserNotifications = false;
      DB.saveSettings(settings);
      showToast('Permissão de notificação não concedida', 'warning');
      return;
    }
  }

  settings.enableBrowserNotifications = !!checked;
  DB.saveSettings(settings);
  showToast(checked ? 'Notificações locais ativadas' : 'Notificações locais desativadas', 'info');
}

function saveAutoCategorizeSetting() {
  const checked = document.getElementById('autoCategorizeProductsToggle')?.checked;
  const settings = DB.getSettings();
  settings.autoCategorizeProducts = !!checked;
  DB.saveSettings(settings);
  showToast(checked ? 'Categoria automática ativada' : 'Categoria automática desativada', 'info');
}

function saveSmartPredictionSetting() {
  const checked = document.getElementById('smartPredictionToggle')?.checked;
  const settings = DB.getSettings();
  settings.smartPredictionEnabled = !!checked;
  DB.saveSettings(settings);
  if (typeof refreshDashboard === 'function') refreshDashboard();
  showToast(checked ? 'Sugestões inteligentes ativadas' : 'Sugestões inteligentes desativadas', 'info');
}

function saveExpiryAlertSetting() {
  const checked = document.getElementById('expiryAlertToggle')?.checked;
  const settings = DB.getSettings();
  settings.expiryAlert = !!checked;
  DB.saveSettings(settings);
  if (typeof renderStock === 'function') renderStock();
  showToast(checked ? 'Alertas de validade ativados' : 'Alertas de validade desativados', 'info');
}


function loadCloudSettings() {
  const settings = DB.getSettings();
  const profile = DB.getCloudProfile();
  const meta = DB.getCloudMeta();

  const autoSyncToggle = document.getElementById('cloudAutoSyncToggle');
  if (autoSyncToggle) autoSyncToggle.checked = settings.cloudAutoSync !== false;

  const strategySelect = document.getElementById('cloudSyncStrategy');
  if (strategySelect) strategySelect.value = settings.cloudSyncStrategy || 'ask';

  const profileName = document.getElementById('cloudProfileName');
  if (profileName) {
    if ('value' in profileName) profileName.value = profile.name || '';
    else profileName.textContent = profile.name || 'Conta protegida';
  }

  const workspaceInput = document.getElementById('cloudWorkspaceId');
  if (workspaceInput) {
    if ('value' in workspaceInput) workspaceInput.value = profile.workspaceId || '';
    else workspaceInput.textContent = profile.workspaceId || 'Workspace automático';
  }

  renderCloudStatus(meta);
}

function renderCloudStatus(meta = DB.getCloudMeta()) {
  const statusEl = document.getElementById('cloudStatusText');
  const detailEl = document.getElementById('cloudStatusDetail');
  const badgeEl = document.getElementById('cloudStatusBadge');
  if (!statusEl || !detailEl || !badgeEl) return;

  const map = {
    idle: ['Pronto para sincronizar', 'Nenhuma sincronização executada ainda', 'neutral'],
    healthy: ['Conexão validada', 'API e D1 responderam com sucesso', 'success'],
    syncing: ['Sincronizando agora', 'Enviando ou baixando dados da nuvem', 'info'],
    synced: ['Tudo sincronizado', 'Seus dados local e nuvem estão alinhados', 'success'],
    offline: ['Sem internet', 'O app continua offline e sincroniza quando voltar a conexão', 'warning'],
    empty_cloud: ['Nuvem vazia', 'Ainda não existe backup remoto para este workspace', 'neutral'],
    local_changes: ['Alterações locais pendentes', 'Existem mudanças offline aguardando envio', 'warning'],
    profile_updated: ['Perfil atualizado', 'Salve ou sincronize para aplicar o novo namespace', 'info'],
  };

  const [title, desc, badge] = map[meta.status] || ['Status indisponível', meta.lastError || 'Sem detalhes', 'neutral'];
  statusEl.textContent = title;
  detailEl.textContent = meta.lastError || desc;
  badgeEl.textContent = badge === 'success' ? 'OK' : badge === 'warning' ? 'Atenção' : badge === 'info' ? 'Sync' : 'Pronto';
  badgeEl.className = `status-pill ${badge}`;

  const syncInfo = [];
  if (meta.lastSyncAt) syncInfo.push(`Última sincronização: ${new Date(meta.lastSyncAt).toLocaleString('pt-BR')}`);
  if (meta.pendingChanges) syncInfo.push('Há alterações locais pendentes');
  if (meta.lastKnownCloudUpdatedAt) syncInfo.push(`Nuvem atualizada em: ${new Date(meta.lastKnownCloudUpdatedAt).toLocaleString('pt-BR')}`);
  const infoEl = document.getElementById('cloudSyncMeta');
  if (infoEl) infoEl.textContent = syncInfo.join(' • ') || 'Modo offline ativo como base principal.';
}

function saveCloudAutoSyncSetting() {
  const checked = document.getElementById('cloudAutoSyncToggle')?.checked;
  const settings = DB.getSettings();
  settings.cloudAutoSync = !!checked;
  DB.saveSettings(settings);
  renderCloudStatus(DB.getCloudMeta());
  showToast(checked ? 'Sync automático ativado' : 'Sync automático desativado', 'info');
}

function saveCloudStrategySetting() {
  const value = document.getElementById('cloudSyncStrategy')?.value || 'ask';
  const settings = DB.getSettings();
  settings.cloudSyncStrategy = value;
  DB.saveSettings(settings);
  showToast('Estratégia de sincronização atualizada', 'success');
}

function saveCloudProfileSettings() {
  const name = document.getElementById('cloudProfileName')?.value?.trim() || '';
  const workspaceId = document.getElementById('cloudWorkspaceId')?.value?.trim() || DB.getCloudProfile().workspaceId;
  const profile = DB.CloudSync.saveProfile({ name, workspaceId });
  renderCloudStatus(DB.getCloudMeta());
  loadCloudSettings();
  showToast(`Perfil salvo para workspace ${profile.workspaceId}`, 'success');
}

function regenerateWorkspaceId() {
  const workspaceId = `workspace_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  DB.CloudSync.saveProfile({ workspaceId });
  loadCloudSettings();
  showToast('Novo workspace gerado', 'info');
}

async function testCloudConnection() {
  try {
    showLoading('Testando conexão com a nuvem...');
    const result = await DB.CloudSync.health();
    renderCloudStatus(DB.getCloudMeta());
    showToast((result && result.message) ? result.message : 'Conexão com a nuvem OK', 'success');
  } catch (e) {
    DB.CloudSync.setMeta({ status: 'error', lastError: e.message || 'Falha ao testar conexão' });
    renderCloudStatus(DB.getCloudMeta());
    showToast(`Falha na conexão com a nuvem: ${e.message}`, 'error', 4500);
  } finally {
    hideLoading();
  }
}

async function pushCloudBackup(force = false) {
  try {
    showLoading('Enviando backup para a nuvem...');
    const result = await DB.CloudSync.push({ force });
    renderCloudStatus(DB.getCloudMeta());
    showToast(result.message || 'Backup enviado com sucesso!', 'success');
  } catch (e) {
    DB.CloudSync.setMeta({ status: 'error', lastError: e.message || 'Falha ao enviar backup' });
    renderCloudStatus(DB.getCloudMeta());
    showToast(`Erro ao enviar: ${e.message}`, 'error', 4500);
  } finally {
    hideLoading();
  }
}

async function pullCloudBackup() {
  try {
    showLoading('Baixando backup da nuvem...');
    const result = await DB.CloudSync.pull();
    renderCloudStatus(DB.getCloudMeta());
    if (result.empty) {
      showToast('Ainda não há backup remoto para este workspace', 'info');
      return;
    }
    loadSettings();
    populateCategorySelects();
    refreshCurrentPageAfterCloudSync();
    showToast('Backup baixado com sucesso!', 'success');
  } catch (e) {
    DB.CloudSync.setMeta({ status: 'error', lastError: e.message || 'Falha ao baixar backup' });
    renderCloudStatus(DB.getCloudMeta());
    showToast(`Erro ao baixar: ${e.message}`, 'error', 4500);
  } finally {
    hideLoading();
  }
}

async function syncCloudNow() {
  try {
    showLoading('Sincronizando dados...');
    const result = await DB.CloudSync.syncSmart();
    renderCloudStatus(DB.getCloudMeta());
    if (result.offline) {
      showToast('Sem internet. O app continua funcionando offline.', 'warning');
      return;
    }
    if (!result.noop) refreshCurrentPageAfterCloudSync();
    showToast('Sincronização concluída com sucesso!', 'success');
  } catch (e) {
    DB.CloudSync.setMeta({ status: 'error', lastError: e.message || 'Falha ao sincronizar' });
    renderCloudStatus(DB.getCloudMeta());
    showToast(`Erro ao sincronizar: ${e.message}`, 'error', 4500);
  } finally {
    hideLoading();
  }
}

function refreshCurrentPageAfterCloudSync() {
  if (typeof refreshDashboard === 'function') refreshDashboard();
  if (typeof renderShoppingList === 'function') renderShoppingList();
  if (typeof renderStock === 'function') renderStock();
  if (typeof renderHistory === 'function') renderHistory();
  if (typeof refreshReports === 'function') refreshReports();
}
