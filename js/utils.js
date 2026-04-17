/* ==========================================
   MERCADOSMART - UTILITÁRIOS
   ========================================== */

// ---- Formatação ----
function formatCurrency(value, currency) {
  const cur = currency || (DB.getSettings().currency || 'R$');
  const num = parseFloat(value) || 0;
  return `${cur} ${num.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatDateRelative(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff < 7) return `${diff} dias atrás`;
  return formatDate(dateStr);
}

function formatMonthYear(date) {
  return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia! 👋';
  if (h < 18) return 'Boa tarde! 👋';
  return 'Boa noite! 👋';
}

// ---- Toast ----
function showToast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); }, duration);
}

// ---- Loading ----
function showLoading(text = 'Carregando...') {
  const el = document.getElementById('loadingOverlay');
  const txt = document.getElementById('loadingText');
  if (el) { el.classList.remove('hidden'); if (txt) txt.textContent = text; }
}

function hideLoading() {
  const el = document.getElementById('loadingOverlay');
  if (el) el.classList.add('hidden');
}

// ---- Modal ----
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('hidden'); document.body.style.overflow = ''; }
}

// ---- Page Navigation ----
function switchPage(pageId, navBtn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(pageId);
  if (page) { page.classList.add('active'); page.classList.add('page-enter'); setTimeout(() => page.classList.remove('page-enter'), 300); }

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (navBtn) { navBtn.classList.add('active'); }
  else {
    const map = { pageDashboard: 'navDashboard', pageList: 'navList', pageHistory: 'navHistory', pageStock: 'navStock', pageReports: 'navReports', pageFamily: 'navFamily', pageSettings: 'navSettings' };
    const navId = map[pageId];
    if (navId) { const nb = document.getElementById(navId); if (nb) nb.classList.add('active'); }
  }

  // Refresh page data
  const refreshMap = {
    pageDashboard: () => typeof refreshDashboard === 'function' && refreshDashboard(),
    pageList: () => typeof renderShoppingList === 'function' && renderShoppingList(),
    pageHistory: () => typeof renderHistory === 'function' && renderHistory(),
    pageStock: () => typeof renderStock === 'function' && renderStock(),
    pageReports: () => typeof refreshReports === 'function' && refreshReports(),
    pageFamily: () => typeof populateShareListSelect === 'function' && populateShareListSelect(),
    pageSettings: () => typeof loadSettings === 'function' && loadSettings(),
  };
  if (refreshMap[pageId]) setTimeout(refreshMap[pageId], 50);
}

// ---- Confirmação ----
function confirmAction(title, message, onConfirm) {
  if (window.confirm(`${title}\n\n${message}`)) onConfirm();
}

// ---- UUID simples ----
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ---- Escape HTML ----
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- Número seguro ----
function safeNum(v) { return parseFloat(v) || 0; }

// ---- Agrupar items por categoria ----
function groupByCategory(items, categories) {
  const groups = {};
  items.forEach(item => {
    const catId = item.categoryId || 'c10';
    if (!groups[catId]) groups[catId] = [];
    groups[catId].push(item);
  });

  // Ordenar grupos pela ordem das categorias
  const ordered = {};
  categories.forEach(cat => {
    if (groups[cat.id]) ordered[cat.id] = groups[cat.id];
  });
  // Adicionar categorias não mapeadas
  Object.keys(groups).forEach(k => { if (!ordered[k]) ordered[k] = groups[k]; });
  return ordered;
}

// ---- Download de arquivo ----
function downloadFile(content, filename, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- Capitalize ----
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ---- Mes atual label ----
function getCurrentMonthLabel() {
  return new Date().toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
}

// ---- Número para moeda input ----
function parseCurrency(str) {
  if (!str) return 0;
  return parseFloat(str.toString().replace(',', '.')) || 0;
}

// ---- Exportar PDF (básico) ----
function buildPrintableReportHtml() {
  const settings = DB.getSettings();
  const cur = settings.currency || 'R$';
  const now = new Date();
  const stats = DB.getMonthlyStats(0);
  const purchases = DB.getPurchases().slice(0, 20);
  const categories = DB.getCategories();
  const catStats = DB.getCategoryStats(DB.getPurchases());
  const rows = Object.entries(catStats).sort((a, b) => b[1] - a[1]).map(([catId, total]) => {
    const cat = categories.find(c => c.id === catId);
    return `<tr><td>${escapeHtml(cat ? `${cat.emoji} ${cat.name}` : catId)}</td><td style="text-align:right">${formatCurrency(total, cur)}</td></tr>`;
  }).join('');
  const purchasesHtml = purchases.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${formatDate(p.finalizedAt)}</td>
      <td>${escapeHtml(p.name || 'Compra')}</td>
      <td>${escapeHtml(p.market || '-')}</td>
      <td style="text-align:right">${formatCurrency(p.total, cur)}</td>
    </tr>
  `).join('');
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>MercadoSmart Relatório</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#0f172a}h1{margin:0 0 8px}h2{margin:28px 0 12px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #dbe4f0;font-size:13px}th{text-align:left;background:#f8fafc}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.card{border:1px solid #dbe4f0;border-radius:12px;padding:14px;background:#fff}.muted{color:#64748b}@media print{body{padding:0}}</style></head><body><h1>MercadoSmart</h1><div class="muted">Relatório gerado em ${formatDate(now.toISOString())}</div><div class="cards"><div class="card"><strong>Total gasto no mês</strong><div>${formatCurrency(stats.total, cur)}</div></div><div class="card"><strong>Compras no mês</strong><div>${stats.count}</div></div><div class="card"><strong>Média por compra</strong><div>${formatCurrency(stats.count > 0 ? stats.total / stats.count : 0, cur)}</div></div></div><h2>Histórico recente</h2><table><thead><tr><th>#</th><th>Data</th><th>Compra</th><th>Mercado</th><th style="text-align:right">Total</th></tr></thead><tbody>${purchasesHtml || '<tr><td colspan="5">Sem compras registradas</td></tr>'}</tbody></table><h2>Gastos por categoria</h2><table><thead><tr><th>Categoria</th><th style="text-align:right">Total</th></tr></thead><tbody>${rows || '<tr><td colspan="2">Sem categorias com gastos</td></tr>'}</tbody></table></body></html>`;
}

