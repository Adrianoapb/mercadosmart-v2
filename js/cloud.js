/* MercadoSmart Cloud bootstrap */
window.addEventListener('online', () => {
  try {
    if (DB.getSettings().cloudAutoSync !== false) {
      DB.CloudSync.syncSmart({ silent: true }).catch(() => {});
    }
  } catch (e) {}
});
