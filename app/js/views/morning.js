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

  const SPOTIFY_PLAYLIST_URL = localStorage.getItem('chip_playlist_url') || '';

  function render() {
    const list = document.getElementById('exercise-list');
    list.innerHTML = EXERCISES.map((ex) => `
      <div class="exercise-item">
        <span class="exercise-icon">${ex.icon}</span>
        <span class="exercise-name">${ex.name}</span>
        <span class="exercise-reps">${ex.reps}</span>
      </div>
    `).join('');
  }

  function init() {
    render();

    document.getElementById('btn-start-sport').onclick = () => {
      const playlist = localStorage.getItem('chip_playlist_url');
      if (playlist) window.open(playlist, '_blank');
      window.ChipApp.navigate('sport');
    };

    document.getElementById('btn-open-playlist').onclick = () => {
      const playlist = localStorage.getItem('chip_playlist_url');
      if (playlist) {
        window.open(playlist, '_blank');
      } else {
        alert('Configure ton URL playlist dans les paramètres.');
      }
    };
  }

  return { init };
})();

window.MorningView = MorningView;
