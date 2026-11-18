(() => {
  const storageKey = 'df_privacy';
  const version = 1;
  const lifetime = 180 * 86400000;
  const banner = document.querySelector('#privacy-banner');
  const dialog = document.querySelector('#privacy-dialog');
  const privacyControls = document.querySelectorAll('[data-privacy-open]');
  const players = document.querySelectorAll('[data-media-player]');
  const analyticsInput = document.querySelector('#privacy-analytics');
  const mediaInput = document.querySelector('#privacy-media');
  let choice = readChoice();
  let analyticsScript;
  let opener;

  function readChoice() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey));
      if (value?.version === version && Date.now() < value.expires &&
          typeof value.analytics === 'boolean' && typeof value.media === 'boolean') return value;
    } catch {
      // Visitors can still choose for the current page when storage is unavailable.
    }
    return null;
  }

  function analyticsAllowed() {
    return choice?.analytics === true && Date.now() < choice.expires &&
      navigator.globalPrivacyControl !== true && navigator.doNotTrack !== '1';
  }
  window.darkFeelAnalyticsAllowed = analyticsAllowed;

  function applyChoice() {
    banner.hidden = !!choice;
    for (const player of players) {
      const placeholder = player.querySelector('[data-media-placeholder]');
      const existing = player.querySelector('iframe');
      if (choice?.media && !existing) {
        player.append(player.querySelector('template').content.cloneNode(true));
      } else if (!choice?.media) {
        existing?.remove();
      }
      placeholder.hidden = !!choice?.media;
    }
    if (analyticsAllowed()) {
      if (!analyticsScript) {
        analyticsScript = document.createElement('script');
        analyticsScript.src = '/analytics.js?v=2';
        document.head.append(analyticsScript);
      }
    } else {
      try {
        localStorage.removeItem('df_visitor');
        sessionStorage.removeItem('df_session');
      } catch {}
      window.dispatchEvent(new Event('darkfeel-analytics-reset'));
    }
  }

  function save(analytics, media) {
    choice = { version, expires: Date.now() + lifetime, analytics, media };
    try { localStorage.setItem(storageKey, JSON.stringify(choice)); } catch {}
    if (dialog.open) dialog.close();
    applyChoice();
    if (analyticsAllowed()) window.dispatchEvent(new Event('darkfeel-analytics-enable'));
  }

  function openSettings(event) {
    opener = event?.currentTarget;
    analyticsInput.checked = !!choice?.analytics;
    mediaInput.checked = !!choice?.media;
    if (!dialog.open) dialog.showModal();
  }

  for (const control of privacyControls) control.addEventListener('click', openSettings);
  for (const control of document.querySelectorAll('[data-privacy-accept]')) {
    control.addEventListener('click', () => save(true, true));
  }
  for (const control of document.querySelectorAll('[data-privacy-reject]')) {
    control.addEventListener('click', () => save(false, false));
  }
  document.querySelector('#privacy-form').addEventListener('submit', event => {
    event.preventDefault();
    save(analyticsInput.checked, mediaInput.checked);
  });
  document.querySelector('#privacy-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (opener && !opener.closest('[hidden]')) opener.focus();
    else document.querySelector('#privacy-footer-settings').focus();
  });
  addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    choice = readChoice();
    applyChoice();
    if (analyticsAllowed()) window.dispatchEvent(new Event('darkfeel-analytics-enable'));
  });

  applyChoice();
  if (new URLSearchParams(location.search).get('privacy') === 'settings') openSettings();
})();
