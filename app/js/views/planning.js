/**
 * CHIP — Planning Pomodoro view
 * Loads plan from Worker, renders blocks, manages timer
 */

const PlanningView = (() => {
  let plan = [];
  let activeBlockIndex = -1;
  let timerInterval = null;
  let timerSeconds = 25 * 60;
  let timerTotal = 25 * 60;
  let isBreak = false;
  let isPaused = false;
  let completedPomodoros = 0;

  function render(planData) {
    plan = planData;
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

      const tomatoes = Array(block.pomodoroCount)
        .fill('')
        .map((_, j) => `<div class="tomato${j < (block.completedPomodoros || 0) ? ' done' : ''}"></div>`)
        .join('');

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
        </div>
      `;

      container.appendChild(el);
    });

    // Event delegation
    container.onclick = (e) => {
      const startBtn = e.target.closest('.btn-start-block');
      const doneBtn = e.target.closest('.btn-done-block');
      if (startBtn) startBlock(parseInt(startBtn.dataset.index));
      if (doneBtn) doneBlock(parseInt(doneBtn.dataset.index));
    };
  }

  function startBlock(index) {
    activeBlockIndex = index;
    const block = plan[index];

    // Mark active in UI
    document.querySelectorAll('.pomodoro-block').forEach((el, i) => {
      el.classList.toggle('active', i === index);
    });

    showTimer(block.taskName, 25 * 60, false);
  }

  async function doneBlock(index) {
    const block = plan[index];
    plan[index] = { ...block, done: true };

    // Notify Worker to update Notion
    try {
      await window.CHIP_API.completeTask(block.taskId);
    } catch (e) {
      console.warn('[Planning] Could not sync to Notion:', e);
    }

    stopTimer();
    render(plan);
  }

  function showTimer(taskName, seconds, breakMode) {
    isBreak = breakMode;
    timerSeconds = seconds;
    timerTotal = seconds;
    isPaused = false;

    document.getElementById('timer-task-name').textContent = taskName;
    document.getElementById('timer-type').textContent = breakMode ? 'PAUSE' : 'FOCUS';
    document.getElementById('pomodoro-timer').classList.remove('hidden');

    updateTimerDisplay();
    startTimerTick();
  }

  function startTimerTick() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (isPaused) return;
      timerSeconds--;
      updateTimerDisplay();

      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        onTimerEnd();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
    const s = (timerSeconds % 60).toString().padStart(2, '0');
    document.getElementById('timer-display').textContent = `${m}:${s}`;

    const pct = ((timerTotal - timerSeconds) / timerTotal) * 100;
    document.getElementById('timer-progress-bar').style.width = `${pct}%`;
  }

  function onTimerEnd() {
    if (!isBreak) {
      completedPomodoros++;
      // Mark one tomato done in the plan
      if (activeBlockIndex >= 0) {
        const block = plan[activeBlockIndex];
        block.completedPomodoros = (block.completedPomodoros || 0) + 1;
        render(plan);
      }
      // Start 5-min break
      showTimer('Pause', 5 * 60, true);
    } else {
      // Break over — resume
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
    clearInterval(timerInterval);
    document.getElementById('pomodoro-timer').classList.add('hidden');
    activeBlockIndex = -1;
  }

  function initTimerControls() {
    document.getElementById('btn-pause').onclick = () => {
      isPaused = !isPaused;
      document.getElementById('btn-pause').textContent = isPaused ? '▶' : '⏸';
    };
    document.getElementById('btn-done-task').onclick = () => {
      if (activeBlockIndex >= 0) doneBlock(activeBlockIndex);
    };
    document.getElementById('btn-skip').onclick = () => {
      stopTimer();
    };
  }

  async function load() {
    const loading = document.getElementById('planning-loading');
    loading.classList.remove('hidden');
    document.getElementById('planning-blocks').innerHTML = '';
    document.getElementById('planning-empty').classList.add('hidden');

    try {
      const data = await window.CHIP_API.getPlanning();
      render(data.plan || []);
    } catch (e) {
      loading.classList.add('hidden');
      document.getElementById('planning-empty').classList.remove('hidden');
      document.getElementById('planning-empty').querySelector('p').textContent =
        'Erreur de connexion au Worker.';
    }
  }

  function init() {
    initTimerControls();
    document.getElementById('btn-refresh-plan').onclick = load;
  }

  return { init, load };
})();

window.PlanningView = PlanningView;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
