(() => {
  const storageKey = 'df_privacy';
  const version = 1;
  const lifetime = 180 * 86400000;
  const banner = document.querySelector('#privacy-banner');
  const settings = document.querySelector('#privacy-footer-settings');
  const accept = banner.querySelector('[data-privacy-accept]');
  const reject = banner.querySelector('[data-privacy-reject]');
  let choice = readChoice();
  let analyticsScript;

  function readChoice() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey));
      if (value?.version === version && Date.now() < value.expires &&
          typeof value.analytics === 'boolean') return value;
    } catch {
      // The choice still applies to this page when browser storage is unavailable.
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
    if (analyticsAllowed()) {
      if (analyticsScript) {
        window.dispatchEvent(new Event('darkfeel-analytics-enable'));
      } else {
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

  function save(analytics) {
    choice = { version, expires: Date.now() + lifetime, analytics };
    try { localStorage.setItem(storageKey, JSON.stringify(choice)); } catch {}
    applyChoice();
    settings.focus({ preventScroll: true });
  }

  function openSettings() {
    banner.hidden = false;
    (choice?.analytics ? accept : reject).focus({ preventScroll: true });
  }

  accept.addEventListener('click', () => save(true));
  reject.addEventListener('click', () => save(false));
  settings.addEventListener('click', openSettings);
  addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    choice = readChoice();
    applyChoice();
  });

  applyChoice();
  if (new URLSearchParams(location.search).get('privacy') === 'settings') openSettings();
})();
