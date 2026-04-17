/* ==========================================
   MERCADOSMART - HISTÓRICO DE COMPRAS
   ========================================== */

let historyMonthOffset = null; // null = todos

function renderHistory() {
  const purchases = getFilteredPurchases();
  const container = document.getElementById('historyList');
  if (!container) return;

  updateHistoryMonthLabel();

  if (purchases.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>Nenhuma compra encontrada</p>
        <p class="empty-sub">Finalize uma lista para ver o histórico</p>
      </div>
    `;
    return;
  }

  const cur = DB.getSettings().currency || 'R$';

  container.innerHTML = purchases.map(p => renderHistoryItem(p, cur)).join('');
  container.classList.add('stagger-children');
  setTimeout(() => container.classList.remove('stagger-children'), 600);
}

function getFilteredPurchases() {
  const search = (document.getElementById('historySearch')?.value || '').toLowerCase();
  let purchases = DB.getPurchases();

  if (historyMonthOffset !== null) {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() - historyMonthOffset, 1);
    const y = target.getFullYear(), m = target.getMonth();
    purchases = purchases.filter(p => {
      const d = new Date(p.finalizedAt);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }

  if (search) {
    purchases = purchases.filter(p =>
      (p.name || '').toLowerCase().includes(search) ||
      (p.market || '').toLowerCase().includes(search) ||
      (p.items || []).some(i => i.name.toLowerCase().includes(search))
    );
  }

  return purchases;
}

function renderHistoryItem(p, cur) {
  const itemCount = (p.items || []).length;
  const checkedCount = p.checkedCount || 0;
  const date = formatDate(p.finalizedAt);
  const relative = formatDateRelative(p.finalizedAt);

  return `
    <div class="history-item" onclick="openPurchaseDetail('${p.id}')">
      <div class="hi-header">
        <div>
          <div class="hi-name">${escapeHtml(p.name || 'Compra')}</div>
          <div class="hi-date">${relative} · ${date}</div>
          ${p.market ? `<div class="hi-market">📍 ${escapeHtml(p.market)}</div>` : ''}
        </div>
        <div class="hi-total">${formatCurrency(p.total, cur)}</div>
      </div>
      <div class="hi-stats">
        <span class="hi-stat"><strong>${itemCount}</strong> itens</span>
        ${checkedCount > 0 ? `<span class="hi-stat"><strong>${checkedCount}</strong> marcados</span>` : ''}
        <span class="hi-stat">Média: <strong>${formatCurrency(itemCount > 0 ? p.total / itemCount : 0, cur)}</strong>/item</span>
      </div>
      <div class="hi-actions">
        <button class="hi-act-btn" onclick="event.stopPropagation(); reuseList('${p.id}')">🔄 Reutilizar</button>
        <button class="hi-act-btn" onclick="event.stopPropagation(); duplicateList('${p.id}')">📋 Duplicar</button>
        <button class="hi-act-btn" onclick="event.stopPropagation(); confirmDeletePurchase('${p.id}')">🗑️</button>
      </div>
    </div>
  `;
}

function openPurchaseDetail(id) {
  const purchase = DB.getPurchaseById(id);
  if (!purchase) return;

  const cur = DB.getSettings().currency || 'R$';
  const categories = DB.getCategories();

  document.getElementById('modalPurchaseTitle').textContent = purchase.name || 'Compra';

  const itemsHtml = (purchase.items || []).map(item => {
    const cat = categories.find(c => c.id === item.categoryId) || { emoji: '🛍️' };
    return `
      <div class="pd-item">
        <span>${cat.emoji}</span>
        <div class="pd-item-name">${escapeHtml(item.name)}</div>
        <span class="pd-item-qty">${item.qty}x</span>
        <span class="pd-item-price">${formatCurrency(item.price * item.qty, cur)}</span>
      </div>
    `;
  }).join('');

  document.getElementById('modalPurchaseBody').innerHTML = `
    <div class="purchase-detail-header">
      <div>
        <div style="font-size:13px;color:var(--text-muted)">${formatDate(purchase.finalizedAt)}</div>
        ${purchase.market ? `<div style="font-size:12px;color:var(--text-secondary)">📍 ${escapeHtml(purchase.market)}</div>` : ''}
      </div>
      <div class="pd-total">${formatCurrency(purchase.total, cur)}</div>
    </div>
    <div class="pd-items-list">${itemsHtml}</div>
    <div class="pd-actions">
      <button class="btn-full primary" onclick="reuseList('${purchase.id}'); closeModal('modalPurchaseDetail')">🔄 Reutilizar</button>
      <button class="btn-full secondary" onclick="duplicateList('${purchase.id}'); closeModal('modalPurchaseDetail')">📋 Duplicar</button>
    </div>
  `;

  openModal('modalPurchaseDetail');
}

function reuseList(purchaseId) {
  const purchase = DB.getPurchaseById(purchaseId);
  if (!purchase) return;

  confirmAction('Reutilizar Lista', 'A lista atual será substituída pelos itens desta compra. Continuar?', () => {
    const newList = {
      id: 'list_' + Date.now(),
      name: purchase.name || 'Lista Reutilizada',
      createdAt: new Date().toISOString(),
      items: (purchase.items || []).map(item => ({
        ...item,
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2,5),
        checked: false,
        addedAt: new Date().toISOString(),
        // Usar preço médio atualizado
        price: DB.getAveragePrice(item.name) || item.price || 0,
      })),
    };
    DB.saveCurrentList(newList);
    showToast('Lista reutilizada com preços atualizados!', 'success');
    switchPage('pageList');
  });
}

function duplicateList(purchaseId) {
  const purchase = DB.getPurchaseById(purchaseId);
  if (!purchase) return;

  const cur = DB.getSettings().currency || 'R$';

  // Salvar como nova compra (cópia)
  const copy = {
    ...purchase,
    id: undefined, // será gerado novo
    name: `Cópia de ${purchase.name}`,
    finalizedAt: new Date().toISOString(),
  };
  DB.savePurchase(copy);
  showToast('Lista duplicada no histórico!', 'success');
  renderHistory();
}

function confirmDeletePurchase(id) {
  confirmAction('Excluir Compra', 'Esta compra será removida do histórico. Esta ação não pode ser desfeita.', () => {
    DB.deletePurchase(id);
    renderHistory();
    showToast('Compra excluída!', 'info');
  });
}

function filterHistory() { renderHistory(); }

function changeHistoryMonth(delta) {
  if (historyMonthOffset === null) {
    historyMonthOffset = delta < 0 ? 0 : null;
  } else {
    historyMonthOffset += delta;
    if (historyMonthOffset < 0) historyMonthOffset = null;
  }
  renderHistory();
}

function updateHistoryMonthLabel() {
  const el = document.getElementById('historyMonthLabel');
  if (!el) return;
  if (historyMonthOffset === null) {
    el.textContent = 'Todos os meses';
    return;
  }
  const d = new Date();
  d.setMonth(d.getMonth() - historyMonthOffset);
  el.textContent = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
}
