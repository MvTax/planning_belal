// Icônes (traits arrondis, 24×24) — utilisables en HTML ou en composant
export const ICONES = {
  travail: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  repos: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  conge: '<circle cx="12" cy="12" r="3.6"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M6 18l1.4-1.4M16.6 7.4L18 6"/>',
  ecole: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14 2.5 9.5zM6.5 12v4.2c0 1.2 2.4 2.8 5.5 2.8s5.5-1.6 5.5-2.8V12"/>',
  maladie: '<path d="M12 5.5v13M5.5 12h13"/>',
  absent: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  bas: '<path d="M6 9l6 6 6-6"/>',
  droite: '<path d="M9 6l6 6-6 6"/>',
  gauche: '<path d="M15 6l-6 6 6 6"/>',
  cal: '<path d="M7.5 3v3M16.5 3v3M4 9.5h16M5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5z"/><path d="M8.5 13.5h.01M12 13.5h.01M15.5 13.5h.01M8.5 16.5h.01M12 16.5h.01" stroke-width="2.6"/>',
  euro: '<path d="M17.5 7.2a6.2 6.2 0 1 0 0 9.6M5.5 10.4h8M5.5 13.6h8"/>',
  imprimer: '<path d="M7 8V4h10v4M7 16H5.2A1.2 1.2 0 0 1 4 14.8V10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4.8a1.2 1.2 0 0 1-1.2 1.2H17M7 13.5h10V20H7z"/>',
  reglages: '<path d="M4 8h6M14 8h6M4 16h9M17 16h3"/><circle cx="12" cy="8" r="2"/><circle cx="15" cy="16" r="2"/>',
  doc: '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5"/>',
  fleche: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  note: '<path d="M5 4h10l4 4v12H5zM14 4v5h5"/><path d="M8.5 13h7M8.5 16.5h5"/>',
  utilisateur: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.6-3.6 3.5-5.5 7-5.5s6.4 1.9 7 5.5"/>',
};
export const svgStr = (n, extra = "") =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${ICONES[n] || ""}</svg>`;
