/* ==========================================
   MERCADOSMART - GRÁFICOS (Chart.js + fallback offline)
   ========================================== */

let categoryChartInstance = null;
let monthlyChartInstance = null;
let repCategoryBarInstance = null;
let repMonthlyLineInstance = null;

const CHART_DEFAULTS = {
  font: { family: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif', size: 11 },
  color: '#9ba4c7',
};

function isDarkTheme() {
  return document.documentElement.getAttribute('data-theme') !== 'light';
}

function getChartColors() {
  return isDarkTheme()
    ? { text: '#9ba4c7', grid: 'rgba(42,58,92,0.5)', bg: '#16213e' }
    : { text: '#5c6a8a', grid: 'rgba(224,231,239,0.8)', bg: '#ffffff' };
}

function isChartAvailable(showMessage = false) {
  const available = typeof window.Chart !== 'undefined';
  if (!available && showMessage && typeof showToast === 'function') {
    showToast('Gráficos indisponíveis no momento. Abra o app com internet na primeira vez para carregar a biblioteca.', 'warning');
  }
  return available;
}

const PALETTE = [
  '#ef5350','#42a5f5','#ffca28','#ef9a9a','#66bb6a',
  '#ab47bc','#26a69a','#ffa726','#29b6f6','#9e9e9e',
];

function ensureFallbackBox(canvas, className = 'chart-fallback') {
  if (!canvas || !canvas.parentElement) return null;
  let box = canvas.parentElement.querySelector(`.${className}`);
  if (!box) {
    box = document.createElement('div');
    box.className = className;
    canvas.parentElement.appendChild(box);
  }
  return box;
}

function hideFallbackBox(canvas, className = 'chart-fallback') {
  const box = canvas?.parentElement?.querySelector(`.${className}`);
  if (box) box.remove();
}

function renderSimpleLegendStats(container, entries, formatter) {
  container.innerHTML = `
    <div class="simple-chart-list">
      ${entries.map((entry, index) => `
        <div class="simple-chart-row">
          <div class="simple-chart-label">
            <span class="simple-chart-rank">${index + 1}</span>
            <span>${escapeHtml(entry.label)}</span>
          </div>
          <strong>${formatter(entry.value)}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function renderSimpleBars(canvas, entries, emptyEl, currency) {
  if (!canvas) return;
  const box = ensureFallbackBox(canvas);
  if (!box) return;
  const valid = entries.filter(entry => entry.value > 0);
  if (!valid.length) {
    if (emptyEl) emptyEl.classList.remove('hidden');
    canvas.style.display = 'none';
    box.innerHTML = '';
    return;
  }
  if (emptyEl) emptyEl.classList.add('hidden');
  canvas.style.display = 'none';
  const max = Math.max(...valid.map(entry => entry.value), 1);
  box.innerHTML = `
    <div class="simple-chart-bars">
      ${valid.map(entry => `
        <div class="simple-bar-row">
          <div class="simple-bar-top">
            <span>${escapeHtml(entry.label)}</span>
            <strong>${formatCurrency(entry.value, currency)}</strong>
          </div>
          <div class="simple-bar-track"><div class="simple-bar-fill" style="width:${Math.max(8, (entry.value / max) * 100)}%"></div></div>
        </div>
      `).join('')}
      <div class="simple-chart-note">Modo offline simplificado</div>
    </div>
  `;
}

function renderSimpleLine(canvas, points, currency) {
  if (!canvas) return;
  const box = ensureFallbackBox(canvas, 'chart-fallback-line');
  if (!box) return;
  canvas.style.display = 'none';
  const valid = points.filter(point => point.value > 0);
  if (!valid.length) {
    box.innerHTML = '<div class="chart-empty" style="height:100px;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">Sem dados</div>';
    return;
  }
  const max = Math.max(...valid.map(point => point.value), 1);
  box.innerHTML = `
    <div class="simple-line-grid">
      ${valid.map(point => `
        <div class="simple-line-col">
          <div class="simple-line-value">${formatCurrency(point.value, currency)}</div>
          <div class="simple-line-track"><div class="simple-line-point" style="height:${Math.max(10, (point.value / max) * 100)}%"></div></div>
          <div class="simple-line-label">${escapeHtml(point.label)}</div>
        </div>
      `).join('')}
    </div>
    <div class="simple-chart-note">Modo offline simplificado</div>
  `;
}


// ---- Dashboard: Gráfico por Categoria (pizza) ----
function renderCategoryChart(catStats, categories) {
  const canvas = document.getElementById('categoryChart');
  const emptyEl = document.getElementById('categoryChartEmpty');
  if (!canvas) return;
  hideFallbackBox(canvas);

  const entries = Object.entries(catStats).filter(([,v]) => v > 0);

  if (entries.length === 0) {
    if (emptyEl) emptyEl.classList.remove('hidden');
    canvas.style.display = 'none';
    hideFallbackBox(canvas);
    return;
  }
  if (emptyEl) emptyEl.classList.add('hidden');
  if (!isChartAvailable()) {
    renderSimpleBars(canvas, entries.map(([id, value]) => ({ label: (categories.find(c => c.id === id)?.name || id), value })), emptyEl, DB.getSettings().currency || 'R$');
    return;
  }
  hideFallbackBox(canvas);
  canvas.style.display = '';

  if (categoryChartInstance) categoryChartInstance.destroy();

  const labels = entries.map(([id]) => {
    const cat = categories.find(c => c.id === id);
    return cat ? `${cat.emoji} ${cat.name}` : id;
  });
  const data = entries.map(([,v]) => parseFloat(v.toFixed(2)));
  const colors = entries.map(([id], i) => {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.color : PALETTE[i % PALETTE.length];
  });

  const { text } = getChartColors();

  categoryChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: isDarkTheme() ? '#16213e' : '#fff', hoverBorderWidth: 3 }] },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: text, padding: 10, font: { size: 11 }, boxWidth: 12, usePointStyle: true },
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = ((ctx.parsed / total) * 100).toFixed(1);
              const cur = DB.getSettings().currency || 'R$';
              return ` ${formatCurrency(ctx.parsed, cur)} (${pct}%)`;
            }
          }
        }
      },
      animation: { duration: 600, easing: 'easeOutQuart' },
    }
  });
}

