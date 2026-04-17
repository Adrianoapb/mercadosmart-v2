/* ==========================================
   MERCADOSMART - DASHBOARD
   ========================================== */

function refreshDashboard() {
  const settings = DB.getSettings();
  const cur = settings.currency || 'R$';
  const now = new Date();

  // Greeting
  const greetEl = document.getElementById('greetingText');
  if (greetEl) greetEl.textContent = getGreeting();

  // Badge do mês
  const monthBadge = document.getElementById('currentMonthBadge');
  if (monthBadge) {
    monthBadge.textContent = now.toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
  }

  // --- Stats do mês atual ---
  const monthStats = DB.getMonthlyStats(0);
  const allPurchases = DB.getPurchases();

  // Total gasto no mês
  const monthSpend = document.getElementById('dashMonthSpend');
  if (monthSpend) {
    monthSpend.textContent = formatCurrency(monthStats.total, cur);
    monthSpend.classList.add('value-updated');
    setTimeout(() => monthSpend.classList.remove('value-updated'), 300);
  }

  // Total de compras
  const totalPurchases = document.getElementById('dashTotalPurchases');
  if (totalPurchases) totalPurchases.textContent = monthStats.count;

  // Estoque baixo
  const stock = DB.getStock();
  const threshold = settings.lowStockThreshold || 2;
  const lowStock = stock.filter(s => (s.qty || 0) <= threshold && (s.qty || 0) > 0);
  const outOfStock = stock.filter(s => (s.qty || 0) === 0);
  const lowStockEl = document.getElementById('dashLowStock');
  if (lowStockEl) {
    const total = lowStock.length + outOfStock.length;
    lowStockEl.textContent = `${total} ${total === 1 ? 'item' : 'itens'}`;
    if (total > 0) lowStockEl.style.color = 'var(--accent-orange)';
    else lowStockEl.style.color = '';
  }

  // Média por compra
  const avgPurchase = document.getElementById('dashAvgPurchase');
  if (avgPurchase) {
    const avg = monthStats.count > 0 ? monthStats.total / monthStats.count : 0;
    avgPurchase.textContent = formatCurrency(avg, cur);
  }

  // --- Última compra ---
  renderLastPurchase(allPurchases[0], cur);

  // --- Gráfico por categoria (mês atual) ---
  const categories = DB.getCategories();
  const catStats = DB.getCategoryStats(monthStats.purchases);
  renderCategoryChart(catStats, categories);

  // --- Gráfico evolução mensal ---
  const monthlyData = DB.getLast6MonthsData();
  renderMonthlyChart(monthlyData);

  // --- Top produtos ---
  const topProducts = DB.getTopProducts(allPurchases, 5);
  renderTopProducts(topProducts, cur);

  // --- Economia do mês ---
  renderSavingsCard(monthStats.purchases, cur);

  // --- Orçamento mensal ---
  renderBudgetCard(monthStats.purchases, cur);

  // --- Reposição inteligente ---
  renderSmartRestock();
}

function renderLastPurchase(purchase, cur) {
  const container = document.getElementById('dashLastPurchase');
  if (!container) return;

  if (!purchase) {
    container.innerHTML = '<div class="empty-mini">Nenhuma compra registrada ainda</div>';
    return;
  }

  const items = purchase.items || [];
  const preview = items.slice(0, 4).map(i => `<span class="lp-item-chip">${escapeHtml(i.name)}</span>`).join('');
  const extra = items.length > 4 ? `<span class="lp-item-chip">+${items.length - 4} mais</span>` : '';

  container.innerHTML = `
    <div class="lp-header">
      <div>
        <div class="lp-name">${escapeHtml(purchase.name || 'Compra')}</div>
        <div class="lp-date">${formatDateRelative(purchase.finalizedAt)}</div>
        ${purchase.market ? `<div class="lp-market">📍 ${escapeHtml(purchase.market)}</div>` : ''}
      </div>
      <div class="lp-total">${formatCurrency(purchase.total, cur)}</div>
    </div>
    <div class="lp-items-preview">${preview}${extra}</div>
  `;
}

