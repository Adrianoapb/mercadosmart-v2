/* MercadoSmart Cloud bootstrap */
window.addEventListener('online', () => {
  try {
    if (DB.getSettings().cloudAutoSync !== false) {
      DB.CloudSync.syncSmart({ silent: true }).catch(() => {});
    }
  } catch (e) { console.debug('Falha não crítica ao iniciar experiência de nuvem', e); }
});
