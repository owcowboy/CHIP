/**
 * CHIP — Agent chat view
 */

const AgentView = (() => {
  let messages = []; // conversation history

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

  async function send() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    appendMessage('user', text);
    messages.push({ role: 'user', content: text });

    const typing = showTyping();
    document.getElementById('agent-status').textContent = '◌';

    try {
      const data = await window.CHIP_API.chat(messages);
      typing.remove();
      const reply = data.reply || 'Pas de réponse.';
      appendMessage('assistant', reply);
      messages.push({ role: 'assistant', content: reply });
    } catch (e) {
      typing.remove();
      appendMessage('assistant', 'Erreur de connexion. Vérifie que le Worker tourne.');
    } finally {
      document.getElementById('agent-status').textContent = '●';
    }
  }

  function init() {
    document.getElementById('btn-send').onclick = send;
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
