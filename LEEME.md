# Presupuestos Casas

Aplicación web instalable (PWA) para presupuestar 8 modelos de casas de madera en Chile: catálogo, visor 3D, lista de materiales, precio de venta por m² con margen, precios actualizados y descargas (Excel y planos DXF).

## Estructura de archivos

```
presupuestos-casas/
├── index.html              Solo la estructura de la página (sin estilos ni código)
├── manifest.webmanifest    Nombre, ícono y colores de la app instalada
├── sw.js                   Service worker: permite usar la app sin conexión
├── css/
│   └── estilos.css         Todos los estilos (colores, tipografía, modo oscuro, celular)
├── js/
│   ├── inicio.js           Arranque: carga los datos, la interfaz y el visor 3D
│   ├── app.js              Interfaz: catálogo, modelo, presupuesto, precios, venta y descargas
│   ├── costo.js            Motor de cálculo: cantidades de materiales, mano de obra y totales
│   └── visor3d.js          Visor 3D con three.js (casa, techo, terreno, sol)
├── data/
│   ├── modelos.json        Modelos, geometría 3D, materiales, rendimientos y precios de referencia
│   └── precios.json        Precios vigentes, historial y valor de venta por m² del equipo
├── img/
│   ├── icons/              Íconos de la app
│   └── planos/             Plantas de los 8 modelos (PNG)
└── planos/                 Planos DXF para AutoCAD y PDF con las 8 plantas
```

## Qué archivo cambiar para cada cosa

| Quiero cambiar… | Archivo |
|---|---|
| Un precio o el valor de venta por m² del equipo | `data/precios.json` |
| Colores, tamaños o tipografía | `css/estilos.css` |
| Textos o secciones de la página | `index.html` |
| Cómo se calcula una cantidad o un total | `js/costo.js` y rendimientos en `data/modelos.json` |
| El aspecto del 3D | `js/visor3d.js` |

## Reemplazar la versión que ya está en GitHub

1. En el repositorio, borra los archivos antiguos: `index.html`, `sw.js`, `manifest.webmanifest` y las carpetas `data`, `icons` y `planos` (en cada archivo: ícono de tres puntos o papelera → **Delete file** → **Commit changes**).
2. Toca **Add file → Upload files** y arrastra **todo el contenido** de esta carpeta (archivos y carpetas). Toca **Commit changes**.
3. En 1–2 minutos la app queda actualizada en el mismo enlace. En el iPhone, cierra la app y ábrela de nuevo con internet.

## Precio de venta por m²

En `data/precios.json` está el valor común del equipo: `"venta": {"m2": 550000, "iva": true}`. Cámbialo con el lápiz ✏️ de GitHub y todos lo verán al abrir la app. Cada persona puede probar otro valor en su teléfono y volver al del equipo con un toque.

## Instalar en el celular

- **iPhone (Safari):** Compartir → **Agregar a pantalla de inicio**.
- **Android (Chrome):** botón **Instalar app** o menú ⋮ → *Instalar aplicación*.
