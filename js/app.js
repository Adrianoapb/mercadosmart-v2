/* ==========================================
   MERCADOSMART - APP PRINCIPAL
   ========================================== */

// ---- Inicialização ----
document.addEventListener('DOMContentLoaded', () => {
  if (window.Auth && typeof Auth.bindUI === 'function') Auth.bindUI();
  initApp();
});

async function initApp() {
  const authOk = window.Auth ? await Auth.bootstrap() : true;
  if (!authOk) return;

  // Simular carregamento
  const loader = document.querySelector('.loader-bar');
  let progress = 0;
  const loadInterval = setInterval(() => {
    progress += Math.random() * 30;
    if (progress >= 100) {
      progress = 100;
      clearInterval(loadInterval);
      setTimeout(showApp, 300);
    }
    if (loader) loader.style.width = progress + '%';
  }, 200);
}

function showApp() {
  const splash = document.getElementById('splashScreen');
  const app = document.getElementById('app');

  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => splash.classList.add('hidden'), 500);
  }
  if (app) app.classList.remove('hidden');
  document.getElementById('headerUserChip')?.classList.remove('hidden');

  // Inicializar configurações
  loadSettings();
  initCloudExperience();

  // Populstar selects de categoria
  populateCategorySelects();

  // Renderizar dashboard inicial
  setTimeout(() => {
    refreshDashboard();
    checkLowStockAlert();
    maybeSendLocalNotifications();
  }, 200);
}

// ---- Botão de tema no header ----
document.getElementById('themeToggle')?.addEventListener('click', () => {
  toggleTheme();
});

// ---- Notificação de estoque ----
document.getElementById('headerNotify')?.addEventListener('click', () => {
  const settings = DB.getSettings();
  const threshold = settings.lowStockThreshold || 2;
  const stock = DB.getStock();
  const lowItems = stock.filter(s => (parseFloat(s.qty) || 0) <= threshold && (parseFloat(s.qty) || 0) > 0);
  const outItems = stock.filter(s => (parseFloat(s.qty) || 0) <= 0);

  if (stock.length === 0) {
    showToast('Nenhum item no estoque cadastrado', 'info');
    return;
  }

  if (lowItems.length === 0 && outItems.length === 0) {
    showToast('✅ Todos os itens estão com estoque OK!', 'success');
    return;
  }

  switchPage('pageStock');
  filterStock('low', document.querySelector('.stock-tab:nth-child(2)'));
});

function checkLowStockAlert() {
  const settings = DB.getSettings();
  if (!settings.lowStockAlert) return;
  const threshold = settings.lowStockThreshold || 2;
  const stock = DB.getStock();
  const lowCount = stock.filter(s => (parseFloat(s.qty) || 0) <= threshold).length;
  const expiringCount = stock.filter(s => s.expiryDate && new Date(s.expiryDate) <= new Date(Date.now() + 7*86400000)).length;
  if (lowCount > 0) {
    setTimeout(() => showToast(`⚠️ ${lowCount} itens com estoque baixo!`, 'warning', 4000), 1000);
  }
  if ((DB.getSettings().expiryAlert !== false) && expiringCount > 0) {
    setTimeout(() => showToast(`⏰ ${expiringCount} itens vencendo em até 7 dias`, 'warning', 4500), 1300);
  }
}

// ---- Handlers globais para fecha modal clicando no overlay ----
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// ---- Swipe para fechar modal (touch) ----
let touchStartY = 0;
document.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.querySelectorAll('.modal-sheet').forEach(sheet => {
  sheet.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  sheet.addEventListener('touchend', (e) => {
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (dy > 80) {
      // Swipe para baixo → fechar modal
      const overlay = sheet.closest('.modal-overlay');
      if (overlay) closeModal(overlay.id);
    }
  }, { passive: true });
});

// ---- Fechar autocomplete ao clicar fora ----
document.addEventListener('click', (e) => {
  const ac = document.getElementById('autocompleteList');
  const input = document.getElementById('itemName');
  if (ac && !ac.contains(e.target) && e.target !== input) {
    ac.classList.add('hidden');
  }
});

// ---- Inicialização da página Família ----
const familyNavBtn = document.getElementById('navFamily') || document.querySelector('[onclick*="pageFamily"]');
if (familyNavBtn) {
  familyNavBtn.addEventListener('click', () => {
    if (typeof populateShareListSelect === 'function') populateShareListSelect();
  });
}
// No layout atual, Família pode ficar dentro de outra navegação ou modal

// ---- Atalho: clique duplo no header vai para Família ----
let headerClickCount = 0;
document.querySelector('.app-logo')?.addEventListener('click', () => {
  headerClickCount++;
  if (headerClickCount === 2) {
    headerClickCount = 0;
    // Abre modal família inline via settings
    showToast('Acesse "Relatórios" → Modo Família', 'info');
  }
  setTimeout(() => { headerClickCount = 0; }, 500);
});

// ---- Visibilidade da página ----
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    const dashPage = document.getElementById('pageDashboard');
    if (dashPage && dashPage.classList.contains('active')) {
      refreshDashboard();
    }
    if (DB.getSettings().cloudAutoSync !== false && navigator.onLine) {
      DB.CloudSync.syncSmart({ silent: true }).then(() => { if (typeof renderCloudStatus === 'function') renderCloudStatus(DB.getCloudMeta()); }).catch(err => { console.debug('Falha ao sincronizar ao voltar para o app', err); });
    }
  }
});

