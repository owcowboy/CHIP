/**
 * CHIP — Tasks list view (read from cached plan)
 */

const TasksView = (() => {
  function render(tasks) {
    const list = document.getElementById('task-list');
    const count = document.getElementById('task-count');

    if (!tasks || tasks.length === 0) {
      list.innerHTML = '<p class="text-dim" style="padding:20px;font-size:8px">Aucune tâche. Lance le planning d\'abord.</p>';
      count.textContent = '0';
      return;
    }

    count.textContent = tasks.filter((t) => !t.done).length;
    list.innerHTML = tasks.map((t) => `
      <div class="task-item${t.done ? ' done' : ''}" data-id="${t.taskId || t.id || ''}">
        <div class="task-checkbox">${t.done ? '✓' : ''}</div>
        <div>
          <div class="task-text">${escapeHtml(t.taskName || t.title || 'Tâche')}</div>
          <div class="task-meta">${t.estimatedMinutes || 25}min · priorité ${t.priority || 2}</div>
        </div>
      </div>
    `).join('');

    list.onclick = async (e) => {
      const item = e.target.closest('.task-item');
      if (!item || item.classList.contains('done')) return;
      const taskId = item.dataset.id;
      if (!taskId) return;

      item.classList.add('done');
      item.querySelector('.task-checkbox').textContent = '✓';
      count.textContent = Math.max(0, parseInt(count.textContent) - 1);

      try {
        await window.CHIP_API.completeTask(taskId);
      } catch (e) {
        console.warn('[Tasks] Sync failed:', e);
      }
    };
  }

  function init() {
    // Tasks are populated by app.js after plan loads
  }

  return { init, render };
})();

window.TasksView = TasksView;
