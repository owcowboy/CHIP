/**
 * CHIP — Planning Pomodoro view
 * Loads plan from Worker, renders blocks, manages timer (timestamp-based, no drift)
 */
const PlanningView = (() => {
  let plan = [];
  let activeBlockIndex = -1;
  let timerEnd = null;        // timestamp when current session ends
  let timerTotal = 25 * 60;  // seconds
  let isBreak = false;
  let isPaused = false;
  let pausedRemaining = 0;
  let rafId = null;

  // ---- Utilities ----
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function vibrate() {
    if (navigator.vibrate) navigator.vibrate(300);
  }

  // ---- Render ----
  function render(planData) {
    plan = planData;
    Store.set('tasks', plan.map((b) => ({ id: b.taskId, name: b.taskName, done: b.done, estimatedMinutes: b.estimatedMinutes, priority: b.priority })));

    const container = document.getElementById('planning-blocks');
    const loading = document.getElementById('planning-loading');
    const empty = document.getElementById('planning-empty');

    loading.classList.add('hidden');

    if (!plan || plan.length === 0) {
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    container.innerHTML = '';

    plan.forEach((block, i) => {
      const el = document.createElement('div');
      el.className = `pomodoro-block priority-${block.priority}${block.done ? ' done' : ''}`;
      el.dataset.index = i;

      const tomatoes = Array(block.pomodoroCount).fill('').map((_, j) =>
        `<div class="tomato${j < (block.completedPomodoros || 0) ? ' done' : ''}"></div>`
      ).join('');

      el.innerHTML = `
        <div class="block-title">${escapeHtml(block.taskName)}</div>
        <div class="block-meta">
          <div class="block-pomodoros">${tomatoes}</div>
          <span class="block-time">~${block.estimatedMinutes}min</span>
        </div>
        ${block.notes ? `<div class="block-notes">${escapeHtml(block.notes)}</div>` : ''}
        <div class="block-actions">
          ${!block.done ? `<button class="btn-start-block" data-index="${i}">▶</button>` : ''}
          ${!block.done ? `<button class="btn-done-block" data-index="${i}">✓</button>` : ''}
        </div>`;

      container.appendChild(el);
    });

    container.onclick = (e) => {
      const startBtn = e.target.closest('.btn-start-block');
      const doneBtn = e.target.closest('.btn-done-block');
      if (startBtn) startBlock(parseInt(startBtn.dataset.index));
      if (doneBtn) doneBlock(parseInt(doneBtn.dataset.index));
    };
  }

  // ---- Block actions ----
  function startBlock(index) {
    activeBlockIndex = index;
    document.querySelectorAll('.pomodoro-block').forEach((el, i) => {
      el.classList.toggle('active', i === index);
    });
    showTimer(plan[index].taskName, 25 * 60, false);
  }

  async function doneBlock(index) {
    const block = plan[index];
    plan[index] = { ...block, done: true };
    try {
      await API.completeTask(block.taskId);
    } catch {
      // UI already updated; Notion sync best-effort
    }
    stopTimer();
    render(plan);
  }

  // ---- Timer (timestamp-based) ----
  function showTimer(taskName, seconds, breakMode) {
    isBreak = breakMode;
    timerTotal = seconds;
    isPaused = false;
    pausedRemaining = 0;
    timerEnd = Date.now() + seconds * 1000;

    document.getElementById('timer-task-name').textContent = taskName;
    document.getElementById('timer-type').textContent = breakMode ? 'PAUSE' : 'FOCUS';
    document.getElementById('btn-pause').textContent = '⏸';
    document.getElementById('pomodoro-timer').classList.remove('hidden');

    cancelAnimationFrame(rafId);
    tick();
  }

  function tick() {
    if (isPaused) return;

    const remaining = Math.max(0, Math.round((timerEnd - Date.now()) / 1000));
    updateTimerDisplay(remaining);

    if (remaining <= 0) {
      onTimerEnd();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function updateTimerDisplay(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    document.getElementById('timer-display').textContent = `${m}:${s}`;
    const elapsed = timerTotal - seconds;
    const pct = (elapsed / timerTotal) * 100;
    document.getElementById('timer-progress-bar').style.width = `${pct}%`;
  }

  function onTimerEnd() {
    vibrate();
    if (!isBreak) {
      if (activeBlockIndex >= 0) {
        const block = plan[activeBlockIndex];
        block.completedPomodoros = (block.completedPomodoros || 0) + 1;
        render(plan);
      }
      showTimer('Pause', 5 * 60, true);
    } else {
      stopTimer();
      if (activeBlockIndex >= 0) {
        const block = plan[activeBlockIndex];
        if ((block.completedPomodoros || 0) < block.pomodoroCount) {
          showTimer(block.taskName, 25 * 60, false);
        }
      }
    }
  }

  function stopTimer() {
    cancelAnimationFrame(rafId);
    document.getElementById('pomodoro-timer').classList.add('hidden');
    activeBlockIndex = -1;
    timerEnd = null;
  }

  function initTimerControls() {
    document.getElementById('btn-pause')?.addEventListener('click', () => {
      if (!timerEnd && !isPaused) return;
      isPaused = !isPaused;
      document.getElementById('btn-pause').textContent = isPaused ? '▶' : '⏸';
      if (!isPaused) {
        // Resume: recompute end time
        timerEnd = Date.now() + pausedRemaining * 1000;
        tick();
      } else {
        pausedRemaining = Math.max(0, Math.round((timerEnd - Date.now()) / 1000));
        cancelAnimationFrame(rafId);
      }
    });

    document.getElementById('btn-done-task')?.addEventListener('click', () => {
      if (activeBlockIndex >= 0) doneBlock(activeBlockIndex);
    });

    document.getElementById('btn-skip')?.addEventListener('click', () => {
      stopTimer();
    });
  }

  // ---- Load ----
  async function load() {
    const loading = document.getElementById('planning-loading');
    const empty = document.getElementById('planning-empty');
    loading.classList.remove('hidden');
    document.getElementById('planning-blocks').innerHTML = '';
    empty.classList.add('hidden');

    try {
      const data = await API.getPlanning();
      render(data.plan || []);
    } catch {
      loading.classList.add('hidden');
      empty.classList.remove('hidden');
      const p = empty.querySelector('p');
      if (p) p.textContent = 'Erreur de connexion au Worker.';
    }
  }

  function init() {
    initTimerControls();
    document.getElementById('btn-refresh-plan')?.addEventListener('click', load);
  }

  return { init, load };
})();