async function exportPDF() {
  showLoading('Gerando relatório...');
  try {
    await new Promise(r => setTimeout(r, 200));
    if (!window.jspdf || !window.jspdf.jsPDF) {
      const html = buildPrintableReportHtml();
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 300);
        showToast('Modo offline: use a janela de impressão para salvar em PDF.', 'info', 5000);
        return;
      }
      downloadFile(html, `mercadosmart_relatorio_${new Date().toISOString().slice(0,10)}.html`, 'text/html');
      showToast('Modo offline: relatório HTML exportado para salvar como PDF depois.', 'info', 5000);
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const settings = DB.getSettings();
    const cur = settings.currency || 'R$';
    const now = new Date();

    // Cabeçalho
    doc.setFillColor(15, 15, 26);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('MercadoSmart', 20, 22);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(155, 164, 199);
    doc.text(`Relatório gerado em ${formatDate(now.toISOString())}`, 20, 30);

    // Resumo do mês
    const stats = DB.getMonthlyStats(0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 230, 118);
    doc.text('RESUMO DO MÊS', 20, 45);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(232, 234, 246);
    doc.text(`Total Gasto: ${formatCurrency(stats.total, cur)}`, 20, 55);
    doc.text(`N° de Compras: ${stats.count}`, 20, 63);
    const avg = stats.count > 0 ? stats.total / stats.count : 0;
    doc.text(`Média por Compra: ${formatCurrency(avg, cur)}`, 20, 71);

    // Histórico de compras
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 230, 118);
    doc.text('HISTÓRICO DE COMPRAS', 20, 88);

    const purchases = DB.getPurchases().slice(0, 10);
    let y = 98;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(232, 234, 246);

    purchases.forEach((p, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFillColor(22, 33, 62);
      doc.roundedRect(15, y - 5, 180, 14, 2, 2, 'F');
      doc.text(`${formatDate(p.finalizedAt)} - ${p.name || 'Compra ' + (i+1)}`, 20, y + 2);
      doc.setTextColor(0, 230, 118);
      doc.text(formatCurrency(p.total, cur), 160, y + 2, { align: 'right' });
      doc.setTextColor(232, 234, 246);
      if (p.market) doc.text(p.market, 20, y + 8);
      y += 18;
    });

    // Categorias
    if (y + 40 > 270) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(79, 195, 247);
    doc.text('GASTOS POR CATEGORIA', 20, y + 10);
    y += 20;

    const allPurchases = DB.getPurchases();
    const catStats = DB.getCategoryStats(allPurchases);
    const categories = DB.getCategories();
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(232, 234, 246);

    Object.entries(catStats).sort((a,b) => b[1]-a[1]).forEach(([catId, total]) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const cat = categories.find(c => c.id === catId);
      const name = cat ? `${cat.emoji} ${cat.name}` : catId;
      doc.text(name, 20, y);
      doc.setTextColor(0, 230, 118);
      doc.text(formatCurrency(total, cur), 160, y, { align: 'right' });
      doc.setTextColor(232, 234, 246);
      y += 8;
    });

    doc.save(`mercadosmart_relatorio_${now.getFullYear()}-${now.getMonth()+1}.pdf`);
    showToast('PDF exportado com sucesso!', 'success');
  } catch(e) {
    console.error(e);
    showToast('Erro ao gerar PDF: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}

function exportJSON() {
  try {
    const data = DB.exportAllData();
    const json = JSON.stringify(data, null, 2);
    const date = new Date().toISOString().split('T')[0];
    downloadFile(json, `mercadosmart_dados_${date}.json`);
    showToast('Dados exportados em JSON!', 'success');
  } catch(e) {
    showToast('Erro ao exportar: ' + e.message, 'error');
  }
}

// ---- Confirmar reset ----
function confirmResetData() {
  confirmAction('⚠️ ATENÇÃO', 'Quase todos os dados serão apagados permanentemente. As sugestões da lista serão mantidas. Esta ação não pode ser desfeita. Tem certeza?', () => {
    DB.resetAllData({ preserveSuggestions: true });
    showToast('Dados apagados. Sugestões preservadas. Reiniciando...', 'warning');
    setTimeout(() => location.reload(), 1500);
  });
}