// ---- Dashboard: Evolução Mensal (barras) ----
function renderMonthlyChart(monthlyData) {
  const canvas = document.getElementById('monthlyChart');
  const emptyEl = document.getElementById('monthlyChartEmpty');
  if (!canvas) return;
  hideFallbackBox(canvas);

  const hasData = monthlyData.some(m => m.total > 0);
  if (!hasData) {
    if (emptyEl) emptyEl.classList.remove('hidden');
    canvas.style.display = 'none';
    if (monthlyChartInstance) { monthlyChartInstance.destroy(); monthlyChartInstance = null; }
    return;
  }
  if (emptyEl) emptyEl.classList.add('hidden');
  if (!isChartAvailable()) {
    renderSimpleBars(canvas, entries.map(([id, value]) => ({ label: (categories.find(c => c.id === id)?.name || id), value })), emptyEl, DB.getSettings().currency || 'R$');
    return;
  }
  hideFallbackBox(canvas);
  canvas.style.display = '';

  if (monthlyChartInstance) monthlyChartInstance.destroy();
  const { text, grid } = getChartColors();
  const cur = DB.getSettings().currency || 'R$';
  if (!isChartAvailable()) {
    renderSimpleLine(canvas, monthlyData.map(m => ({ label: m.label, value: m.total })), cur);
    return;
  }
  if (!isChartAvailable()) {
    renderSimpleBars(canvas, entries.map(([id, value]) => ({ label: (categories.find(x => x.id === id)?.name || id), value })), null, cur);
    return;
  }

  monthlyChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: monthlyData.map(m => m.label),
      datasets: [{
        label: 'Gasto Mensal',
        data: monthlyData.map(m => m.total),
        backgroundColor: monthlyData.map((m, i) => i === monthlyData.length - 1 ? 'rgba(0,230,118,0.8)' : 'rgba(79,195,247,0.5)'),
        borderColor: monthlyData.map((m, i) => i === monthlyData.length - 1 ? '#00e676' : '#4fc3f7'),
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(ctx) { return ` ${formatCurrency(ctx.parsed.y, cur)}`; }
          }
        }
      },
      scales: {
        x: { ticks: { color: text, font: { size: 11 } }, grid: { display: false }, border: { display: false } },
        y: {
          ticks: { color: text, font: { size: 10 }, callback(v) { return `${cur} ${(v/1000).toFixed(1)}k`; } },
          grid: { color: grid },
          border: { display: false },
        }
      },
      animation: { duration: 500 },
    }
  });
}

