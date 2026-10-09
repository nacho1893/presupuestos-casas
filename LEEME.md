# Presupuestos Casas · app instalable

Aplicación web (PWA) de presupuestos para 8 modelos de casas de madera en Chile: catálogo, visor 3D, lista de materiales, precios y descargas (Excel y planos DXF).
Se usa desde el navegador y se puede instalar en el celular o el computador como una app con ícono propio. Funciona sin conexión con los últimos precios guardados.

## Publicarla gratis en GitHub Pages (una sola vez, ~10 minutos)

1. Crea una cuenta en https://github.com (si no tienes).
2. Crea un repositorio nuevo llamado `Presupuestos-casas`, **público**.
3. En el repositorio: **Add file → Upload files**, arrastra **todo el contenido** de esta carpeta (index.html, sw.js, manifest.webmanifest y las carpetas data, icons y planos) y presiona **Commit changes**.
4. Ve a **Settings → Pages**. En *Build and deployment* elige **Deploy from a branch**, rama **main**, carpeta **/ (root)** y guarda.
5. En 1–2 minutos la app queda en `https://TU-USUARIO.github.io/presupuestos-casas/`. Ese es el enlace para tu equipo.

## Instalarla en el celular

- **Android (Chrome):** abre el enlace y toca **Instalar app** (botón arriba en la app) o el menú ⋮ → *Instalar aplicación*.
- **iPhone (Safari):** abre el enlace, toca **Compartir** y luego **Agregar a pantalla de inicio**.
- **Computador (Chrome o Edge):** ícono de instalar en la barra de direcciones.

## Precios

- Los precios vigentes están en `data/precios.json`. La app los lee cada vez que se abre; si no hay internet usa los últimos guardados en el teléfono.
- Solo se guardan ahí los precios que cambiaron; el resto usa el precio de referencia del 6 de octubre de 2026 incluido en la app.
- La revisión automática de cada lunes (Sodimac + Índice de Costo de Edificación de la CChC) y las correcciones que el equipo hace en el panel de precios de Claude se publican en este archivo una vez que el repositorio está conectado a Claude.

## Actualizar la app

Si cambias `index.html`, sube la nueva versión al repositorio. Los teléfonos reciben la versión nueva la siguiente vez que abren la app con internet.
