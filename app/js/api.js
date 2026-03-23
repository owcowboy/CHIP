/**
 * CHIP API client — fetch wrapper for the Cloudflare Worker
 * - Reads Worker URL from Store
 * - 10s timeout via AbortController
 * - 1 automatic retry on network error (not on 4xx/5xx)
 */
const API = (() => {
  const TIMEOUT_MS = 10000;

  function getUrl() {
    return Store.get('workerUrl') || '';
  }

  async function _fetchOnce(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  async function _request(path, options = {}) {
    const url = getUrl() + path;
    const opts = { headers: { 'Content-Type': 'application/json' }, ...options };

    try {
      return await _fetchOnce(url, opts);
    } catch (err) {
      // Retry once only on network/abort errors, not on HTTP errors
      if (err.name === 'AbortError' || err.name === 'TypeError') {
        return await _fetchOnce(url, opts);
      }
      throw err;
    }
  }

  return {
    health() {
      return _request('/health');
    },
    getPlanning() {
      return _request('/planning', { method: 'POST', body: JSON.stringify({}) });
    },
    completeTask(taskId) {
      return _request('/planning', {
        method: 'POST',
        body: JSON.stringify({ action: 'complete', taskId }),
      });
    },
    chat(messages) {
      return _request('/chat', {
        method: 'POST',
        body: JSON.stringify({ messages }),
      });
    },
    triggerMorning() {
      return _request('/morning', { method: 'POST' });
    },
    dayEnd() {
      return _request('/day-end', { method: 'POST' });
    },
  };
})();