// ---- Navegação de Família ----
function goToFamilyPage() {
  switchPage('pageFamily');
  populateShareListSelect();
}

// ---- Service Worker (offline) ----
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('SW registrado'))
    .catch(err => console.log('SW não registrado:', err.message));
}

// Dados de demonstração removidos para evitar reaparecimento de conteúdo antigo.

// Inicialização final sem dados de demonstração
setTimeout(() => {
  refreshDashboard();
  checkLowStockAlert();
}, 600);


let barcodeScannerStream = null;
let barcodeScannerInterval = null;
let lastLocalNotificationAt = 0;

function maybeSendLocalNotifications() {
  const settings = DB.getSettings();
  if (!settings.enableBrowserNotifications || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = Date.now();
  if (now - lastLocalNotificationAt < 60000) return;

  const stock = DB.getStock();
  const threshold = settings.lowStockThreshold || 2;
  const lowItems = stock.filter(s => (parseFloat(s.qty) || 0) <= threshold);
  const budget = DB.getBudgetStatus();

  if (lowItems.length > 0) {
    new Notification('MercadoSmart', { body: `${lowItems.length} item(ns) com estoque baixo ou zerado.` });
    lastLocalNotificationAt = now;
    return;
  }

  if (budget.isNearLimit || budget.overBudget) {
    new Notification('MercadoSmart', { body: budget.overBudget ? 'Você ultrapassou sua meta mensal.' : 'Seu orçamento mensal está perto do limite.' });
    lastLocalNotificationAt = now;
  }
}

function openBarcodeScanner(target) {
  const modal = document.getElementById('modalBarcode');
  const manual = document.getElementById('barcodeManualInput');
  const status = document.getElementById('barcodeScanStatus');
  if (!modal) return;
  modal.dataset.target = target || 'item';
  if (manual) manual.value = '';
  if (status) status.textContent = 'Aponte a câmera para o código de barras.';
  openModal('modalBarcode');
  startBarcodeScanner();
}

async function startBarcodeScanner() {
  const video = document.getElementById('barcodeVideo');
  const status = document.getElementById('barcodeScanStatus');
  if (!video) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    if (status) status.textContent = 'Câmera não disponível. Use a digitação manual.';
    return;
  }

  try {
    barcodeScannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = barcodeScannerStream;
    await video.play();

    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'] });
      barcodeScannerInterval = setInterval(async () => {
        try {
          const barcodes = await detector.detect(video);
          if (barcodes && barcodes.length) {
            const code = barcodes[0].rawValue;
            applyBarcodeResult(code);
          }
        } catch (e) { console.debug('Falha silenciosa ao ler código de barras', e); }
      }, 600);
    } else if (status) {
      status.textContent = 'Leitura automática indisponível neste navegador. Digite o código manualmente abaixo.';
    }
  } catch (e) {
    if (status) status.textContent = 'Não foi possível usar a câmera. Digite o código manualmente.';
  }
}

function stopBarcodeScanner() {
  if (barcodeScannerInterval) {
    clearInterval(barcodeScannerInterval);
    barcodeScannerInterval = null;
  }
  if (barcodeScannerStream) {
    barcodeScannerStream.getTracks().forEach(t => t.stop());
    barcodeScannerStream = null;
  }
  const video = document.getElementById('barcodeVideo');
  if (video) video.srcObject = null;
}

function saveManualBarcode() {
  const code = document.getElementById('barcodeManualInput')?.value.trim();
  if (!code) {
    showToast('Digite um código primeiro', 'warning');
    return;
  }
  applyBarcodeResult(code);
}

function applyBarcodeResult(code) {
  if (!code) return;
  const modal = document.getElementById('modalBarcode');
  const target = modal?.dataset.target || 'item';
  const resolved = DB.resolveProductByBarcode(code);
  if (target === 'stock' && typeof applyScannedBarcodeToStock === 'function') applyScannedBarcodeToStock(code, resolved);
  else if (typeof applyScannedBarcodeToItem === 'function') applyScannedBarcodeToItem(code, resolved);
  closeBarcodeModal();
  showToast(resolved ? 'Código lido e produto reconhecido!' : 'Código salvo. Complete o nome do produto se necessário.', 'success');
}

function closeBarcodeModal() {
  stopBarcodeScanner();
  closeModal('modalBarcode');
}


function initCloudExperience() {
  try {
    DB.getCloudProfile();
    if (typeof renderCloudStatus === 'function') renderCloudStatus(DB.getCloudMeta());
    window.addEventListener('online', () => {
      if (DB.getSettings().cloudAutoSync !== false) {
        DB.CloudSync.syncSmart({ silent: true })
          .then(() => { if (typeof renderCloudStatus === 'function') renderCloudStatus(DB.getCloudMeta()); })
          .catch(err => { console.debug('Falha ao sincronizar ao voltar para o app', err); });
      }
    });

    setTimeout(() => {
      if (navigator.onLine && DB.getSettings().cloudAutoSync !== false) {
        DB.CloudSync.syncSmart({ silent: true })
          .then(() => { if (typeof renderCloudStatus === 'function') renderCloudStatus(DB.getCloudMeta()); })
          .catch(err => { console.debug('Falha ao sincronizar ao voltar para o app', err); });
      }
    }, 1200);
  } catch (e) {
    console.warn('Cloud init failed', e);
  }
}
