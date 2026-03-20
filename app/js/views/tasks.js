/**
 * CHIP — Tasks list view
 * Loads its own data from the Worker (independent from planning view).
 * Also listens to Store for updates pushed by planning view.
 */
const TasksView = (() => {
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function render(tasks) {
    const list = document.getElementById('task-list');
    const count = document.getElementById('task-count');
    if (!list) return;

    if (!tasks || tasks.length === 0) {
      list.innerHTML = '<p class="text-dim" style="padding:20px;font-size:8px">Aucune tâche pour aujourd\'hui.</p>';
      if (count) count.textContent = '0';
      return;
    }

    const active = tasks.filter((t) => !t.done).length;
    if (count) count.textContent = active;

    list.innerHTML = tasks.map((t) => `
      <div class="task-item${t.done ? ' done' : ''}" data-id="${escapeHtml(t.taskId || t.id || '')}">
        <div class="task-checkbox">${t.done ? '✓' : ''}</div>
        <div>
          <div class="task-text">${escapeHtml(t.taskName || t.name || 'Tâche')}</div>
          <div class="task-meta">${t.estimatedMinutes || 25}min · priorité ${t.priority || 2}</div>
        </div>
      </div>`).join('');

    list.onclick = async (e) => {
      const item = e.target.closest('.task-item');
      if (!item || item.classList.contains('done')) return;
      const taskId = item.dataset.id;
      if (!taskId) return;

      item.classList.add('done');
      item.querySelector('.task-checkbox').textContent = '✓';
      if (count) count.textContent = Math.max(0, parseInt(count.textContent || '0') - 1);

      try {
        await API.completeTask(taskId);
      } catch {
        // Best-effort sync
      }
    };
  }

  async function load() {
    // Use cached tasks from store if available (set by planning view)
    const cached = Store.get('tasks');
    if (cached && cached.length > 0) {
      render(cached);
      return;
    }
    // Otherwise fetch independently
    try {
      const data = await API.getPlanning();
      const tasks = (data.plan || []).map((b) => ({
        id: b.taskId, taskId: b.taskId, name: b.taskName, taskName: b.taskName,
        done: b.done, estimatedMinutes: b.estimatedMinutes, priority: b.priority,
      }));
      Store.set('tasks', tasks);
      render(tasks);
    } catch {
      render([]);
    }
  }

  function init() {
    // Re-render whenever planning updates the task list
    Store.on('tasks', render);
  }

  return { init, load, render };
})();
