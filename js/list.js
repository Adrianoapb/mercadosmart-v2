/* ==========================================
   MERCADOSMART - LISTA DE COMPRAS
   ========================================== */

let currentFilter = 'all';
let recognition = null;
let isListening = false;
let editingItemId = null;
let scannerTarget = 'item';
let listSortMode = 'default';

// ---- Renderizar lista ----
function renderShoppingList() {
  const list = DB.getCurrentList();
  const settings = DB.getSettings();
  const categories = DB.getCategories();
  const items = list.items || [];
  const container = document.getElementById('shoppingListItems');
  const emptyState = document.getElementById('listEmptyState');

  if (!container) return;

  // Atualizar header
  const nameEl = document.getElementById('activeListName');
  const dateEl = document.getElementById('activeListDate');
  if (nameEl) nameEl.textContent = list.name || 'Nova Lista';
  if (dateEl) dateEl.textContent = formatDateRelative(list.createdAt);

  // Filtrar itens
  const searchTerm = (document.getElementById('listSearch')?.value || '').toLowerCase();
  const selectedOnly = document.getElementById('showSelectedOnlyToggle')?.checked;
  listSortMode = document.getElementById('listSortSelect')?.value || DB.getSettings().listSortMode || 'default';
  let filtered = items.filter(item => {
    if (currentFilter !== 'all' && item.categoryId !== currentFilter) return false;
    if (selectedOnly && !item.checked) return false;
    if (searchTerm) {
      const hay = `${item.name || ''} ${item.note || ''} ${item.brand || ''}`.toLowerCase();
      if (!hay.includes(searchTerm)) return false;
    }
    return true;
  });

  if (listSortMode === 'name') filtered.sort((a,b) => (a.name||'').localeCompare(b.name||'', 'pt-BR'));
  else if (listSortMode === 'price_desc') filtered.sort((a,b) => safeNum(b.price)-safeNum(a.price));
  else if (listSortMode === 'price_asc') filtered.sort((a,b) => safeNum(a.price)-safeNum(b.price));
  else if (listSortMode === 'qty_desc') filtered.sort((a,b) => safeNum(b.qty)-safeNum(a.qty));
  else if (listSortMode === 'selected') filtered.sort((a,b) => Number(!!b.checked)-Number(!!a.checked) || (a.name||'').localeCompare(b.name||'', 'pt-BR'));

  // Atualizar total apenas dos itens selecionados
  const total = items
    .filter(i => !!i.checked)
    .reduce((s, i) => s + (safeNum(i.price) * safeNum(i.qty)), 0);
  const totalEl = document.getElementById('activeListTotal');
  if (totalEl) totalEl.textContent = formatCurrency(total);

  // Progresso
  const checked = items.filter(i => i.checked).length;
  const totalCount = items.length;
  const pct = totalCount > 0 ? Math.round((checked / totalCount) * 100) : 0;
  const progressText = document.getElementById('progressText');
  const progressPct = document.getElementById('progressPercent');
  const progressFill = document.getElementById('progressFill');
  if (progressText) progressText.textContent = `${checked} de ${totalCount} itens`;
  if (progressPct) progressPct.textContent = `${pct}%`;
  if (progressFill) progressFill.style.width = `${pct}%`;

  // Vazio
  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = '';
    renderSuggestions();
    renderCategoryFilters();
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  // Ordenar por categoria
  if (settings.sortByCategory) {
    const grouped = groupByCategory(filtered, categories);
    let html = '';
    Object.entries(grouped).forEach(([catId, catItems]) => {
      const cat = categories.find(c => c.id === catId) || { name: 'Outros', emoji: '🛍️', color: '#9e9e9e' };
      const checkedInCat = catItems.filter(i => i.checked).length;
      html += `
        <div class="category-group">
          <div class="category-group-label" style="color:${cat.color}">
            <span>${cat.emoji}</span> ${cat.name}
            <span style="margin-left:auto;font-size:10px;opacity:0.7">${checkedInCat}/${catItems.length}</span>
          </div>
          ${catItems.map(item => renderListItem(item)).join('')}
        </div>
      `;
    });
    container.innerHTML = html;
  } else {
    // Não agrupado
    const unchecked = filtered.filter(i => !i.checked);
    const checkedItems = filtered.filter(i => i.checked);
    container.innerHTML = [...unchecked, ...checkedItems].map(item => renderListItem(item)).join('');
  }

  renderCategoryFilters();
  renderSuggestions();
  container.classList.add('stagger-children');
  setTimeout(() => container.classList.remove('stagger-children'), 600);
}

