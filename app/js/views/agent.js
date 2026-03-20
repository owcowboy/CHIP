/**
 * CHIP — Agent chat view
 */
const AgentView = (() => {
  const STORAGE_KEY = 'chip_chat_history';
  const MAX_MESSAGES = 50;

  let messages = [];
  let sending = false;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

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
    el.innerHTML = `<span class="msg-author">${isChip ? 'CHIP' : 'MOI'}</span><span class="msg-text">${escapeHtml(text)}</span>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }

  function showTyping() {
    const container = document.getElementById('chat-messages');
    const el = document.createElement('div');
    el.id = 'typing-indicator';
    el.className = 'chat-msg chip-msg typing';
    el.innerHTML = `<span class="msg-author">CHIP</span><span class="msg-text"><span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></span>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    document.getElementById('typing-indicator')?.remove();
  }

  function setStatus(active) {
    const dot = document.getElementById('agent-status');
    if (dot) dot.textContent = active ? '●' : '◌';
  }

  function clearHistory() {
    messages = [];
    localStorage.removeItem(STORAGE_KEY);
    const container = document.getElementById('chat-messages');
    container.innerHTML = `<div class="chat-msg chip-msg">
      <span class="msg-author">CHIP</span>
      <span class="msg-text">Prêt. Dis-moi ce dont tu as besoin.</span>
    </div>`;
  }

  async function send() {
    if (sending) return;
    const input = document.getElementById('chat-input');
    const text = (input?.value || '').trim();
    if (!text) return;

    input.value = '';
    appendMessage('user', text);
    messages.push({ role: 'user', content: text });
    saveHistory();

    sending = true;
    setStatus(false);
    showTyping();

    try {
      const data = await API.chat(messages);
      hideTyping();
      const reply = data.reply || 'Pas de réponse.';
      appendMessage('assistant', reply);
      messages.push({ role: 'assistant', content: reply });
      saveHistory();
      setStatus(true);
    } catch {
      hideTyping();
      appendMessage('assistant', 'Erreur de connexion. Vérifie que le Worker tourne.');
      setStatus(false);
    } finally {
      sending = false;
    }
  }

  function init() {
    messages = loadHistory();
    if (messages.length > 0) {
      const container = document.getElementById('chat-messages');
      container.innerHTML = '';
      messages.forEach((m) => appendMessage(m.role, m.content));
    }

    document.getElementById('btn-send')?.addEventListener('click', send);
    document.getElementById('btn-clear')?.addEventListener('click', clearHistory);
    document.getElementById('chat-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });

    setStatus(true);
  }

  return { init };
})();
