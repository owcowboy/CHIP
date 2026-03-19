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

  let currentView = 'planning';

  // ---- Boot sequence ----
  async function boot() {
    const statusEl = document.getElementById('boot-status');

    statusEl.textContent = 'Chargement...';
    await sleep(500);

    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js');
        statusEl.textContent = 'Service Worker OK';
      } catch (e) {
        statusEl.textContent = 'Mode offline limité';
      }
    }

    await sleep(600);

    const workerUrl = localStorage.getItem('chip_worker_url');

    if (!workerUrl) {
      statusEl.textContent = 'Configuration requise';
      await sleep(400);
      hideBoot();
      showSetup();
      return;
    }

    statusEl.textContent = 'Connexion Worker...';
    const connected = await checkConnection();

    await sleep(300);
    hideBoot();

    if (connected) {
      showApp();
    } else {
      // Show app anyway — might be offline
      showApp();
    }
  }

  async function checkConnection() {
    try {
      const data = await window.CHIP_API.health();
      setStatusDot(data.status === 'ok' ? 'connected' : 'error');
      return true;
    } catch {
      setStatusDot('error');
      return false;
    }
  }

  function hideBoot() {
    const boot = document.getElementById('boot-screen');
    boot.style.opacity = '0';
    setTimeout(() => boot.classList.add('hidden'), 500);
  }

  function showSetup() {
    document.getElementById('setup-screen').classList.remove('hidden');

    document.getElementById('save-config').onclick = async () => {
      const url = document.getElementById('worker-url').value.trim().replace(/\/$/, '');
      if (!url) return;

      localStorage.setItem('chip_worker_url', url);

      const btn = document.getElementById('save-config');
      btn.textContent = 'Connexion...';

      const ok = await checkConnection();
      if (ok) {
        document.getElementById('setup-screen').classList.add('hidden');
        showApp();
      } else {
        btn.textContent = '✗ Échec — réessaie';
        setTimeout(() => (btn.textContent = 'Connecter CHIP'), 2000);
      }
    };
  }

  function showApp() {
    document.getElementById('app').classList.remove('hidden');
    initViews();
    initNav();
    navigate('planning');
    showInstallBanner();
  }

  // ---- Views ----
  function initViews() {
    window.PlanningView.init();
    window.MorningView.init();
    window.TasksView.init();
    window.SportView.init();
    window.AgentView.init();
  }

  function navigate(viewName) {
    if (currentView === viewName) return;

    // Hide current
    document.getElementById(`view-${currentView}`)?.classList.remove('active');
    document.querySelector(`.nav-btn[data-view="${currentView}"]`)?.classList.remove('active');

    currentView = viewName;

    // Show new
    document.getElementById(`view-${viewName}`)?.classList.add('active');
    document.querySelector(`.nav-btn[data-view="${viewName}"]`)?.classList.add('active');
    document.getElementById('topbar-title').textContent = VIEW_LABELS[viewName] ?? viewName;

    // Lazy load data when switching to planning
    if (viewName === 'planning') {
      window.PlanningView.load();
    }
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
        document.getElementById('install-banner').classList.remove('hidden');
      }, 3000);

      document.getElementById('install-dismiss').onclick = () => {
        document.getElementById('install-banner').classList.add('hidden');
        localStorage.setItem('chip_install_dismissed', '1');
      };
    }
  }

  // ---- Status dot ----
  function setStatusDot(state) {
    const dot = document.getElementById('status-dot');
    dot.className = `status-dot ${state}`;
  }

  // ---- Utils ----
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ---- Start ----
  document.addEventListener('DOMContentLoaded', boot);

  return { navigate, setStatusDot, checkConnection };
})();

window.ChipApp = ChipApp;