// ---- Relatórios: Barras por Categoria ----
function renderRepCategoryBar(catStats, categories) {
  const canvas = document.getElementById('repCategoryBar');
  if (!canvas) return;
  hideFallbackBox(canvas);
  if (repCategoryBarInstance) repCategoryBarInstance.destroy();

  const entries = Object.entries(catStats).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]);
  if (entries.length === 0) {
    renderSimpleLegendStats(ensureFallbackBox(canvas), [], v => v);
    const box = ensureFallbackBox(canvas);
    if (box) box.innerHTML = '<div class="chart-empty" style="height:100px;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">Sem dados</div>';
    canvas.style.display = 'none';
    return;
  }

  const { text, grid } = getChartColors();
  const cur = DB.getSettings().currency || 'R$';
  if (!isChartAvailable()) {
    renderSimpleBars(canvas, entries.map(([id, value]) => ({ label: (categories.find(x => x.id === id)?.name || id), value })), null, cur);
    return;
  }

  const labels = entries.map(([id]) => { const c = categories.find(x => x.id === id); return c ? `${c.emoji} ${c.name}` : id; });
  const data = entries.map(([,v]) => parseFloat(v.toFixed(2)));
  const colors = entries.map(([id], i) => { const c = categories.find(x => x.id === id); return c ? c.color : PALETTE[i % PALETTE.length]; });

  repCategoryBarInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors.map(c => c + 'aa'), borderColor: colors, borderWidth: 2, borderRadius: 6, borderSkipped: false }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label(ctx) { return ` ${formatCurrency(ctx.parsed.x, cur)}`; } } }
      },
      scales: {
        x: {
          ticks: { color: text, callback(v) { return `${cur} ${v}`; } },
          grid: { color: grid }, border: { display: false },
        },
        y: { ticks: { color: text, font: { size: 12 } }, grid: { display: false }, border: { display: false } }
      },
      animation: { duration: 600 },
    }
  });
}

// ---- Relatórios: Linha Evolução ----
function renderRepMonthlyLine(monthlyData) {
  const canvas = document.getElementById('repMonthlyLine');
  if (!canvas) return;
  hideFallbackBox(canvas, 'chart-fallback-line');
  if (repMonthlyLineInstance) repMonthlyLineInstance.destroy();

  const { text, grid } = getChartColors();
  const cur = DB.getSettings().currency || 'R$';
  if (!isChartAvailable()) {
    renderSimpleBars(canvas, entries.map(([id, value]) => ({ label: (categories.find(x => x.id === id)?.name || id), value })), null, cur);
    return;
  }

  repMonthlyLineInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: monthlyData.map(m => m.label),
      datasets: [{
        label: 'Gastos',
        data: monthlyData.map(m => m.total),
        borderColor: '#4fc3f7',
        backgroundColor: 'rgba(79,195,247,0.08)',
        pointBackgroundColor: '#4fc3f7',
        pointBorderColor: isDarkTheme() ? '#16213e' : '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        fill: true,
        tension: 0.4,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label(ctx) { return ` ${formatCurrency(ctx.parsed.y, cur)}`; } } }
      },
      scales: {
        x: { ticks: { color: text }, grid: { display: false }, border: { display: false } },
        y: {
          ticks: { color: text, callback(v) { return `${cur} ${v}`; } },
          grid: { color: grid }, border: { display: false }
        }
      },
      animation: { duration: 600 },
    }
  });
}

function destroyAllCharts() {
  [categoryChartInstance, monthlyChartInstance, repCategoryBarInstance, repMonthlyLineInstance].forEach(c => { try { if (c) c.destroy(); } catch(e) {} });
  categoryChartInstance = monthlyChartInstance = repCategoryBarInstance = repMonthlyLineInstance = null;
}
