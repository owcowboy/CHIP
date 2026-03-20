/**
 * CHIP — Main app orchestrator
 * Handles: boot, setup, navigation, PWA install
 */
const ChipApp = (() => {
  const VIEW_LABELS = {
    planning: 'Planning',
    morning: 'Matin',
    tasks: 'Tâches',
    sport: 'Sport',
    agent: 'CHIP',
  };

  let currentView = null;

  // ---- Boot sequence ----
  async function boot() {
    const statusEl = document.getElementById('boot-status');

    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/CHIP/sw.js');
        statusEl.textContent = 'Service Worker OK';
      } catch {
        statusEl.textContent = 'Mode offline limité';
      }
    }

    const workerUrl = Store.get('workerUrl');

    if (!workerUrl) {
      statusEl.textContent = 'Configuration requise';
      hideBoot();
      showSetup();
      return;
    }

    statusEl.textContent = 'Connexion Worker...';
    const connected = await checkConnection();
    if (!connected) statusEl.textContent = 'Worker hors ligne';

    hideBoot();
    showApp();
  }

  async function checkConnection() {
    try {
      const data = await API.health();
      setStatusDot(data.status === 'ok' ? 'connected' : 'error');
      return true;
    } catch {
      setStatusDot('error');
      return false;
    }
  }

  function hideBoot() {
    const boot = document.getElementById('boot-screen');
    boot.classList.add('fade-out');
    setTimeout(() => boot.classList.add('hidden'), 400);
  }

  function showSetup() {
    document.getElementById('setup-screen').classList.remove('hidden');

    document.getElementById('save-config').addEventListener('click', async () => {
      const url = document.getElementById('worker-url').value.trim().replace(/\/$/, '');
      if (!url) return;

      Store.set('workerUrl', url);

      const btn = document.getElementById('save-config');
      btn.textContent = 'Connexion...';
      btn.disabled = true;

      const ok = await checkConnection();
      if (ok) {
        document.getElementById('setup-screen').classList.add('hidden');
        showApp();
      } else {
        btn.textContent = '✗ Échec — réessaie';
        btn.disabled = false;
        setTimeout(() => (btn.textContent = 'Connecter CHIP'), 2000);
      }
    });
  }

  function showApp() {
    document.getElementById('app').classList.remove('hidden');
    initViews();
    initNav();
    const lastView = localStorage.getItem('chip_last_view') || 'planning';
    navigate(lastView);
    showInstallBanner();
  }

  // ---- Views ----
  function initViews() {
    PlanningView.init();
    MorningView.init();
    TasksView.init();
    SportView.init();
    AgentView.init();
  }

  function navigate(viewName) {
    if (currentView === viewName) return;

    if (currentView) {
      document.getElementById(`view-${currentView}`)?.classList.remove('active');
      document.querySelector(`.nav-btn[data-view="${currentView}"]`)?.classList.remove('active');
    }

    currentView = viewName;
    localStorage.setItem('chip_last_view', viewName);

    document.getElementById(`view-${viewName}`)?.classList.add('active');
    document.querySelector(`.nav-btn[data-view="${viewName}"]`)?.classList.add('active');
    document.getElementById('topbar-title').textContent = VIEW_LABELS[viewName] ?? viewName;

    if (viewName === 'planning') PlanningView.load();
    if (viewName === 'tasks') TasksView.load();
  }

  function initNav() {
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => navigate(btn.dataset.view));
    });
  }

  // ---- PWA install banner ----
  function showInstallBanner() {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = localStorage.getItem('chip_install_dismissed');

    if (isIos && !isInstalled && !dismissed) {
      setTimeout(() => {
        document.getElementById('install-banner')?.classList.remove('hidden');
      }, 3000);
      document.getElementById('install-dismiss')?.addEventListener('click', () => {
        document.getElementById('install-banner')?.classList.add('hidden');
        localStorage.setItem('chip_install_dismissed', '1');
      });
    }
  }

  // ---- Status dot ----
  function setStatusDot(state) {
    const dot = document.getElementById('status-dot');
    if (dot) dot.className = `status-dot ${state}`;
  }

  document.addEventListener('DOMContentLoaded', boot);

  return { navigate, setStatusDot, checkConnection };
})();
