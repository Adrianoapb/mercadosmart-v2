/* ==========================================
   MERCADOSMART - RELATÓRIOS AVANÇADOS
   ========================================== */

let currentReportPeriod = 'month';

function setReportPeriod(period, btn) {
  currentReportPeriod = period;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  refreshReports();
}

function getReportPurchases() {
  const all = DB.getPurchases();
  const now = new Date();

  const periodMap = {
    month: 1,
    '3months': 3,
    '6months': 6,
    year: 12,
  };

  const months = periodMap[currentReportPeriod] || 1;
  const cutoff = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  return all.filter(p => new Date(p.finalizedAt) >= cutoff);
}

function refreshReports() {
  const purchases = getReportPurchases();
  const cur = DB.getSettings().currency || 'R$';
  const categories = DB.getCategories();

  // --- Stats ---
  const total = purchases.reduce((s, p) => s + (p.total || 0), 0);
  const count = purchases.length;
  const avg = count > 0 ? total / count : 0;
  const max = purchases.reduce((m, p) => Math.max(m, p.total || 0), 0);

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('repTotalSpent', formatCurrency(total, cur));
  setEl('repNumPurchases', count);
  setEl('repAvg', formatCurrency(avg, cur));
  setEl('repMaxSingle', formatCurrency(max, cur));

  // --- Gráfico categorias ---
  const catStats = DB.getCategoryStats(purchases);
  renderRepCategoryBar(catStats, categories);

  // --- Gráfico evolução ---
  const monthsBack = currentReportPeriod === 'month' ? 1 : currentReportPeriod === '3months' ? 3 : currentReportPeriod === '6months' ? 6 : 12;
  const monthlyData = buildMonthlyData(monthsBack);
  renderRepMonthlyLine(monthlyData);

  // --- Produtos mais caros ---
  renderExpensiveProducts(purchases, cur);

  // --- Variação de preços ---
  renderPriceVariation(cur);

  // --- Comparativo por mercado ---
  renderMarketStats(purchases, cur);

  // --- Orçamento mensal ---
  renderBudgetReport(purchases, cur);
}

function buildMonthlyData(months) {
  const result = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    const ps = DB.getPurchases().filter(p => {
      const pd = new Date(p.finalizedAt);
      return pd.getFullYear() === y && pd.getMonth() === m;
    });
    const total = ps.reduce((s, p) => s + (p.total || 0), 0);
    result.push({
      label: d.toLocaleString('pt-BR', { month: 'short' }),
      total,
      count: ps.length,
    });
  }
  return result;
}

function renderExpensiveProducts(purchases, cur) {
  const container = document.getElementById('repExpensiveProducts');
  if (!container) return;

  const map = {};
  purchases.forEach(p => {
    (p.items || []).forEach(item => {
      const key = item.name.toLowerCase().trim();
      const itemTotal = (item.price || 0) * (item.qty || 1);
      if (!map[key]) map[key] = { name: item.name, total: 0, count: 0 };
      map[key].total += itemTotal;
      map[key].count++;
    });
  });

  const sorted = Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8);

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-mini">Sem dados para o período</div>';
    return;
  }

  container.innerHTML = `
    <div class="report-table-wrap">
      ${sorted.map((p, i) => `
        <div class="report-table-row">
          <span class="rtr-rank">${i + 1}</span>
          <span class="rtr-name">${escapeHtml(p.name)}</span>
          <div style="text-align:right">
            <div class="rtr-val">${formatCurrency(p.total, cur)}</div>
            <div style="font-size:10px;color:var(--text-muted)">${p.count}x</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPriceVariation(cur) {
  const container = document.getElementById('repPriceVariation');
  if (!container) return;

  const variations = DB.getPriceVariations().slice(0, 8);

  if (variations.length === 0) {
    container.innerHTML = '<div class="empty-mini">Sem histórico de preços suficiente</div>';
    return;
  }

  container.innerHTML = variations.map(v => `
    <div class="pv-item pv-${v.direction}">
      <div class="pv-name">${escapeHtml(v.name)}</div>
      <div style="text-align:right">
        <div class="pv-old">${formatCurrency(v.oldPrice, cur)}</div>
        <div class="pv-new">${formatCurrency(v.newPrice, cur)}</div>
      </div>
      <div class="pv-arrow">
        ${v.direction === 'up' ? '▲' : v.direction === 'down' ? '▼' : '→'}
      </div>
      <div style="font-size:11px;font-weight:700;${v.direction === 'up' ? 'color:var(--accent-red)' : v.direction === 'down' ? 'color:var(--accent-green)' : 'color:var(--text-muted)'}">
        ${v.direction !== 'same' ? (v.pct > 0 ? '+' : '') + v.pct + '%' : '='}
      </div>
    </div>
  `).join('');
}


function renderMarketStats(purchases, cur) {
  const container = document.getElementById('repMarketStats');
  if (!container) return;
  const stats = DB.getMarketStats(purchases).markets;
  if (!stats.length) {
    container.innerHTML = '<div class="empty-mini">Adicione o nome do mercado ao finalizar para comparar preços</div>';
    return;
  }

  container.innerHTML = stats.slice(0, 6).map((row, idx) => `
    <div class="report-table-row">
      <span class="rtr-rank">${idx + 1}</span>
      <span class="rtr-name">${escapeHtml(row.market)}</span>
      <div style="text-align:right">
        <div class="rtr-val">${formatCurrency(row.total, cur)}</div>
        <div style="font-size:10px;color:var(--text-muted)">${row.count} compra(s) · média ${formatCurrency(row.avg, cur)}</div>
      </div>
    </div>
  `).join('');
}

function renderBudgetReport(purchases, cur) {
  const box = document.getElementById('repBudgetStatus');
  if (!box) return;
  const info = DB.getBudgetStatus(purchases);
  if (!info.budget || info.budget <= 0) {
    box.innerHTML = '<div class="empty-mini">Defina uma meta mensal em Configurações para acompanhar seu orçamento</div>';
    return;
  }
  const pct = Math.max(0, Math.min(100, info.pct));
  box.innerHTML = `
    <div class="budget-report-box ${info.overBudget ? 'over' : ''}">
      <div class="budget-report-top">
        <strong>${formatCurrency(info.spent, cur)}</strong>
        <span>de ${formatCurrency(info.budget, cur)}</span>
      </div>
      <div class="budget-progress-track"><div class="budget-progress-fill ${info.overBudget || info.isNearLimit ? 'danger' : ''}" style="width:${pct}%"></div></div>
      <div class="budget-report-bottom">${info.overBudget ? 'Acima da meta' : `Restam ${formatCurrency(info.remaining, cur)}`}</div>
    </div>
  `;
}
