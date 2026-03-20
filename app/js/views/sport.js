/**
 * CHIP — Sport / exercise guide view
 */
const SportView = (() => {
  const EXERCISES = [
    {
      name: 'Étirements cervicaux',
      desc: 'Inclinez lentement la tête de chaque côté. Maintenez 30 secondes. Répétez 3 fois.',
    },
    {
      name: 'Rotations épaules',
      desc: "Cercles vers l'avant puis vers l'arrière. 10 répétitions de chaque côté.",
    },
    {
      name: 'Chat-vache',
      desc: "À quatre pattes : dos arqué (chat) puis creusé (vache). Alternez en respirant. 10 cycles.",
    },
    {
      name: 'Planche',
      desc: 'Corps aligné, abdos contractés. Maintiens 20 secondes. 3 séries avec 10 sec de repos.',
    },
    {
      name: 'Squats',
      desc: "Pieds écartés à largeur d'épaules. Descends lentement, remonte. 3 × 10 répétitions.",
    },
    {
      name: 'Respiration profonde',
      desc: 'Inspire 4 sec, retiens 4 sec, expire 6 sec. 5 cycles complets.',
    },
  ];

  function render() {
    const container = document.getElementById('sport-content');
    if (!container) return;
    container.innerHTML = EXERCISES.map((ex) => `
      <div class="sport-card">
        <div class="sport-card-name">${ex.name}</div>
        <div class="sport-card-desc">${ex.desc}</div>
      </div>`).join('');
  }

  function init() {
    render();
  }

  return { init };
})();
