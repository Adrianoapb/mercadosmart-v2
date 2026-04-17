/* ==========================================
   MERCADOSMART - BANCO DE DADOS LOCAL
   Armazenamento via localStorage (offline)
   ========================================== */

const DB = (() => {
  const BASE_PREFIX = 'ms_';
  const GLOBAL_WORKSPACE_KEY = 'ms_active_workspace';
  const KEYS = {
    settings: 'settings',
    currentList: 'current_list',
    purchases: 'purchases',
    stock: 'stock',
    categories: 'categories',
    priceHistory: 'price_history',
    productHistory: 'product_history', // frequência de uso
    cloudProfile: 'cloud_profile',
    cloudMeta: 'cloud_meta',
  };

  function getWorkspace() {
    return localStorage.getItem(GLOBAL_WORKSPACE_KEY) || 'guest';
  }

  function setWorkspace(workspaceId = 'guest') {
    localStorage.setItem(GLOBAL_WORKSPACE_KEY, String(workspaceId || 'guest'));
    return getWorkspace();
  }

  function workspacePrefix() {
    return `${BASE_PREFIX}${getWorkspace()}_`;
  }

  // --- CORE ---
  function _get(key) {
    try {
      const raw = localStorage.getItem(workspacePrefix() + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('DB read error:', key, e);
      return null;
    }
  }

  function _set(key, value, options = {}) {
    try {
      localStorage.setItem(workspacePrefix() + key, JSON.stringify(value));
      if (!options.skipCloudMeta && key !== KEYS.cloudMeta && key !== KEYS.cloudProfile) {
        markLocalChange();
      }
      return true;
    } catch (e) {
      console.error('DB save error:', e);
      showToast('Erro ao salvar dados. Armazenamento cheio?', 'error');
      return false;
    }
  }

  function _remove(key) {
    localStorage.removeItem(workspacePrefix() + key);
  }


  function createId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function getCloudProfile() {
    const stored = _get(KEYS.cloudProfile) || {};
    const settings = _get(KEYS.settings) || {};
    const profile = {
      name: stored.name || settings.cloudProfileName || '',
      workspaceId: stored.workspaceId || settings.cloudWorkspaceId || createId('workspace'),
      createdAt: stored.createdAt || new Date().toISOString(),
      updatedAt: stored.updatedAt || new Date().toISOString(),
    };

    if (!stored.workspaceId || stored.name !== profile.name || stored.workspaceId !== profile.workspaceId) {
      _set(KEYS.cloudProfile, profile, { skipCloudMeta: true });
      const mergedSettings = { ...getSettings(), cloudProfileName: profile.name, cloudWorkspaceId: profile.workspaceId };
      _set(KEYS.settings, mergedSettings, { skipCloudMeta: true });
    }
    return profile;
  }

  function saveCloudProfile(profileUpdates = {}) {
    const current = getCloudProfile();
    const next = {
      ...current,
      ...profileUpdates,
      workspaceId: (profileUpdates.workspaceId || current.workspaceId || createId('workspace')).trim(),
      name: (profileUpdates.name || current.name || '').trim(),
      updatedAt: new Date().toISOString(),
    };
    _set(KEYS.cloudProfile, next, { skipCloudMeta: true });
    const mergedSettings = { ...getSettings(), cloudProfileName: next.name, cloudWorkspaceId: next.workspaceId };
    _set(KEYS.settings, mergedSettings, { skipCloudMeta: true });
    return next;
  }

  function getCloudMeta() {
    return _get(KEYS.cloudMeta) || {
      status: 'idle',
      lastSyncAt: '',
      lastPushAt: '',
      lastPullAt: '',
      lastKnownCloudUpdatedAt: '',
      localUpdatedAt: new Date().toISOString(),
      pendingChanges: false,
      lastError: '',
    };
  }

  function saveCloudMeta(meta) {
    return _set(KEYS.cloudMeta, { ...getCloudMeta(), ...meta }, { skipCloudMeta: true });
  }

  function markLocalChange() {
    saveCloudMeta({
      localUpdatedAt: new Date().toISOString(),
      pendingChanges: true,
      status: 'local_changes',
    });
  }

  function hasMeaningfulLocalData() {
    const snapshot = exportAllData();
    return Boolean(
      (snapshot.currentList?.items || []).length ||
      (snapshot.purchases || []).length ||
      (snapshot.stock || []).length ||
      Object.keys(snapshot.priceHistory || {}).length ||
      Object.keys(snapshot.productHistory || {}).length
    );
  }

  function parseResponseErrorFallback(res) {
    return `Erro HTTP ${res.status}`;
  }

  async function parseCloudResponse(res) {
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      if (res.ok) throw new Error('A API não retornou JSON. Verifique /api/health e /api/sync.');
    }

    if (!res.ok) {
      throw new Error((data && (data.error || data.message)) || parseResponseErrorFallback(res));
    }
    if (!data) throw new Error('Resposta vazia da API.');
    if (data.ok === false) throw new Error(data.error || data.message || 'Erro desconhecido na nuvem.');
    return data;
  }


  function getAuthHeaders(extra = {}) {
    const headers = { ...extra };
    try {
      const token = window.Auth && typeof window.Auth.getToken === 'function' ? window.Auth.getToken() : '';
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch (e) {
      console.debug('Falha ao obter token de autenticação', e);
    }
    return headers;
  }

  const CloudSync = {
    getProfile() {
      return getCloudProfile();
    },

    saveProfile(updates = {}) {
      const profile = saveCloudProfile(updates);
      saveCloudMeta({ status: 'profile_updated' });
      return profile;
    },

    getMeta() {
      return getCloudMeta();
    },

    setMeta(meta = {}) {
      return saveCloudMeta(meta);
    },

    getNamespace() {
      const profile = getCloudProfile();
      const userId = (window.Auth && typeof window.Auth.getUserId === 'function' && window.Auth.getUserId()) || 'guest';
      return `user:${userId}:workspace:${profile.workspaceId}`;
    },

    buildPayload() {
      const profile = getCloudProfile();
      return {
        app: 'MercadoSmart',
        version: '2.0.0',
        profile,
        snapshot: exportAllData(),
      };
    },

    async health() {
      const res = await fetch('/api/health', { method: 'GET', cache: 'no-store', headers: getAuthHeaders() });
      const data = await parseCloudResponse(res);
      saveCloudMeta({ status: 'healthy', lastError: '' });
      return data;
    },

    async fetchRemote() {
      const namespace = this.getNamespace();
      const res = await fetch(`/api/sync?namespace=${encodeURIComponent(namespace)}`, { method: 'GET', cache: 'no-store', headers: getAuthHeaders() });
      return parseCloudResponse(res);
    },

    async push(options = {}) {
      const force = !!options.force;
      const payload = this.buildPayload();
      const meta = getCloudMeta();
      const body = {
        namespace: this.getNamespace(),
        payload,
        version: payload.version,
        baseUpdatedAt: force ? null : (meta.lastKnownCloudUpdatedAt || null),
        force,
      };
      saveCloudMeta({ status: 'syncing', lastError: '' });
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });
      const data = await parseCloudResponse(res);
      saveCloudMeta({
        status: 'synced',
        pendingChanges: false,
        lastPushAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString(),
        lastKnownCloudUpdatedAt: data.updated_at || '',
        lastError: '',
      });
      return data;
    },

    applyRemotePayload(remoteRow) {
      const payload = typeof remoteRow.payload === 'string' ? JSON.parse(remoteRow.payload) : remoteRow.payload;
      const snapshot = payload?.snapshot || payload;
      if (!snapshot) throw new Error('Snapshot remoto inválido.');
      importAllData(snapshot);
      if (payload?.profile) saveCloudProfile(payload.profile);
      saveCloudMeta({
        status: 'synced',
        pendingChanges: false,
        lastPullAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString(),
        lastKnownCloudUpdatedAt: remoteRow.updated_at || '',
        lastError: '',
      });
      return snapshot;
    },

    async pull() {
      saveCloudMeta({ status: 'syncing', lastError: '' });
      const remote = await this.fetchRemote();
      if (!remote.exists || !remote.row) {
        saveCloudMeta({ status: 'empty_cloud', lastError: '' });
        return { ok: true, empty: true };
      }
      this.applyRemotePayload(remote.row);
      return { ok: true, empty: false, updated_at: remote.row.updated_at };
    },

    async syncSmart(options = {}) {
      if (!navigator.onLine) {
        saveCloudMeta({ status: 'offline', lastError: '' });
        return { ok: false, offline: true };
      }

      const remote = await this.fetchRemote();
      const meta = getCloudMeta();
      const hasLocal = hasMeaningfulLocalData();
      const hasRemote = !!(remote.exists && remote.row);
      const strategy = getSettings().cloudSyncStrategy || 'ask';

      if (!hasRemote) {
        if (!hasLocal) {
          saveCloudMeta({ status: 'idle', pendingChanges: false, lastError: '' });
          return { ok: true, empty: true };
        }
        return this.push({ force: true });
      }

      if (!hasLocal) {
        return this.pull();
      }

      if (!meta.lastKnownCloudUpdatedAt) {
        const localUpdatedAt = new Date(meta.localUpdatedAt || 0).getTime();
        const remoteUpdatedAt = new Date(remote.row.updated_at || 0).getTime();
        if (strategy === 'prefer-cloud' || remoteUpdatedAt > localUpdatedAt) {
          return this.pull();
        }
        return this.push({ force: true });
      }

      if (meta.pendingChanges) {
        return this.push({ force: false });
      }

      if (remote.row.updated_at && remote.row.updated_at !== meta.lastKnownCloudUpdatedAt) {
        return this.pull();
      }

      saveCloudMeta({ status: 'synced', lastError: '' });
      return { ok: true, noop: true };
    },
  };

  // --- SETTINGS ---
  function getSettings() {
    return _get(KEYS.settings) || {
      theme: 'dark',
      currency: 'R$',
      sortByCategory: true,
      showSuggestions: true,
      lowStockAlert: true,
      lowStockThreshold: 2,
      autoAddLowStockToList: true,
      useIdealStockSuggestions: true,
      monthlyBudget: 0,
      enableBrowserNotifications: false,
      autoCategorizeProducts: true,
      smartPredictionEnabled: true,
      budgetAlertPercent: 90,
      expiryAlert: true,
      listSortMode: 'default',
      cloudAutoSync: true,
      cloudSyncStrategy: 'ask',
      cloudProfileName: '',
      cloudWorkspaceId: '',
      authRememberSession: true,
    };
  }

  function saveSettings(settings) {
    return _set(KEYS.settings, settings);
  }

  // --- CATEGORIAS ---
  function getCategories() {
    const cats = _get(KEYS.categories);
    if (cats && cats.length > 0) return cats;
    // Categorias padrão
    return [
      { id: 'c1', name: 'Alimentos', emoji: '🍎', color: '#ef5350' },
      { id: 'c2', name: 'Bebidas',   emoji: '🥤', color: '#42a5f5' },
      { id: 'c3', name: 'Laticínios', emoji: '🥛', color: '#ffca28' },
      { id: 'c4', name: 'Carnes',    emoji: '🥩', color: '#ef9a9a' },
      { id: 'c5', name: 'Limpeza',   emoji: '🧹', color: '#66bb6a' },
      { id: 'c6', name: 'Higiene',   emoji: '🧴', color: '#ab47bc' },
      { id: 'c7', name: 'Hortifruti', emoji: '🥦', color: '#26a69a' },
      { id: 'c8', name: 'Padaria',   emoji: '🍞', color: '#ffa726' },
      { id: 'c9', name: 'Congelados', emoji: '🧊', color: '#29b6f6' },
      { id: 'c10', name: 'Outros',   emoji: '🛍️', color: '#9e9e9e' },
    ];
  }

  function saveCategories(cats) {
    return _set(KEYS.categories, cats);
  }

  function addCategory(cat) {
    const cats = getCategories();
    cat.id = 'c' + Date.now();
    cats.push(cat);
    return saveCategories(cats);
  }

  function deleteCategory(id) {
    let cats = getCategories();
    cats = cats.filter(c => c.id !== id);
    return saveCategories(cats);
  }

  // --- LISTA ATUAL ---
  function getCurrentList() {
    return _get(KEYS.currentList) || {
      id: null,
      name: 'Nova Lista',
      createdAt: new Date().toISOString(),
      items: [],
    };
  }

  function saveCurrentList(list) {
    if (!list.id) list.id = 'list_' + Date.now();
    return _set(KEYS.currentList, list);
  }

  function addItemToList(item) {
    const list = getCurrentList();
    item.id = 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    item.addedAt = new Date().toISOString();
    item.checked = false;
    list.items.push(item);
    saveCurrentList(list);
    return item;
  }

  function updateItemInList(itemId, updates) {
    const list = getCurrentList();
    const idx = list.items.findIndex(i => i.id === itemId);
    if (idx === -1) return false;
    list.items[idx] = { ...list.items[idx], ...updates };
    return saveCurrentList(list);
  }

  function removeItemFromList(itemId) {
    const list = getCurrentList();
    list.items = list.items.filter(i => i.id !== itemId);
    return saveCurrentList(list);
  }

  function toggleItemCheck(itemId) {
    const list = getCurrentList();
    const item = list.items.find(i => i.id === itemId);
    if (!item) return false;
    item.checked = !item.checked;
    return saveCurrentList(list);
  }

  function clearCurrentList() {
    const newList = {
      id: 'list_' + Date.now(),
      name: 'Nova Lista',
      createdAt: new Date().toISOString(),
      items: [],
    };
    return _set(KEYS.currentList, newList);
  }

  // --- COMPRAS FINALIZADAS ---
  function getPurchases() {
    return _get(KEYS.purchases) || [];
  }

  function savePurchase(purchase) {
    const purchases = getPurchases();
    if (!purchase.id) purchase.id = 'pur_' + Date.now();
    if (!purchase.finalizedAt) purchase.finalizedAt = new Date().toISOString();
    purchases.unshift(purchase); // mais recente primeiro
    _set(KEYS.purchases, purchases);
    return purchase;
  }

  function deletePurchase(id) {
    let purchases = getPurchases();
    purchases = purchases.filter(p => p.id !== id);
    return _set(KEYS.purchases, purchases);
  }

  function getPurchaseById(id) {
    return getPurchases().find(p => p.id === id) || null;
  }

  // --- HISTÓRICO DE PREÇOS ---
  function getPriceHistory() {
    return _get(KEYS.priceHistory) || {};
  }

  function recordPrice(productName, price, market) {
    if (!productName || !price || price <= 0) return;
    const history = getPriceHistory();
    const key = productName.toLowerCase().trim();
    if (!history[key]) history[key] = [];
    history[key].push({
      price: parseFloat(price),
      market: market || '',
      date: new Date().toISOString(),
    });
    // Manter apenas os últimos 20 registros por produto
    if (history[key].length > 20) history[key] = history[key].slice(-20);
    _set(KEYS.priceHistory, history);
  }

  function getProductPriceHistory(productName) {
    const history = getPriceHistory();
    const key = productName.toLowerCase().trim();
    return history[key] || [];
  }

  function getAveragePrice(productName) {
    const hist = getProductPriceHistory(productName);
    if (hist.length === 0) return null;
    const sum = hist.reduce((a, b) => a + b.price, 0);
    return sum / hist.length;
  }

  function getLastPrice(productName) {
    const hist = getProductPriceHistory(productName);
    return hist.length > 0 ? hist[hist.length - 1].price : null;
  }

  // --- HISTÓRICO DE PRODUTOS (frequência) ---
  function getProductHistory() {
    return _get(KEYS.productHistory) || {};
  }

  function recordProductUsage(productName, categoryId) {
    if (!productName) return;
    const history = getProductHistory();
    const key = productName.toLowerCase().trim();
    if (!history[key]) {
      history[key] = {
        name: productName,
        categoryId: categoryId,
        count: 0,
        lastUsed: null,
      };
    }
    history[key].count++;
    history[key].lastUsed = new Date().toISOString();
    if (categoryId) history[key].categoryId = categoryId;
    _set(KEYS.productHistory, history);
  }

  function getFrequentProducts(limit = 20) {
    const history = getProductHistory();
    return Object.values(history)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  function autoDetectCategoryId(productName) {
    const name = (productName || '').toLowerCase().trim();
    if (!name) return 'c10';
    const categories = getCategories();
    const matchByName = (keywordList, fallbackName) => {
      if (!keywordList.some(k => name.includes(k))) return null;
      const cat = categories.find(c => (c.name || '').toLowerCase().includes(fallbackName));
      return cat ? cat.id : null;
    };

    return (
      matchByName(['arroz','feij','macarr','farinha','açucar','acucar','sal','óleo','oleo','azeite','molho','biscoito','bolacha','cereal'], 'alimento') ||
      matchByName(['agua','água','refrigerante','suco','cafe','café','chá','cha'], 'bebida') ||
      matchByName(['leite','queijo','iogurte','manteiga','requeijão','requeijao'], 'latic') ||
      matchByName(['carne','frango','peixe','linguiça','linguica','bacon'], 'carne') ||
      matchByName(['detergente','sabão','sabao','amaciante','desinfetante','agua sanit','água sanit','esponja'], 'limpeza') ||
      matchByName(['sabonete','shampoo','condicionador','pasta de dente','escova','papel higi','desodorante'], 'higiene') ||
      matchByName(['banana','maçã','maca','tomate','alface','cebola','batata','cenoura','fruta','verdura','legume'], 'horti') ||
      matchByName(['pão','pao','bolo','rosca'], 'padaria') ||
      matchByName(['congelad','lasanha','pizza'], 'congelado') ||
      'c10'
    );
  }

  function resolveProductByBarcode(barcode) {
    const code = String(barcode || '').trim();
    if (!code) return null;

    const stockMatch = getStock().find(item => String(item.barcode || '').trim() === code);
    if (stockMatch) {
      return {
        name: stockMatch.name,
        categoryId: stockMatch.categoryId || 'c10',
        unit: stockMatch.unit || 'un',
        barcode: code,
      };
    }

    const purchases = getPurchases();
    for (const purchase of purchases) {
      for (const item of (purchase.items || [])) {
        if (String(item.barcode || '').trim() === code) {
          return {
            name: item.name,
            categoryId: item.categoryId || 'c10',
            price: item.price || 0,
            barcode: code,
          };
        }
      }
    }

    return null;
  }

  function getPredictedRestocks(limit = 6) {
    const purchases = getPurchases();
    const stock = getStock();
    const map = {};

    purchases.forEach(purchase => {
      (purchase.items || []).forEach(item => {
        const key = (item.name || '').toLowerCase().trim();
        if (!key) return;
        if (!map[key]) {
          map[key] = {
            name: item.name,
            categoryId: item.categoryId || 'c10',
            occurrences: [],
            totalQty: 0,
            count: 0,
          };
        }
        map[key].occurrences.push(new Date(purchase.finalizedAt).getTime());
        map[key].totalQty += parseFloat(item.qty) || 0;
        map[key].count += 1;
      });
    });

    const results = [];
    Object.values(map).forEach(entry => {
      if (entry.occurrences.length < 2) return;
      entry.occurrences.sort((a, b) => a - b);
      let intervalSum = 0;
      for (let i = 1; i < entry.occurrences.length; i++) {
        intervalSum += (entry.occurrences[i] - entry.occurrences[i - 1]) / 86400000;
      }
      const avgDays = intervalSum / (entry.occurrences.length - 1);
      if (!isFinite(avgDays) || avgDays <= 0) return;

      const lastDate = entry.occurrences[entry.occurrences.length - 1];
      const nextDue = lastDate + (avgDays * 86400000);
      const daysUntil = Math.round((nextDue - Date.now()) / 86400000);
      const stockItem = stock.find(s => (s.name || '').toLowerCase().trim() === entry.name.toLowerCase().trim());
      const currentQty = Math.max(0, parseFloat(stockItem?.qty) || 0);
      const idealQty = Math.max(0, parseFloat(stockItem?.idealQty) || 0);
      const suggestedQty = stockItem ? getSuggestedRestockQty(stockItem) : Math.max(1, Math.round(entry.totalQty / entry.count));

      if (daysUntil <= 7 || currentQty <= 0 || (idealQty > 0 && currentQty < idealQty)) {
        results.push({
          name: entry.name,
          categoryId: entry.categoryId,
          avgDays: Math.round(avgDays),
          daysUntil,
          currentQty,
          suggestedQty,
          nextDueAt: new Date(nextDue).toISOString(),
        });
      }
    });

    return results.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, limit);
  }

  function getBudgetStatus(purchases = getMonthlyStats(0).purchases) {
    const settings = getSettings();
    const budget = Math.max(0, parseFloat(settings.monthlyBudget) || 0);
    const spent = (purchases || []).reduce((s, p) => s + (p.total || 0), 0);
    const remaining = Math.max(0, budget - spent);
    const pct = budget > 0 ? Math.min(999, (spent / budget) * 100) : 0;
    const overBudget = budget > 0 && spent > budget;
    const alertPercent = Math.max(1, parseFloat(settings.budgetAlertPercent) || 90);
    return { budget, spent, remaining, pct, overBudget, isNearLimit: budget > 0 && pct >= alertPercent };
  }

  function getMarketStats(purchases = getPurchases()) {
    const marketMap = {};
    purchases.forEach(p => {
      const market = (p.market || 'Sem mercado').trim();
      if (!marketMap[market]) marketMap[market] = { market, total: 0, count: 0, avg: 0 };
      marketMap[market].total += p.total || 0;
      marketMap[market].count += 1;
    });

    const stats = Object.values(marketMap).map(row => ({
      ...row,
      avg: row.count > 0 ? row.total / row.count : 0,
    })).sort((a, b) => b.total - a.total);

    const productMarkets = {};
    purchases.forEach(p => {
      const market = (p.market || 'Sem mercado').trim();
      (p.items || []).forEach(item => {
        const key = (item.name || '').toLowerCase().trim();
        if (!key || !item.price) return;
        if (!productMarkets[key]) productMarkets[key] = { name: item.name, best: null };
        if (!productMarkets[key].best || item.price < productMarkets[key].best.price) {
          productMarkets[key].best = { market, price: item.price };
        }
      });
    });

    return {
      markets: stats,
      bestByProduct: Object.values(productMarkets).slice(0, 20),
    };
  }

  function getSuggestions(currentItems, limit = 8) {
    const frequent = getFrequentProducts(50);
    const currentNames = currentItems.map(i => i.name.toLowerCase().trim());
    return frequent
      .filter(p => !currentNames.includes(p.name.toLowerCase().trim()))
      .slice(0, limit);
  }

  // --- ESTOQUE ---
  function getStock() {
    return _get(KEYS.stock) || [];
  }

  function saveStock(stock) {
    return _set(KEYS.stock, stock);
  }

  function addStockItem(item) {
    const stock = getStock();
    const itemName = (item.name || '').toLowerCase().trim();
    const existing = stock.find(s => s.name && s.name.toLowerCase().trim() === itemName);

    if (existing) {
      existing.qty = (parseFloat(existing.qty) || 0) + (parseFloat(item.qty) || 0);
      existing.categoryId = item.categoryId || existing.categoryId || 'c10';
      existing.unit = item.unit || existing.unit || 'un';
      existing.barcode = item.barcode || existing.barcode || '';
      existing.threshold = parseFloat(item.threshold) || parseFloat(existing.threshold) || 2;
      existing.idealQty = parseFloat(item.idealQty) || parseFloat(existing.idealQty) || Math.max((parseFloat(existing.threshold) || 2) + 2, 4);
      existing.updatedAt = new Date().toISOString();
      saveStock(stock);
      return { merged: true, item: existing };
    }

    item.id = 'stk_' + Date.now();
    item.barcode = item.barcode || '';
    item.idealQty = parseFloat(item.idealQty) || Math.max((parseFloat(item.threshold) || 2) + 2, 4);
    item.updatedAt = new Date().toISOString();
    stock.push(item);
    saveStock(stock);
    return { merged: false, item };
  }

  function updateStockItem(id, updates) {
    const stock = getStock();
    const idx = stock.findIndex(s => s.id === id);
    if (idx === -1) return false;
    stock[idx] = { ...stock[idx], ...updates, updatedAt: new Date().toISOString() };
    return saveStock(stock);
  }

  function deleteStockItem(id) {
    let stock = getStock();
    stock = stock.filter(s => s.id !== id);
    return saveStock(stock);
  }

  function getSuggestedRestockQty(stockItem) {
    if (!stockItem) return 1;
    const settings = getSettings();
    const currentQty = Math.max(0, parseFloat(stockItem.qty) || 0);
    const threshold = Math.max(0, parseFloat(stockItem.threshold) || 2);
    const idealQty = Math.max(0, parseFloat(stockItem.idealQty) || 0);

    if (settings.useIdealStockSuggestions !== false && idealQty > currentQty) {
      return Math.max(1, idealQty - currentQty);
    }
    return Math.max(1, threshold + 1 - currentQty);
  }

  function ensureItemInCurrentListFromStock(stockItem, suggestedQty = null) {
    if (!stockItem || !stockItem.name) return false;

    const list = getCurrentList();
    const existing = (list.items || []).find(i =>
      i.name && i.name.toLowerCase().trim() === stockItem.name.toLowerCase().trim()
    );

    if (existing) return false;

    const qtyToBuy = Math.max(1, parseFloat(suggestedQty ?? getSuggestedRestockQty(stockItem)) || 1);
    list.items.push({
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: stockItem.name,
      qty: qtyToBuy,
      price: 0,
      note: 'Adicionado automaticamente pelo estoque baixo',
      categoryId: stockItem.categoryId || 'c10',
      checked: false,
      barcode: stockItem.barcode || '',
      autoAddedFromStock: true,
      addedAt: new Date().toISOString(),
    });

    return saveCurrentList(list);
  }

  function incrementStockByPurchase(items) {
    const stock = getStock();

    items.forEach(item => {
      if (!item || !item.name) return;

      const qtyToAdd = Math.max(0, parseFloat(item.qty) || 0);
      if (qtyToAdd <= 0) return;

      const match = stock.find(s => s.name && s.name.toLowerCase().trim() === item.name.toLowerCase().trim());
      if (match) {
        match.qty = (parseFloat(match.qty) || 0) + qtyToAdd;
        if ((!match.categoryId || match.categoryId === 'c10') && item.categoryId) match.categoryId = item.categoryId;
        if ((!match.unit || match.unit === 'un') && item.unit) match.unit = item.unit;
        if (!match.barcode && item.barcode) match.barcode = item.barcode;
        if (!match.threshold) match.threshold = 2;
        if (!match.idealQty) match.idealQty = Math.max((parseFloat(match.threshold) || 2) + 2, 4);
        match.updatedAt = new Date().toISOString();
      } else {
        stock.push({
          id: 'stk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          name: item.name,
          qty: qtyToAdd,
          categoryId: item.categoryId || 'c10',
          unit: item.unit || 'un',
          barcode: item.barcode || '',
          threshold: 2,
          idealQty: 4,
          updatedAt: new Date().toISOString(),
        });
      }
    });

    return saveStock(stock);
  }

  function decrementStockByPurchase(items, options = {}) {
    const stock = getStock();
    const settings = getSettings();
    const shouldAutoAddToList = options.autoAddToList !== false && settings.autoAddLowStockToList !== false;

    items.forEach(item => {
      if (!item || !item.name) return;

      const match = stock.find(s => s.name && s.name.toLowerCase().trim() === item.name.toLowerCase().trim());
      if (!match) return;

      match.qty = Math.max(0, (parseFloat(match.qty) || 0) - (parseFloat(item.qty) || 1));
      match.updatedAt = new Date().toISOString();

      const threshold = parseFloat(match.threshold) || 2;
      if (shouldAutoAddToList && match.qty <= threshold) {
        const suggestedQty = getSuggestedRestockQty(match);
        ensureItemInCurrentListFromStock(match, suggestedQty);
      }
    });

    return saveStock(stock);
  }

  // --- ANALYTICS ---
  function getMonthlyStats(monthsBack = 0) {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    const y = target.getFullYear();
    const m = target.getMonth();

    const purchases = getPurchases().filter(p => {
      const d = new Date(p.finalizedAt);
      return d.getFullYear() === y && d.getMonth() === m;
    });

    const total = purchases.reduce((s, p) => s + (p.total || 0), 0);
    return { purchases, total, count: purchases.length, year: y, month: m };
  }

  function getCategoryStats(purchases) {
    const stats = {};
    purchases.forEach(p => {
      (p.items || []).forEach(item => {
        const cat = item.categoryId || 'c10';
        if (!stats[cat]) stats[cat] = 0;
        stats[cat] += item.qty * item.price;
      });
    });
    return stats;
  }

  function getTopProducts(purchases, limit = 5) {
    const map = {};
    purchases.forEach(p => {
      (p.items || []).forEach(item => {
        const key = item.name.toLowerCase().trim();
        if (!map[key]) map[key] = { name: item.name, count: 0, totalSpent: 0, avgPrice: 0 };
        map[key].count += item.qty;
        map[key].totalSpent += item.qty * item.price;
      });
    });
    const arr = Object.values(map);
    arr.forEach(p => p.avgPrice = p.totalSpent / p.count);
    return arr.sort((a, b) => b.count - a.count).slice(0, limit);
  }

  function getPriceVariations() {
    const history = getPriceHistory();
    const results = [];
    Object.entries(history).forEach(([key, entries]) => {
      if (entries.length < 2) return;
      const last = entries[entries.length - 1];
      const prev = entries[entries.length - 2];
      const diff = last.price - prev.price;
      const pct = ((diff / prev.price) * 100).toFixed(1);
      results.push({
        name: entries[entries.length - 1] && history[key]?.[0]?.name || key,
        oldPrice: prev.price,
        newPrice: last.price,
        diff,
        pct: parseFloat(pct),
        direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same',
      });
    });
    return results.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  }

  // --- BACKUP COMPLETO ---
  function exportAllData() {
    return {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      settings: getSettings(),
      categories: getCategories(),
      currentList: getCurrentList(),
      purchases: getPurchases(),
      stock: getStock(),
      priceHistory: getPriceHistory(),
      productHistory: getProductHistory(),
      cloudProfile: getCloudProfile(),
      cloudMeta: getCloudMeta(),
    };
  }

  function importAllData(data) {
    if (!data || !data.version) throw new Error('Arquivo de backup inválido');
    if (data.settings) saveSettings(data.settings);
    if (data.categories) saveCategories(data.categories);
    if (data.currentList) saveCurrentList(data.currentList);
    if (data.purchases) _set(KEYS.purchases, data.purchases);
    if (data.stock) saveStock(data.stock);
    if (data.priceHistory) _set(KEYS.priceHistory, data.priceHistory);
    if (data.productHistory) _set(KEYS.productHistory, data.productHistory);
    if (data.cloudProfile) _set(KEYS.cloudProfile, data.cloudProfile, { skipCloudMeta: true });
    if (data.cloudMeta) _set(KEYS.cloudMeta, data.cloudMeta, { skipCloudMeta: true });
    return true;
  }

  function resetAllData(options = {}) {
    const preserveSuggestions = options.preserveSuggestions !== false;
    const preservedProductHistory = preserveSuggestions ? getProductHistory() : null;

    Object.values(KEYS).forEach(k => {
      if (preserveSuggestions && k === KEYS.productHistory) return;
      _remove(k);
    });

    if (preserveSuggestions && preservedProductHistory && Object.keys(preservedProductHistory).length > 0) {
      _set(KEYS.productHistory, preservedProductHistory);
    }
  }

  // --- HELPERS ANALYTICS ---
  function getLast6MonthsData() {
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const y = d.getFullYear();
      const m = d.getMonth();
      const monthPurchases = getPurchases().filter(p => {
        const pd = new Date(p.finalizedAt);
        return pd.getFullYear() === y && pd.getMonth() === m;
      });
      const total = monthPurchases.reduce((s, p) => s + (p.total || 0), 0);
      result.push({
        label: d.toLocaleString('pt-BR', { month: 'short' }),
        total,
        count: monthPurchases.length,
      });
    }
    return result;
  }

  return {
    // Settings
    getSettings, saveSettings,
    // Categories
    getCategories, saveCategories, addCategory, deleteCategory,
    // Current list
    getCurrentList, saveCurrentList, addItemToList, updateItemInList,
    removeItemFromList, toggleItemCheck, clearCurrentList,
    // Purchases
    getPurchases, savePurchase, deletePurchase, getPurchaseById,
    // Price history
    getPriceHistory, recordPrice, getProductPriceHistory,
    getAveragePrice, getLastPrice,
    // Product history
    getProductHistory, recordProductUsage, getFrequentProducts, getSuggestions, autoDetectCategoryId, resolveProductByBarcode, getPredictedRestocks, getBudgetStatus, getMarketStats,
    // Stock
    getStock, saveStock, addStockItem, updateStockItem, deleteStockItem,
    incrementStockByPurchase, decrementStockByPurchase, ensureItemInCurrentListFromStock, getSuggestedRestockQty,
    // Analytics
    getMonthlyStats, getCategoryStats, getTopProducts, getPriceVariations,
    getLast6MonthsData,
    // Workspace
    getWorkspace, setWorkspace,
    // Cloud
    getCloudProfile, saveCloudProfile, getCloudMeta, saveCloudMeta, CloudSync,
    // Backup
    exportAllData, importAllData, resetAllData,
  };
})();
