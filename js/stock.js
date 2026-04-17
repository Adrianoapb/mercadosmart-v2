/* ==========================================
   MERCADOSMART - CONTROLE DE ESTOQUE
   ========================================== */

let stockFilter = 'all';

function renderStock() {
  const stock = DB.getStock();
  const settings = DB.getSettings();
  const threshold = settings.lowStockThreshold || 2;
  const container = document.getElementById('stockList');
  const alertBanner = document.getElementById('stockAlertBanner');
  const alertText = document.getElementById('stockAlertText');
  if (!container) return;

  const term = (document.getElementById('stockSearch')?.value || '').toLowerCase().trim();
  const sortMode = document.getElementById('stockSortSelect')?.value || 'updated';
  const now = new Date();
  const inSevenDays = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);

  let filtered = stock.filter(item => {
    const qty = parseFloat(item.qty) || 0;
    const thr = parseFloat(item.threshold) || threshold;
    const exp = item.expiryDate ? new Date(item.expiryDate) : null;
    const expiring = exp && exp <= inSevenDays;

    if (stockFilter === 'low' && !(qty > 0 && qty <= thr)) return false;
    if (stockFilter === 'ok' && !(qty > thr)) return false;
    if (stockFilter === 'out' && !(qty <= 0)) return false;
    if (stockFilter === 'fav' && !item.favorite) return false;
    if (stockFilter === 'expiring' && !expiring) return false;
    if (term) {
      const hay = `${item.name || ''} ${item.note || ''} ${item.brand || ''} ${item.barcode || ''}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sortMode === 'name') return (a.name || '').localeCompare(b.name || '', 'pt-BR');
    if (sortMode === 'qty_asc') return (parseFloat(a.qty) || 0) - (parseFloat(b.qty) || 0);
    if (sortMode === 'qty_desc') return (parseFloat(b.qty) || 0) - (parseFloat(a.qty) || 0);
    if (sortMode === 'expiry') {
      const ad = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    }
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });

  const lowItems = stock.filter(s => {
    const q = parseFloat(s.qty) || 0;
    const t = parseFloat(s.threshold) || threshold;
    return q > 0 && q <= t;
  });
  const outItems = stock.filter(s => (parseFloat(s.qty) || 0) <= 0);
  const expiringCount = stock.filter(s => s.expiryDate && new Date(s.expiryDate) <= inSevenDays).length;
  const problemItems = lowItems.length + outItems.length + expiringCount;

  if (problemItems > 0 && alertBanner) {
    alertBanner.classList.remove('hidden');
    if (alertText) {
      const parts = [];
      if (outItems.length > 0) parts.push(`${outItems.length} esgotado${outItems.length > 1 ? 's' : ''}`);
      if (lowItems.length > 0) parts.push(`${lowItems.length} com estoque baixo`);
      if (expiringCount > 0 && settings.expiryAlert !== false) parts.push(`${expiringCount} vencendo`);
      alertText.textContent = `⚠️ ${parts.join(', ')}!`;
    }
  } else if (alertBanner) {
    alertBanner.classList.add('hidden');
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <p>${stockFilter === 'all' ? 'Estoque vazio' : 'Nenhum item neste filtro'}</p>
        <p class="empty-sub">Use a busca, altere o filtro ou adicione novos produtos</p>
      </div>
    `;
    return;
  }

  const categories = DB.getCategories();
  container.innerHTML = filtered.map(item => renderStockItem(item, categories, threshold)).join('');
}


function renderStockItem(item, categories, threshold) {
  const cat = categories.find(c => c.id === item.categoryId) || { emoji: "🛍️", name: "Outros" };
  const qty = parseFloat(item.qty) || 0;
  const thr = parseFloat(item.threshold) || threshold;
  const idealQty = Math.max(0, parseFloat(item.idealQty) || 0);
  const restockQty = Math.max(0, typeof DB.getSuggestedRestockQty === 'function'
    ? DB.getSuggestedRestockQty(item)
    : Math.max(1, thr + 1 - qty));

  let status, statusClass, badgeClass;
  if (qty <= 0) { status = 'Esgotado'; statusClass = 'status-out'; badgeClass = 'badge-out'; }
  else if (qty <= thr) { status = 'Baixo'; statusClass = 'status-low'; badgeClass = 'badge-low'; }
  else { status = 'OK'; statusClass = 'status-ok'; badgeClass = 'badge-ok'; }

  const qtyDisplay = qty % 1 === 0 ? parseInt(qty) : qty.toFixed(1);
  const idealDisplay = idealQty % 1 === 0 ? parseInt(idealQty || 0) : idealQty.toFixed(1);
  const restockDisplay = restockQty % 1 === 0 ? parseInt(restockQty) : restockQty.toFixed(1);
  const avgPrice = DB.getAveragePrice(item.name);
  const lastPrice = DB.getLastPrice(item.name);
  const lastPurchase = DB.getPurchases().find(p => (p.items || []).some(pi => (pi.name || '').toLowerCase().trim() === (item.name || '').toLowerCase().trim()));
  const expDate = item.expiryDate ? new Date(item.expiryDate) : null;
  const daysToExpire = expDate ? Math.ceil((expDate - new Date()) / 86400000) : null;
  const expiryLabel = !expDate ? '' : (daysToExpire < 0 ? 'Vencido' : daysToExpire === 0 ? 'Vence hoje' : daysToExpire <= 7 ? `Vence em ${daysToExpire} dia(s)` : `Validade ${formatDate(item.expiryDate)}`);

  return `
    <div class="stock-item compact-fixed premium-stock-card ${qty <= thr ? 'stock-warning' : ''} ${daysToExpire !== null && daysToExpire <= 7 ? 'stock-expiring' : ''}">
      <div class="premium-stock-top">
        <div class="premium-stock-main">
          <div class="premium-stock-title-wrap">
            <span class="stock-status-dot ${statusClass}" title="${status}"></span>
            <div class="premium-stock-titles">
              <div class="premium-stock-name-row">
                <div class="stock-name">${escapeHtml(item.name)}</div>
                ${item.favorite ? '<span class="premium-fav-star" aria-label="Favorito">⭐</span>' : ''}
              </div>
              <div class="premium-stock-subline">${cat.emoji} ${cat.name}${item.brand ? ' · ' + escapeHtml(item.brand) : ''}</div>
            </div>
          </div>
          <span class="stock-status-badge ${badgeClass}">${status}</span>
        </div>

        <div class="premium-stock-side">
          <div class="premium-qty-control" aria-label="Controle de quantidade">
            <button type="button" class="qty-mini-btn premium-qty-btn" onclick="changeStockQty('${item.id}', -1)" aria-label="Diminuir quantidade">−</button>
            <div class="premium-qty-box">
              <div class="stock-qty-val">${qtyDisplay}</div>
              <div class="stock-unit-lbl">${item.unit || 'un'}</div>
            </div>
            <button type="button" class="qty-mini-btn premium-qty-btn" onclick="changeStockQty('${item.id}', 1)" aria-label="Aumentar quantidade">+</button>
          </div>

          <div class="premium-stock-actions premium-stock-actions-inline">
            <button type="button" class="premium-action-btn" onclick="addStockItemToShoppingList('${item.id}')" title="Adicionar à lista" aria-label="Adicionar item à lista">🛒</button>
            <button type="button" class="premium-action-btn" onclick="toggleStockFavorite('${item.id}')" title="Favorito" aria-label="Favorito">${item.favorite ? '⭐' : '☆'}</button>
            <button type="button" class="premium-action-btn" onclick="deleteStockItemConfirm('${item.id}')" title="Deletar" aria-label="Deletar item">🗑️</button>
            <button type="button" class="premium-action-btn" onclick="duplicateStockItem('${item.id}')" title="Duplicar" aria-label="Duplicar item">⧉</button>
            <button type="button" class="premium-action-btn" onclick="openEditStockModal('${item.id}')" title="Editar" aria-label="Editar item">⚙️</button>
          </div>
        </div>
      </div>

      <div class="premium-stock-chips">
        <span class="premium-chip"><strong>Meta</strong><em>${idealDisplay} ${item.unit || 'un'}</em></span>
        <span class="premium-chip"><strong>Repor</strong><em>${restockDisplay} ${item.unit || 'un'}</em></span>
        ${lastPrice ? `<span class="premium-chip"><strong>Último</strong><em>${formatCurrency(lastPrice)}</em></span>` : ''}
        ${avgPrice ? `<span class="premium-chip"><strong>Médio</strong><em>${formatCurrency(avgPrice)}</em></span>` : ''}
        ${lastPurchase ? `<span class="premium-chip"><strong>Compra</strong><em>${formatDate(lastPurchase.finalizedAt)}</em></span>` : ''}
        ${expiryLabel ? `<span class="premium-chip expiry-pill ${daysToExpire !== null && daysToExpire <= 7 ? 'danger' : ''}"><strong>Validade</strong><em>${expiryLabel}</em></span>` : ''}
      </div>
      ${item.note || item.barcode ? `
        <div class="premium-stock-footer">
          ${item.note ? `<span class="premium-footer-text">📝 ${escapeHtml(item.note)}</span>` : ''}
          ${item.barcode ? `<span class="premium-footer-text mono">${escapeHtml(item.barcode)}</span>` : ''}
        </div>
      ` : ''}
    </div>
  `;
}


function toggleStockFavorite(id) {
  const stock = DB.getStock();
  const item = stock.find(s => s.id === id);
  if (!item) return;
  DB.updateStockItem(id, { favorite: !item.favorite });
  renderStock();
}

function duplicateStockItem(id) {
  const stock = DB.getStock();
  const item = stock.find(s => s.id === id);
  if (!item) return;
  const copy = { ...item, name: `${item.name} (cópia)`, qty: item.qty || 0 };
  delete copy.id;
  DB.addStockItem(copy);
  renderStock();
  showToast('Item duplicado no estoque', 'success');
}

function deleteStockItemConfirm(id) {
  const stock = DB.getStock();
  const item = stock.find(s => s.id === id);
  if (!item) return;

  const confirmed = window.confirm(`Deseja deletar o item "${item.name}" do estoque?`);
  if (!confirmed) return;

  DB.deleteStockItem(id);
  renderStock();
  showToast('Item removido do estoque!', 'success');
}

function changeStockQty(id, delta) {
  const stock = DB.getStock();
  const item = stock.find(s => s.id === id);
  if (!item) return;

  const currentQty = parseFloat(item.qty) || 0;
  const newQty = Math.max(0, currentQty + delta);
  DB.updateStockItem(id, { qty: newQty });

  const settings = DB.getSettings();
  const threshold = parseFloat(item.threshold) || (settings.lowStockThreshold || 2);
  if (delta < 0 && settings.autoAddLowStockToList !== false && typeof DB.ensureItemInCurrentListFromStock === 'function' && newQty <= threshold) {
    const suggestedQty = Math.max(1, threshold + 1 - newQty);
    DB.ensureItemInCurrentListFromStock({ ...item, qty: newQty }, suggestedQty);
    if (newQty <= 0) showToast(`${item.name} acabou e foi sugerido na lista`, 'warning');
  }

  renderStock();
  if (typeof renderShoppingList === 'function') renderShoppingList();
  if (typeof refreshDashboard === 'function') refreshDashboard();

  // Flash animation
  setTimeout(() => {
    const el = document.querySelector(`[onclick="changeStockQty('${id}', ${delta})"]`);
    if (el) { el.classList.add('flash-highlight'); setTimeout(() => el.classList.remove('flash-highlight'), 500); }
  }, 10);
}

function filterStock(filter, btn) {
  stockFilter = filter;
  document.querySelectorAll('.stock-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderStock();
}

function openAddStockModal() {
  document.getElementById('modalStockTitle').textContent = 'Adicionar ao Estoque';
  document.getElementById('stockName').value = '';
  document.getElementById('stockQty').value = 1;
  document.getElementById('stockThreshold').value = 2;
  document.getElementById('stockIdealQty').value = 4;
  document.getElementById('stockBrand').value = '';
  document.getElementById('stockExpiryDate').value = '';
  document.getElementById('stockNote').value = '';
  const bcEl = document.getElementById('stockBarcode');
  if (bcEl) bcEl.value = '';
  document.getElementById('editingStockId').value = '';
  populateCategorySelects();
  openModal('modalStock');
  setTimeout(() => document.getElementById('stockName').focus(), 300);
}

function openEditStockModal(id) {
  const stock = DB.getStock();
  const item = stock.find(s => s.id === id);
  if (!item) return;

  document.getElementById('modalStockTitle').textContent = 'Editar Item';
  document.getElementById('stockName').value = item.name;
  document.getElementById('stockQty').value = item.qty;
  document.getElementById('stockThreshold').value = item.threshold || 2;
  document.getElementById('stockIdealQty').value = item.idealQty || Math.max((parseFloat(item.threshold) || 2) + 2, 4);
  const bcEl = document.getElementById('stockBarcode');
  if (bcEl) bcEl.value = item.barcode || '';
  document.getElementById('stockBrand').value = item.brand || '';
  document.getElementById('stockExpiryDate').value = item.expiryDate || '';
  document.getElementById('stockNote').value = item.note || '';
  document.getElementById('editingStockId').value = id;
  populateCategorySelects();
  document.getElementById('stockCategory').value = item.categoryId || 'c10';
  document.getElementById('stockUnit').value = item.unit || 'un';
  openModal('modalStock');
}

function saveStockItem() {
  const name = document.getElementById('stockName').value.trim();
  const qty = parseFloat(document.getElementById('stockQty').value) || 0;
  const category = document.getElementById('stockCategory').value;
  const unit = document.getElementById('stockUnit').value;
  const threshold = parseFloat(document.getElementById('stockThreshold').value) || 2;
  const idealQty = Math.max(0, parseFloat(document.getElementById('stockIdealQty').value) || Math.max(threshold + 2, 4));
  const barcode = document.getElementById('stockBarcode')?.value.trim() || '';
  const brand = document.getElementById('stockBrand')?.value.trim() || '';
  const expiryDate = document.getElementById('stockExpiryDate')?.value || '';
  const note = document.getElementById('stockNote')?.value.trim() || '';
  const editId = document.getElementById('editingStockId').value;

  if (!name) { showToast('Digite o nome do produto', 'warning'); return; }

  const autoCat = DB.getSettings().autoCategorizeProducts !== false;
  const finalCategory = category || (autoCat ? DB.autoDetectCategoryId(name) : 'c10');
  const data = { name, qty, categoryId: finalCategory, unit, threshold, idealQty, barcode, brand, expiryDate, note };

  if (editId) {
    DB.updateStockItem(editId, data);
    showToast('Item atualizado!', 'success');
  } else {
    DB.addStockItem(data);
    showToast(`${name} adicionado ao estoque!`, 'success');
  }

  closeModal('modalStock');
  renderStock();
  if (typeof refreshDashboard === 'function') refreshDashboard();
}

// Adicionar itens da lista ao estoque após compra (chamado no finalize)
function addPurchaseToStock(items) {
  if (typeof DB.incrementStockByPurchase === 'function') {
    DB.incrementStockByPurchase(items);
    renderStock();
    if (typeof refreshDashboard === 'function') refreshDashboard();
  }
}


function addStockItemToShoppingList(id) {
  const stock = DB.getStock();
  const item = stock.find(s => s.id === id);
  if (!item) return;

  const suggestedQty = typeof DB.getSuggestedRestockQty === 'function'
    ? DB.getSuggestedRestockQty(item)
    : Math.max(1, (parseFloat(item.threshold) || (DB.getSettings().lowStockThreshold || 2)) + 1 - (parseFloat(item.qty) || 0));
  const added = DB.ensureItemInCurrentListFromStock(item, suggestedQty);

  if (!added) {
    showToast('Esse item já está na lista de compras', 'info');
    return;
  }

  if (typeof renderShoppingList === 'function') renderShoppingList();
  showToast('Item enviado para a lista de compras!', 'success');
}


function openBarcodeScannerForStock() {
  if (typeof openBarcodeScanner === 'function') openBarcodeScanner('stock');
}

function applyScannedBarcodeToStock(code, resolved = null) {
  const barcodeEl = document.getElementById('stockBarcode');
  if (barcodeEl) barcodeEl.value = code;
  if (resolved) {
    document.getElementById('stockName').value = resolved.name || document.getElementById('stockName').value;
    if (resolved.categoryId) document.getElementById('stockCategory').value = resolved.categoryId;
    if (resolved.unit) document.getElementById('stockUnit').value = resolved.unit;
  }
}
