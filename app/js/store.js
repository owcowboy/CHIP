/**
 * CHIP — Central state store
 * Simple pub/sub store. All views read/write state here.
 */
const Store = (() => {
  const state = {
    workerUrl: localStorage.getItem('workerUrl') || null,
    playlistUrl: localStorage.getItem('playlistUrl') || null,
    tasks: [],
  };

  const listeners = {};

  function on(key, fn) {
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(fn);
  }

  function off(key, fn) {
    if (!listeners[key]) return;
    listeners[key] = listeners[key].filter((f) => f !== fn);
  }

  function set(key, value) {
    state[key] = value;
    // Persist certain keys to localStorage
    if (key === 'workerUrl') {
      if (value) localStorage.setItem('workerUrl', value);
      else localStorage.removeItem('workerUrl');
    }
    if (key === 'playlistUrl') {
      if (value) localStorage.setItem('playlistUrl', value);
      else localStorage.removeItem('playlistUrl');
    }
    if (listeners[key]) listeners[key].forEach((fn) => fn(value));
  }

  function get(key) {
    return state[key];
  }

  return { on, off, set, get };
})();
