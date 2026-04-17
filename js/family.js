/* ==========================================
   MERCADOSMART - MODO FAMÍLIA (QR Code + Backup)
   ========================================== */

let qrInstance = null;
let qrStream = null;
let qrScanInterval = null;

function switchFamilyTab(tab, btn) {
  document.querySelectorAll('.family-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.family-tab-content').forEach(c => c.classList.add('hidden'));

  if (btn) btn.classList.add('active');
  const tabEl = document.getElementById(`familyTab${capitalize(tab)}`);
  if (tabEl) tabEl.classList.remove('hidden');

  // Parar câmera ao sair da aba de receber
  if (tab !== 'receive') stopQRScan();
}

// ---- Compartilhar via QR Code ----
function generateShareQR() {
  if (typeof window.QRCode === 'undefined') {
    showToast('QR Code indisponível no momento. Abra o app com internet na primeira execução.', 'warning');
    return;
  }
  const container = document.getElementById('qrCodeContainer');
  const dataEl = document.getElementById('qrShareData');
  const copyBtn = document.getElementById('copyShareBtn');
  if (!container) return;

  container.innerHTML = '<div style="color:#888;font-size:13px;padding:20px">Gerando QR Code...</div>';

  // Preparar dados para compartilhamento
  const list = DB.getCurrentList();

  if (!list.items || list.items.length === 0) {
    container.innerHTML = '<div style="color:#ef5350;font-size:13px;padding:20px;text-align:center">⚠️ Sua lista está vazia. Adicione itens primeiro!</div>';
    return;
  }

  const shareData = {
    type: 'mercadosmart_list',
    version: '1.0',
    sharedAt: new Date().toISOString(),
    list: {
      name: list.name,
      items: list.items.map(i => ({
        name: i.name,
        qty: i.qty,
        price: i.price,
        categoryId: i.categoryId,
        note: i.note,
      })),
    }
  };

  const jsonStr = JSON.stringify(shareData);
  const encoded = btoa(unescape(encodeURIComponent(jsonStr)));

  // Limitar tamanho (QR Code tem limite)
  if (encoded.length > 2000) {
    // Compartilhar apenas nomes e quantidades se muito grande
    const shareDataLite = {
      type: 'mercadosmart_list',
      version: '1.0_lite',
      sharedAt: new Date().toISOString(),
      list: {
        name: list.name,
        items: list.items.map(i => ({ name: i.name, qty: i.qty })),
      }
    };
    const liteStr = JSON.stringify(shareDataLite);
    const liteEncoded = btoa(unescape(encodeURIComponent(liteStr)));

    container.innerHTML = '';
    try {
      if (qrInstance) { try { qrInstance.clear(); } catch(e) {} }
      qrInstance = new QRCode(container, {
        text: 'MS:' + liteEncoded,
        width: 200, height: 200,
        colorDark: '#000000', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch(e) {
      container.innerHTML = '<div style="color:#ef5350;padding:10px">Erro ao gerar QR. Use "Copiar Dados".</div>';
    }
    if (dataEl) { dataEl.textContent = 'MS:' + liteEncoded; dataEl.classList.remove('hidden'); }
    if (copyBtn) copyBtn.style.display = '';
    showToast('Lista grande: alguns preços omitidos', 'warning');
    return;
  }

  container.innerHTML = '';
  try {
    if (qrInstance) { try { qrInstance.clear(); } catch(e) {} }
    qrInstance = new QRCode(container, {
      text: 'MS:' + encoded,
      width: 220, height: 220,
      colorDark: '#000000', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
    showToast('QR Code gerado! Mostre para outro dispositivo', 'success');
  } catch (e) {
    container.innerHTML = '<div style="color:#ef5350;padding:10px">Erro ao gerar QR Code.</div>';
    showToast('Erro ao gerar QR Code', 'error');
  }

  if (dataEl) { dataEl.textContent = 'MS:' + encoded; dataEl.classList.remove('hidden'); }
  if (copyBtn) copyBtn.style.display = '';
}

function copyShareData() {
  const data = document.getElementById('qrShareData')?.textContent;
  if (!data) return;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(data).then(() => showToast('Dados copiados!', 'success'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = data;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Dados copiados!', 'success');
  }
}

// ---- Escanear QR Code ----
function startQRScan() {
  const scanArea = document.getElementById('qrScanArea');
  const video = document.getElementById('qrVideo');
  if (!scanArea || !video) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('Câmera não suportada neste dispositivo/navegador', 'warning');
    return;
  }

  scanArea.classList.remove('hidden');
  scanArea.classList.add('qr-scanning');

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      qrStream = stream;
      video.srcObject = stream;
      video.play();
      startQRDecode(video);
    })
    .catch(err => {
      showToast('Sem permissão para câmera: ' + err.message, 'error');
      scanArea.classList.add('hidden');
    });
}

function startQRDecode(video) {
  if (typeof window.jsQR === 'undefined') {
    showToast('Leitor de QR Code indisponível no momento. Abra o app com internet na primeira execução.', 'warning');
    stopQRScan();
    return;
  }
  const canvas = document.getElementById('qrCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  qrScanInterval = setInterval(() => {
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code && code.data) {
      clearInterval(qrScanInterval);
      stopQRScan();
      processQRData(code.data);
    }
  }, 300);
}

function stopQRScan() {
  if (qrScanInterval) { clearInterval(qrScanInterval); qrScanInterval = null; }
  if (qrStream) { qrStream.getTracks().forEach(t => t.stop()); qrStream = null; }
  const video = document.getElementById('qrVideo');
  if (video) { video.srcObject = null; }
  const scanArea = document.getElementById('qrScanArea');
  if (scanArea) { scanArea.classList.add('hidden'); scanArea.classList.remove('qr-scanning'); }
}

function importFromPaste() {
  const data = document.getElementById('pasteShareData')?.value.trim();
  if (!data) { showToast('Cole os dados antes de importar', 'warning'); return; }
  processQRData(data);
}

function processQRData(data) {
  if (!data.startsWith('MS:')) {
    showToast('Dados inválidos ou não são do MercadoSmart', 'error');
    return;
  }

  try {
    const encoded = data.slice(3);
    const decoded = decodeURIComponent(escape(atob(encoded)));
    const parsed = JSON.parse(decoded);

    if (parsed.type !== 'mercadosmart_list') throw new Error('Tipo inválido');

    const listData = parsed.list;
    const itemCount = listData.items?.length || 0;

    confirmAction(
      '📥 Importar Lista',
      `Recebido: "${listData.name}" com ${itemCount} itens.\nDeseja adicionar estes itens à sua lista atual?`,
      () => {
        const currentList = DB.getCurrentList();
        let added = 0;
        (listData.items || []).forEach(item => {
          DB.addItemToList({
            name: item.name,
            qty: item.qty || 1,
            price: item.price || DB.getAveragePrice(item.name) || 0,
            categoryId: item.categoryId || 'c10',
            note: item.note || '',
          });
          added++;
        });
        showToast(`${added} itens importados com sucesso!`, 'success');
        if (document.getElementById('pasteShareData')) document.getElementById('pasteShareData').value = '';
        switchPage('pageList');
      }
    );
  } catch (e) {
    showToast('Erro ao processar dados: ' + e.message, 'error');
  }
}

// ---- Backup e Restauração ----
function exportBackup() {
  const backupStatus = document.getElementById('backupStatus');
  try {
    const data = DB.exportAllData();
    const json = JSON.stringify(data, null, 2);
    const date = new Date().toISOString().split('T')[0];
    downloadFile(json, `mercadosmart_backup_${date}.json`);

    if (backupStatus) {
      backupStatus.className = 'backup-status success';
      backupStatus.textContent = '✅ Backup exportado com sucesso!';
      backupStatus.classList.remove('hidden');
      setTimeout(() => backupStatus.classList.add('hidden'), 3000);
    }
    showToast('Backup exportado!', 'success');
  } catch (e) {
    if (backupStatus) {
      backupStatus.className = 'backup-status error';
      backupStatus.textContent = '❌ Erro ao exportar: ' + e.message;
      backupStatus.classList.remove('hidden');
    }
    showToast('Erro ao exportar backup', 'error');
  }
}

function importBackup(input) {
  const file = input.files[0];
  const backupStatus = document.getElementById('backupStatus');
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      confirmAction(
        '📥 Importar Backup',
        'Todos os dados atuais serão substituídos pelo backup. Esta ação não pode ser desfeita. Continuar?',
        () => {
          DB.importAllData(data);
          if (backupStatus) {
            backupStatus.className = 'backup-status success';
            backupStatus.textContent = '✅ Backup importado! Reiniciando...';
            backupStatus.classList.remove('hidden');
          }
          showToast('Backup importado com sucesso!', 'success');
          setTimeout(() => location.reload(), 1500);
        }
      );
    } catch (err) {
      if (backupStatus) {
        backupStatus.className = 'backup-status error';
        backupStatus.textContent = '❌ Arquivo inválido: ' + err.message;
        backupStatus.classList.remove('hidden');
      }
      showToast('Arquivo de backup inválido', 'error');
    }
    input.value = '';
  };
  reader.readAsText(file);
}

// Populate share list select
function populateShareListSelect() {
  const select = document.getElementById('shareListSelect');
  if (!select) return;
  const purchases = DB.getPurchases().slice(0, 5);
  select.innerHTML = '<option value="current">Lista Atual</option>' +
    purchases.map(p => `<option value="${p.id}">${p.name || 'Compra'} (${formatDate(p.finalizedAt)})</option>`).join('');
}