function renderTopProducts(products, cur) {
  const container = document.getElementById('topProductsList');
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = '<div class="empty-mini">Sem dados ainda</div>';
    return;
  }

  const medals = ['🥇', '🥈', '🥉', '4', '5'];
  container.innerHTML = products.map((p, i) => `
    <div class="top-product-item">
      <div class="tp-rank">${medals[i] || i + 1}</div>
      <div class="tp-info">
        <div class="tp-name">${escapeHtml(p.name)}</div>
        <div class="tp-count">${p.count.toFixed(0)}x comprado</div>
      </div>
      <div class="tp-price">${formatCurrency(p.avgPrice, cur)}/un</div>
    </div>
  `).join('');
}

function renderSavingsCard(purchases, cur) {
  const container = document.getElementById('savingsCard');
  const valueEl = document.getElementById('savingsValue');
  if (!container || !valueEl) return;

  // Calcular economia comparando preços atuais com a média histórica
  let savings = 0;
  purchases.forEach(p => {
    (p.items || []).forEach(item => {
      const hist = DB.getProductPriceHistory(item.name);
      if (hist.length >= 2) {
        const allButLast = hist.slice(0, -1);
        const avgOld = allButLast.reduce((s, h) => s + h.price, 0) / allButLast.length;
        if (item.price < avgOld) {
          savings += (avgOld - item.price) * item.qty;
        }
      }
    });
  });

  if (savings > 0.5) {
    container.classList.remove('hidden');
    valueEl.textContent = formatCurrency(savings, cur);
  } else {
    container.classList.add('hidden');
  }
}


function renderBudgetCard(monthPurchases, cur) {
  const card = document.getElementById('budgetCard');
  const value = document.getElementById('budgetValue');
  const meta = document.getElementById('budgetMeta');
  const progress = document.getElementById('budgetProgress');
  if (!card || !value || !meta || !progress) return;

  const info = DB.getBudgetStatus(monthPurchases);
  if (!info.budget || info.budget <= 0) {
    card.classList.add('hidden');
    return;
  }

  card.classList.remove('hidden');
  const pct = Math.max(0, Math.min(100, info.pct));
  value.textContent = `${formatCurrency(info.spent, cur)} / ${formatCurrency(info.budget, cur)}`;
  meta.textContent = info.overBudget
    ? `Ultrapassou ${formatCurrency(info.spent - info.budget, cur)}`
    : `Restam ${formatCurrency(info.remaining, cur)}`;
  progress.style.width = `${pct}%`;
  progress.classList.toggle('danger', info.overBudget || info.isNearLimit);
}

function renderSmartRestock() {
  const wrap = document.getElementById('smartRestockWrap');
  const container = document.getElementById('smartRestockList');
  if (!wrap || !container) return;

  const settings = DB.getSettings();
  if (settings.smartPredictionEnabled === false) {
    wrap.style.display = 'none';
    return;
  }

  const items = DB.getPredictedRestocks(5);
  if (!items.length) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = '';
  const categories = DB.getCategories();
  container.innerHTML = items.map(item => {
    const cat = categories.find(c => c.id === item.categoryId) || { emoji: '🛒' };
    const when = item.daysUntil <= 0 ? 'repor agora' : `~${item.daysUntil} dia(s)`;
    return `
      <div class="smart-restock-item">
        <div>
          <div class="sri-name">${cat.emoji} ${escapeHtml(item.name)}</div>
          <div class="sri-meta">Consumo médio: a cada ${item.avgDays} dia(s) · Estoque atual: ${item.currentQty}</div>
        </div>
        <div class="sri-actions">
          <span class="sri-when">${when}</span>
          <button class="btn-primary-sm" onclick="addPredictedItemToList('${escapeHtml(item.name)}', '${item.categoryId}', ${item.suggestedQty})">+ ${item.suggestedQty}</button>
        </div>
      </div>
    `;
  }).join('');
}

function addPredictedItemToList(name, categoryId, qty) {
  const stockItem = DB.getStock().find(s => (s.name || '').toLowerCase().trim() === name.toLowerCase().trim());
  if (stockItem) {
    const ok = DB.ensureItemInCurrentListFromStock(stockItem, qty);
    if (!ok) {
      showToast('Esse item já está na lista de compras', 'info');
      return;
    }
  } else {
    DB.addItemToList({ name, qty, price: DB.getAveragePrice(name) || 0, categoryId });
  }
  if (typeof renderShoppingList === 'function') renderShoppingList();
  showToast('Item inteligente enviado para a lista!', 'success');
}
