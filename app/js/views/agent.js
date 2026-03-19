/**
 * CHIP — Agent chat view
 */

const AgentView = (() => {
  const STORAGE_KEY = 'chip_chat_history';
  const MAX_MESSAGES = 50;

  let messages = [];

  function loadHistory() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  }

  function saveHistory() {
    const trimmed = messages.slice(-MAX_MESSAGES);
    messages = trimmed;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }

  function appendMessage(role, text) {
    const container = document.getElementById('chat-messages');
    const isChip = role === 'assistant';

    const el = document.createElement('div');
    el.className = `chat-msg ${isChip ? 'chip-msg' : 'user-msg'}`;
    el.innerHTML = `
      <span class="msg-author">${isChip ? 'CHIP' : 'Toi'}</span>
      <span class="msg-text">${escapeHtml(text)}</span>
    `;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }

  function showTyping() {
    const container = document.getElementById('chat-messages');
    const el = document.createElement('div');
    el.className = 'chat-msg chip-msg typing';
    el.innerHTML = `<span class="msg-author">CHIP</span><span class="msg-text"></span>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }

  function clearHistory() {
    messages = [];
    localStorage.removeItem(STORAGE_KEY);
    const container = document.getElementById('chat-messages');
    container.innerHTML = `
      <div class="chat-msg chip-msg">
        <span class="msg-author">CHIP</span>
        <span class="msg-text">Prêt. Dis-moi ce dont tu as besoin.</span>
      </div>`;
  }

  async function send() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    appendMessage('user', text);
    messages.push({ role: 'user', content: text });
    saveHistory();

    const typing = showTyping();
    document.getElementById('agent-status').textContent = '◌';

    try {
      const data = await window.CHIP_API.chat(messages);
      typing.remove();
      const reply = data.reply || 'Pas de réponse.';
      appendMessage('assistant', reply);
      messages.push({ role: 'assistant', content: reply });
      saveHistory();
    } catch (e) {
      typing.remove();
      appendMessage('assistant', 'Erreur de connexion. Vérifie que le Worker tourne.');
    } finally {
      document.getElementById('agent-status').textContent = '●';
    }
  }

  function init() {
    // Restore conversation history from localStorage
    messages = loadHistory();
    if (messages.length > 0) {
      const container = document.getElementById('chat-messages');
      container.innerHTML = '';
      messages.forEach(m => appendMessage(m.role, m.content));
    }

    document.getElementById('btn-send').onclick = send;
    document.getElementById('btn-clear').onclick = clearHistory;
    document.getElementById('chat-input').onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    };
  }

  return { init };
})();

window.AgentView = AgentView;
