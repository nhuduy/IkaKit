# IkaKit

IkaKit es una extension de navegador creada por la comunidad para Ikariam. Agrega gestion del imperio, alertas y herramientas de calidad de vida directamente en la interfaz del juego, para que los jugadores entiendan sus ciudades mas rapido y hagan menos clics repetitivos.

Este es un resumen comunitario en espanol. La documentacion completa esta en el [English README](README.md). La documentacion completa en vietnamita esta en [README.vi.md](README.vi.md).

## Installation

Requisitos:

- Node.js
- npm

Instalar desde el codigo fuente:

```bash
git clone <repo-url>
cd IkaKit
npm install
npm run build
```

Despues de compilar, la salida queda en:

```text
dist/chrome/
dist/firefox/
```

Chrome / Chromium:

1. Abre `chrome://extensions`.
2. Activa `Developer mode`.
3. Haz clic en `Load unpacked`.
4. Selecciona `dist/chrome`.

Firefox:

1. Abre `about:debugging#/runtime/this-firefox`.
2. Haz clic en `Load Temporary Add-on`.
3. Selecciona `dist/firefox/manifest.json`.

## Features

- Ventana Empire Manager dentro de la interfaz de Ikariam.
- Vista por ciudad de recursos, vivienda, investigacion y corrupcion.
- Vista de edificios con niveles, estado de mejora, costes del siguiente nivel y diferencias de recursos.
- Vistas de investigacion, unidades terrestres, barcos y espionaje.
- Escaneo de datos de ciudades y cache local para mostrar las vistas mas rapido.
- Acciones rapidas para transporte de recursos, despliegue de ejercito y despliegue de flota.
- Vigilancia de mejoras en el mapa de ciudad con circulos de nivel, tooltips de coste y mejora con un clic cuando hay recursos suficientes.
- Alertas militares, notificaciones de noticias de ciudad, panel de aviso en el juego, notificaciones de escritorio y contador en el icono de la extension.
- Pestana Events en Alerts con filtros, copiar, actualizar y limpiar eventos detectados.

Esta version no incluye Automation Center, Route Schedule, envios automaticos de recursos, lanzadores flotantes de eventos del juego ni Auto Builder.

## FAQ

### IkaKit es una herramienta oficial de Ikariam?

No. IkaKit es un proyecto comunitario inspirado en ideas de IkaEasy v3, pero reimplementado como WebExtension.

### Que navegadores son compatibles?

IkaKit es compatible con Chrome/Chromium y Firefox. Se ha probado en varios navegadores basados en Chromium y en Mozilla Firefox.

### Puedo modificar o redistribuir el codigo?

El codigo se publica bajo la licencia GPL-3.0. Cualquier modificacion, compilacion, distribucion o uso queda bajo tu propia responsabilidad. Revisa siempre las reglas actuales del juego y las politicas del editor.

### Por que no aparecen las notificaciones de escritorio?

Comprueba que el navegador y el sistema operativo permitan notificaciones para la extension.

### Donde esta la documentacion completa?

La documentacion completa esta en el [English README](README.md).