function renderListItem(item) {
  const cat = getCategoryById(item.categoryId);
  const total = safeNum(item.price) * safeNum(item.qty);
  const cur = DB.getSettings().currency || 'R$';

  // Variação de preço
  const lastPrice = DB.getLastPrice(item.name);
  let priceVariation = '';
  if (lastPrice && Math.abs(lastPrice - item.price) > 0.001 && item.price > 0) {
    const diff = item.price - lastPrice;
    const dir = diff > 0 ? 'up' : 'down';
    const arrow = diff > 0 ? '▲' : '▼';
    const pct = Math.abs((diff / lastPrice) * 100).toFixed(0);
    priceVariation = `<span class="price-badge ${dir}">${arrow} ${pct}%</span>`;
  }

  const qtyLabel = safeNum(item.qty) % 1 === 0 ? parseInt(item.qty) : item.qty;

  return `
    <div class="list-item ${item.checked ? 'checked' : ''} item-appear" id="item_${item.id}">
      <button class="list-item-check" onclick="toggleItemCheck('${item.id}')"></button>
      <div class="item-info">
        <div class="item-name">${escapeHtml(item.name)}</div>
        <div class="item-detail">
          <span>${cat.emoji} ${cat.name}</span>
          <span>Qtd: ${qtyLabel}</span>
        </div>
        ${item.note ? `<div class="item-note">${escapeHtml(item.note)}</div>` : ''}
      </div>
      <div class="item-price-box">
        <div class="item-total">${formatCurrency(total, cur)}</div>
        ${item.price > 0 ? `<div class="item-unit-price">${formatCurrency(item.price, cur)}/un ${priceVariation}</div>` : ''}
      </div>
      <div class="item-actions">
        <button class="item-act-btn" onclick="openEditItem('${item.id}')" title="Editar">✏️</button>
        <button class="item-act-btn del" onclick="deleteListItem('${item.id}')" title="Excluir">🗑️</button>
      </div>
    </div>
  `;
}

