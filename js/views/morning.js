/**
 * CHIP — Morning routine view
 */
const MorningView = (() => {
  const EXERCISES = [
    { icon: '🧘', name: 'Étirements cervicaux', reps: '30 sec × 3' },
    { icon: '🌀', name: 'Rotations épaules', reps: '10 × chaque côté' },
    { icon: '🤸', name: 'Chat-vache (yoga)', reps: '10 cycles' },
    { icon: '💪', name: 'Planches', reps: '3 × 20 sec' },
    { icon: '🦵', name: 'Squats', reps: '3 × 10' },
    { icon: '🌬️', name: 'Respiration profonde', reps: '5 cycles' },
  ];

  function render() {
    const list = document.getElementById('exercise-list');
    if (!list) return;
    list.innerHTML = EXERCISES.map((ex) => `
      <div class="exercise-item">
        <span class="exercise-icon">${ex.icon}</span>
        <span class="exercise-name">${ex.name}</span>
        <span class="exercise-reps">${ex.reps}</span>
      </div>`).join('');
  }

  function openPlaylist() {
    const url = Store.get('playlistUrl');
    if (url) {
      window.open(url, '_blank');
    } else {
      const entered = prompt('URL de ta playlist (Spotify, YouTube...) :');
      if (entered && entered.trim()) {
        Store.set('playlistUrl', entered.trim());
        window.open(entered.trim(), '_blank');
      }
    }
  }

  function init() {
    render();

    document.getElementById('btn-start-sport')?.addEventListener('click', () => {
      openPlaylist();
      ChipApp.navigate('sport');
    });

    document.getElementById('btn-open-playlist')?.addEventListener('click', openPlaylist);
  }

  return { init };
})();
