/**
 * CHIP — Sport / exercise guide view
 */

const SportView = (() => {
  const EXERCISES = [
    {
      name: 'Étirements cervicaux',
      desc: 'Inclinez lentement la tête de chaque côté. Maintenez 30 secondes. Répétez 3 fois.',
      img: null,
    },
    {
      name: 'Rotations épaules',
      desc: 'Cercles vers l\'avant puis vers l\'arrière. 10 répétitions de chaque côté.',
      img: null,
    },
    {
      name: 'Chat-vache',
      desc: 'À quatre pattes : dos arqué (chat) puis creusé (vache). Alternez en respirant. 10 cycles.',
      img: null,
    },
    {
      name: 'Planche',
      desc: 'Corps aligné, abdos contractés. Maintiens 20 secondes. 3 séries avec 10 sec de repos.',
      img: null,
    },
    {
      name: 'Squats',
      desc: 'Pieds écartés à largeur d\'épaules. Descends lentement, remonte. 3 × 10 répétitions.',
      img: null,
    },
    {
      name: 'Respiration profonde',
      desc: 'Inspire 4 sec, retiens 4 sec, expire 6 sec. 5 cycles complets.',
      img: null,
    },
  ];

  function render() {
    const container = document.getElementById('sport-content');
    container.innerHTML = EXERCISES.map((ex) => `
      <div class="sport-card">
        ${ex.img ? `<img src="${ex.img}" alt="${ex.name}" loading="lazy" />` : ''}
        <div class="sport-card-name">${ex.name}</div>
        <div class="sport-card-desc">${ex.desc}</div>
      </div>
    `).join('');
  }

  function init() {
    render();
  }

  return { init };
})();

window.SportView = SportView;