function renderSuggestions() {
  const settings = DB.getSettings();
  const header = document.getElementById('suggestionsHeader');
  const container = document.getElementById('suggestionsList');
  if (!container) return;

  if (!settings.showSuggestions) {
    if (header) header.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  const list = DB.getCurrentList();
  const suggestions = DB.getSuggestions(list.items, 6);
  const cur = settings.currency || 'R$';

  if (suggestions.length === 0) {
    if (header) header.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  if (header) header.style.display = '';

  container.innerHTML = suggestions.map(sug => {
    const avgPrice = DB.getAveragePrice(sug.name);
    const cat = getCategoryById(sug.categoryId);
    return `
      <div class="suggestion-chip" onclick="addSuggestion('${escapeHtml(sug.name)}', '${sug.categoryId || ''}')">
        <span class="sug-icon">${cat.emoji}</span>
        <div class="sug-info">
          <span class="sug-name">${escapeHtml(sug.name)}</span>
          ${avgPrice ? `<span class="sug-price">~${formatCurrency(avgPrice, cur)}</span>` : ''}
        </div>
        <span class="sug-add">+</span>
      </div>
    `;
  }).join('');
}

// ---- Adicionar item ----
function openAddItemModal() {
  editingItemId = null;
  document.getElementById('modalItemTitle').textContent = 'Adicionar Item';
  document.getElementById('itemName').value = '';
  document.getElementById('itemQty').value = 1;
  document.getElementById('itemPrice').value = '';
  document.getElementById('itemNote').value = '';
  const bcEl = document.getElementById('itemBarcode');
  if (bcEl) bcEl.value = '';
  document.getElementById('editingItemId').value = '';
  document.getElementById('itemTotalDisplay').textContent = formatCurrency(0);
  document.getElementById('priceHistoryInfo').classList.add('hidden');
  document.getElementById('autocompleteList').classList.add('hidden');
  populateCategorySelects();
  openModal('modalItem');
  setTimeout(() => document.getElementById('itemName').focus(), 300);
}

function openEditItem(itemId) {
  const list = DB.getCurrentList();
  const item = list.items.find(i => i.id === itemId);
  if (!item) return;

  editingItemId = itemId;
  document.getElementById('modalItemTitle').textContent = 'Editar Item';
  document.getElementById('itemName').value = item.name;
  document.getElementById('itemQty').value = item.qty;
  document.getElementById('itemPrice').value = item.price || '';
  document.getElementById('itemNote').value = item.note || '';
  const bcEl = document.getElementById('itemBarcode');
  if (bcEl) bcEl.value = item.barcode || '';
  document.getElementById('editingItemId').value = itemId;
  populateCategorySelects();
  document.getElementById('itemCategory').value = item.categoryId || 'c10';
  calcItemTotal();
  showPriceHistory(item.name);
  openModal('modalItem');
}

function addSuggestion(name, categoryId) {
  const avgPrice = DB.getAveragePrice(name) || 0;
  document.getElementById('modalItemTitle').textContent = 'Adicionar Item';
  document.getElementById('itemName').value = name;
  document.getElementById('itemQty').value = 1;
  document.getElementById('itemPrice').value = avgPrice ? avgPrice.toFixed(2) : '';
  document.getElementById('itemNote').value = '';
  const bcEl = document.getElementById('itemBarcode');
  if (bcEl) bcEl.value = '';
  document.getElementById('editingItemId').value = '';
  editingItemId = null;
  populateCategorySelects();
  if (categoryId) document.getElementById('itemCategory').value = categoryId;
  calcItemTotal();
  showPriceHistory(name);
  openModal('modalItem');
}

function saveItem() {
  const name = document.getElementById('itemName').value.trim();
  const qty = safeNum(document.getElementById('itemQty').value) || 1;
  const price = safeNum(document.getElementById('itemPrice').value) || 0;
  const note = document.getElementById('itemNote').value.trim();
  const categoryId = document.getElementById('itemCategory').value;

  if (!name) { showToast('Digite o nome do produto', 'warning'); document.getElementById('itemName').classList.add('shake'); setTimeout(() => document.getElementById('itemName').classList.remove('shake'), 500); return; }

  const barcode = document.getElementById('itemBarcode')?.value.trim() || '';
  const autoCat = DB.getSettings().autoCategorizeProducts !== false;
  const finalCategory = categoryId || (autoCat ? DB.autoDetectCategoryId(name) : 'c10');
  const item = { name, qty, price, note, categoryId: finalCategory, barcode };

  if (editingItemId) {
    DB.updateItemInList(editingItemId, item);
    showToast('Item atualizado!', 'success');
  } else {
    DB.addItemToList(item);
    showToast(`${name} adicionado!`, 'success');
  }

  closeModal('modalItem');
  renderShoppingList();
}

function toggleItemCheck(itemId) {
  DB.toggleItemCheck(itemId);
  renderShoppingList();

  // Animação no check
  const itemEl = document.getElementById('item_' + itemId);
  if (itemEl) {
    const btn = itemEl.querySelector('.list-item-check');
    if (btn) btn.classList.add('check-animate');
    setTimeout(() => btn && btn.classList.remove('check-animate'), 400);
  }
}

function deleteListItem(itemId) {
  const itemEl = document.getElementById('item_' + itemId);
  if (itemEl) { itemEl.classList.add('swipe-out'); setTimeout(() => { DB.removeItemFromList(itemId); renderShoppingList(); }, 280); }
  else { DB.removeItemFromList(itemId); renderShoppingList(); }
}

function filterByCategory(catId, btn) {
  currentFilter = catId;
  document.querySelectorAll('.cat-filter').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderShoppingList();
}

function filterListItems() { renderShoppingList(); }

// ---- Controle de quantidade ----
function changeQty(delta) {
  const input = document.getElementById('itemQty');
  let val = safeNum(input.value) + delta;
  if (val < 0.5) val = 0.5;
  input.value = val % 1 === 0 ? val : val.toFixed(1);
  calcItemTotal();
}

function calcItemTotal() {
  const qty = safeNum(document.getElementById('itemQty')?.value) || 0;
  const price = safeNum(document.getElementById('itemPrice')?.value) || 0;
  const total = qty * price;
  const display = document.getElementById('itemTotalDisplay');
  if (display) display.textContent = formatCurrency(total);
}

// ---- Autocomplete ----
function onItemNameInput() {
  const val = document.getElementById('itemName').value.trim();
  calcItemTotal();
  const settings = DB.getSettings();
  if (settings.autoCategorizeProducts !== false && val.length >= 2) {
    const guessed = DB.autoDetectCategoryId(val);
    const catEl = document.getElementById('itemCategory');
    if (catEl && guessed) catEl.value = guessed;
  }
  if (val.length < 2) {
    document.getElementById('autocompleteList').classList.add('hidden');
    return;
  }

  const freq = DB.getFrequentProducts(100);
  const cur = DB.getSettings().currency || 'R$';
  const matches = freq.filter(p => p.name.toLowerCase().includes(val.toLowerCase())).slice(0, 6);
  const priceHistory = DB.getPriceHistory();

  if (matches.length === 0) {
    document.getElementById('autocompleteList').classList.add('hidden');
    return;
  }

  document.getElementById('autocompleteList').classList.remove('hidden');
  document.getElementById('autocompleteList').innerHTML = matches.map(p => {
    const avgPrice = DB.getAveragePrice(p.name);
    return `<div class="autocomplete-item" onclick="selectAutocomplete('${escapeHtml(p.name)}', '${p.categoryId || ''}')">
      <span>${escapeHtml(p.name)}</span>
      ${avgPrice ? `<span class="ac-price">${formatCurrency(avgPrice, cur)}</span>` : ''}
    </div>`;
  }).join('');

  showPriceHistory(val);
}

function selectAutocomplete(name, categoryId) {
  document.getElementById('itemName').value = name;
  document.getElementById('autocompleteList').classList.add('hidden');
  populateCategorySelects();
  if (categoryId) document.getElementById('itemCategory').value = categoryId;
  const avgPrice = DB.getAveragePrice(name);
  if (avgPrice) {
    document.getElementById('itemPrice').value = avgPrice.toFixed(2);
    calcItemTotal();
  }
  showPriceHistory(name);
}

function showPriceHistory(name) {
  if (!name || name.length < 2) return;
  const hist = DB.getProductPriceHistory(name);
  const infoEl = document.getElementById('priceHistoryInfo');
  const textEl = document.getElementById('priceHistoryText');
  if (!infoEl || !textEl) return;

  if (hist.length === 0) { infoEl.classList.add('hidden'); return; }

  const cur = DB.getSettings().currency || 'R$';
  const avgPrice = hist.reduce((s, h) => s + h.price, 0) / hist.length;
  const lastPrice = hist[hist.length - 1].price;

  let txt = `📊 ${hist.length} registros | Médio: ${formatCurrency(avgPrice, cur)} | Último: ${formatCurrency(lastPrice, cur)}`;

  if (hist.length >= 2) {
    const prev = hist[hist.length - 2].price;
    const diff = lastPrice - prev;
    if (diff > 0.001) txt += ` <span style="color:#ef5350">▲ +${((diff/prev)*100).toFixed(1)}%</span>`;
    else if (diff < -0.001) txt += ` <span style="color:#00e676">▼ ${((diff/prev)*100).toFixed(1)}%</span>`;
  }

  textEl.innerHTML = txt;
  infoEl.classList.remove('hidden');
}


function openBarcodeScannerForItem() {
  scannerTarget = 'item';
  if (typeof openBarcodeScanner === 'function') openBarcodeScanner('item');
}

function applyScannedBarcodeToItem(code, resolved = null) {
  const barcodeEl = document.getElementById('itemBarcode');
  if (barcodeEl) barcodeEl.value = code;
  if (resolved) {
    document.getElementById('itemName').value = resolved.name || document.getElementById('itemName').value;
    if (resolved.price) document.getElementById('itemPrice').value = resolved.price;
    if (resolved.categoryId) document.getElementById('itemCategory').value = resolved.categoryId;
  }
  calcItemTotal();
}


function toggleAllListItems(checked) {
  const list = DB.getCurrentList();
  if (!list.items || list.items.length === 0) { showToast('Sua lista está vazia', 'info'); return; }
  list.items = list.items.map(item => ({ ...item, checked: !!checked }));
  DB.saveCurrentList(list);
  renderShoppingList();
  showToast(checked ? 'Todos os itens foram selecionados' : 'Seleção removida', 'success');
}

function changeListSort() {
  const mode = document.getElementById('listSortSelect')?.value || 'default';
  const settings = DB.getSettings();
  settings.listSortMode = mode;
  DB.saveSettings(settings);
  renderShoppingList();
}

function filterListItems() {
  renderShoppingList();
}

// ---- Finalizar compra ----
function finalizeList() {
  const list = DB.getCurrentList();
  const items = list.items || [];

  if (items.length === 0) { showToast('Adicione itens antes de finalizar', 'warning'); return; }

  const selectedItems = items.filter(i => i.checked);
  if (selectedItems.length === 0) {
    showToast('Selecione pelo menos 1 item para finalizar', 'warning');
    return;
  }

  const total = selectedItems.reduce((s, i) => s + (safeNum(i.price) * safeNum(i.qty)), 0);

  document.getElementById('finalizeTotal').textContent = formatCurrency(total);
  document.getElementById('finalizeItemsCount').textContent = `${selectedItems.length} itens selecionados de ${items.length}`;
  document.getElementById('finalizeName').value = list.name || '';
  document.getElementById('finalizeMarket').value = '';

  openModal('modalFinalize');
}

function confirmFinalize() {
  const list = DB.getCurrentList();
  const name = document.getElementById('finalizeName').value.trim() || 'Compra';
  const market = document.getElementById('finalizeMarket').value.trim();
  const updateStock = document.getElementById('finalizeUpdateStock').checked;
  const items = list.items || [];
  const selectedItems = items.filter(i => i.checked);
  const remainingItems = items.filter(i => !i.checked).map(i => ({ ...i, checked: false }));

  if (selectedItems.length === 0) {
    showToast('Selecione pelo menos 1 item para finalizar', 'warning');
    return;
  }

  const total = selectedItems.reduce((s, i) => s + (safeNum(i.price) * safeNum(i.qty)), 0);

  // Salvar no histórico de preços e uso apenas dos itens selecionados
  selectedItems.forEach(item => {
    if (item.price > 0) DB.recordPrice(item.name, item.price, market);
    DB.recordProductUsage(item.name, item.categoryId);
  });

  // Atualizar estoque apenas com os itens selecionados
  if (updateStock) DB.incrementStockByPurchase(selectedItems);

  // Salvar compra apenas com os itens selecionados
  const purchase = {
    name,
    market,
    total,
    items: selectedItems.map(i => ({ ...i })),
    itemCount: selectedItems.length,
    checkedCount: selectedItems.length,
  };
  DB.savePurchase(purchase);

  // Manter na lista apenas os itens não selecionados
  DB.saveCurrentList({
    ...list,
    items: remainingItems,
    updatedAt: new Date().toISOString()
  });

  closeModal('modalFinalize');
  renderShoppingList();

  const finishMsg = updateStock
    ? `Compra finalizada com ${selectedItems.length} item(ns)! Estoque atualizado. Total: ${formatCurrency(total)}`
    : `Compra finalizada com ${selectedItems.length} item(ns)! Total: ${formatCurrency(total)}`;
  showToast(finishMsg, 'success', 4000);

  // Animação de celebração
  const totalEl = document.getElementById('activeListTotal');
  if (totalEl) totalEl.classList.add('celebrate');
  setTimeout(() => totalEl && totalEl.classList.remove('celebrate'), 600);

  setTimeout(() => switchPage('pageHistory'), 1000);
}

// ---- Voz ----
function openVoiceInput() {
  openModal('modalVoice');
  document.getElementById('voiceTranscript').textContent = '';
  document.getElementById('voiceStatus').textContent = 'Toque para falar';
  document.getElementById('voiceCircle').classList.remove('listening');
}

function toggleVoice() {
  if (isListening) stopVoice();
  else startVoice();
}

function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Reconhecimento de voz não suportado neste dispositivo', 'warning');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'pt-BR';
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isListening = true;
    document.getElementById('voiceStatus').textContent = 'Ouvindo...';
    document.getElementById('voiceCircle').classList.add('listening');
    document.getElementById('voiceStartBtn').textContent = '⏹️ Parar';
  };

  recognition.onresult = (e) => {
    const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
    document.getElementById('voiceTranscript').textContent = transcript;
    if (e.results[0].isFinal) parseVoiceInput(transcript);
  };

  recognition.onend = () => {
    isListening = false;
    document.getElementById('voiceCircle').classList.remove('listening');
    document.getElementById('voiceStartBtn').textContent = '🎤 Iniciar';
    document.getElementById('voiceStatus').textContent = 'Toque para falar';
  };

  recognition.onerror = () => {
    isListening = false;
    document.getElementById('voiceCircle').classList.remove('listening');
    document.getElementById('voiceStartBtn').textContent = '🎤 Iniciar';
    showToast('Erro no reconhecimento de voz', 'error');
  };

  recognition.start();
}

