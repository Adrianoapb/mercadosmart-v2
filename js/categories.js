/* ==========================================
   MERCADOSMART - CATEGORIAS
   ========================================== */

function getCategoryById(id) {
  const cats = DB.getCategories();
  return cats.find(c => c.id === id) || { name: 'Outros', emoji: '🛍️', color: '#9e9e9e' };
}

function populateCategorySelects() {
  const cats = DB.getCategories();
  const selects = ['itemCategory', 'stockCategory'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = cats.map(c => `<option value="${c.id}">${c.emoji} ${c.name}</option>`).join('');
  });
}

function renderCategoryFilters() {
  const cats = DB.getCategories();
  const container = document.getElementById('categoryFilters');
  if (!container) return;

  const list = getCurrentList ? getCurrentList() : { items: [] };
  const usedCatIds = new Set((list.items || []).map(i => i.categoryId));

  let html = `<button class="cat-filter active" data-cat="all" onclick="filterByCategory('all', this)">Todos</button>`;
  cats.forEach(cat => {
    if (usedCatIds.has(cat.id)) {
      html += `<button class="cat-filter" data-cat="${cat.id}" onclick="filterByCategory('${cat.id}', this)">${cat.emoji} ${cat.name}</button>`;
    }
  });
  container.innerHTML = html;
}

function renderCategoriesSettings() {
  const cats = DB.getCategories();
  const container = document.getElementById('categoriesSettingList');
  if (!container) return;
  container.innerHTML = cats.map(cat => `
    <div class="cat-setting-item">
      <span class="cat-emoji">${cat.emoji}</span>
      <span class="cat-name-text">${cat.name}</span>
      <span class="cat-color-dot" style="background:${cat.color}"></span>
      ${cat.id.startsWith('c') && parseInt(cat.id.slice(1)) <= 10 ? '' :
        `<button class="cat-del-btn" onclick="deleteCategoryItem('${cat.id}')">✕</button>`}
    </div>
  `).join('');
}

function deleteCategoryItem(id) {
  confirmAction('Excluir Categoria', 'Itens nesta categoria serão movidos para "Outros".', () => {
    DB.deleteCategory(id);
    renderCategoriesSettings();
    populateCategorySelects();
    showToast('Categoria excluída!', 'success');
  });
}

function openAddCategoryModal() {
  document.getElementById('newCatName').value = '';
  document.getElementById('newCatEmoji').value = '';
  renderColorPicker();
  openModal('modalCategory');
}

function renderColorPicker() {
  const colors = ['#ef5350','#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3','#03a9f4','#00bcd4','#009688','#4caf50','#8bc34a','#cddc39','#ffeb3b','#ffc107','#ff9800','#ff5722','#795548','#9e9e9e','#607d8b'];
  const container = document.getElementById('colorPickerRow');
  if (!container) return;
  container.innerHTML = colors.map((c, i) =>
    `<div class="color-dot ${i === 0 ? 'selected' : ''}" style="background:${c}" data-color="${c}" onclick="selectColor(this)"></div>`
  ).join('');
}

function selectColor(el) {
  document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
  el.classList.add('selected');
}

function saveCategory() {
  const name = document.getElementById('newCatName').value.trim();
  const emoji = document.getElementById('newCatEmoji').value.trim() || '🏷️';
  const selected = document.querySelector('.color-dot.selected');
  const color = selected ? selected.dataset.color : '#9e9e9e';

  if (!name) { showToast('Digite um nome para a categoria', 'warning'); return; }

  DB.addCategory({ name, emoji, color });
  populateCategorySelects();
  renderCategoriesSettings();
  renderCategoryFilters();
  closeModal('modalCategory');
  showToast('Categoria adicionada!', 'success');
}

function getCurrentList() {
  return DB.getCurrentList();
}
