/**
 * CHIP API client — fetch wrapper for the Cloudflare Worker
 */

const API = {
  get workerUrl() {
    return localStorage.getItem('chip_worker_url') ?? '';
  },

  async _request(path, options = {}) {
    const url = this.workerUrl + path;
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[CHIP API]', path, err);
      throw err;
    }
  },

  async health() {
    return this._request('/health');
  },

  async getPlanning() {
    return this._request('/planning', { method: 'POST', body: JSON.stringify({}) });
  },

  async completeTask(taskId) {
    return this._request('/planning', {
      method: 'POST',
      body: JSON.stringify({ action: 'complete', taskId }),
    });
  },

  async chat(messages) {
    return this._request('/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    });
  },

  async triggerMorning() {
    return this._request('/morning', { method: 'POST' });
  },
};

window.CHIP_API = API;
