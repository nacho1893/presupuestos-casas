// Presupuestos Casas · arranque: carga los datos, la interfaz y el visor 3D
const datos = await (await fetch('data/modelos.json')).json();
window.APP_DATA = datos;
window.PLANOS = Object.fromEntries(datos.modelos.map(m => [m.id, 'img/planos/' + m.id + '.png']));
await import('./app.js');
try {
  const { createViewer } = await import('./visor3d.js');
  window.__createViewer = createViewer;
  window.dispatchEvent(new Event('v3d-ready'));
} catch (e) { console.warn('Visor 3D no disponible', e); }