function stopVoice() {
  if (recognition) recognition.stop();
  isListening = false;
}

function parseVoiceInput(text) {
  // Parsear frases como "2 pacotes de arroz", "feijão 1kg", "3 garrafas de água"
  const patterns = [
    /^(\d+(?:[.,]\d+)?)\s+(?:pacotes?\s+de\s+|kg\s+de\s+|litros?\s+de\s+|latas?\s+de\s+|caixas?\s+de\s+|unidades?\s+de\s+)?(.+)$/i,
    /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:kg|g|ml|L|litros?|pacotes?|caixas?|unidades?)?$/i,
    /^(.+)$/i,
  ];

  let name = '', qty = 1;

  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      if (p.source.startsWith('^(\\d')) {
        qty = parseFloat(m[1].replace(',', '.'));
        name = m[2].trim();
      } else if (m[2] && !isNaN(parseFloat(m[2]))) {
        name = m[1].trim();
        qty = parseFloat(m[2]);
      } else {
        name = m[1].trim();
      }
      break;
    }
  }

  if (!name) return;

  name = capitalize(name);
  const avgPrice = DB.getAveragePrice(name) || 0;
  const cats = DB.getCategories();
  let categoryId = cats[cats.length - 1]?.id || 'c10';

  // Tentar identificar categoria pelo nome
  const freqData = DB.getProductHistory();
  const freqKey = name.toLowerCase();
  if (freqData[freqKey]) categoryId = freqData[freqKey].categoryId || categoryId;

  DB.addItemToList({ name, qty: qty || 1, price: avgPrice, categoryId, note: '' });
  closeModal('modalVoice');
  renderShoppingList();
  showToast(`"${name}" adicionado por voz!`, 'success');
}
