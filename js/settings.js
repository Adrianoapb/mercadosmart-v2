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

  if (typeof updateCloudSyncUI === 'function') updateCloudSyncUI();
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
