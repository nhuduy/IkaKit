# IkaKit

IkaKit ist eine von der Community entwickelte Browsererweiterung fuer Ikariam. Sie bringt Reichsverwaltung, Warnungen und Komfortfunktionen direkt in die Spieloberflaeche, damit Spieler ihre Staedte schneller ueberblicken und weniger wiederholte Klicks brauchen.

Dies ist eine deutsche Community-Zusammenfassung. Die vollstaendige Dokumentation steht im [English README](README.md). Die vollstaendige vietnamesische Dokumentation steht in [README.vi.md](README.vi.md).

## Installation

Voraussetzungen:

- Node.js
- npm

Aus dem Quellcode installieren:

```bash
git clone <repo-url>
cd IkaKit
npm install
npm run build
```

Nach dem Build liegen die Ausgaben hier:

```text
dist/chrome/
dist/firefox/
```

Chrome / Chromium:

1. `chrome://extensions` oeffnen.
2. `Developer mode` aktivieren.
3. `Load unpacked` anklicken.
4. `dist/chrome` auswaehlen.

Firefox:

1. `about:debugging#/runtime/this-firefox` oeffnen.
2. `Load Temporary Add-on` anklicken.
3. `dist/firefox/manifest.json` auswaehlen.

## Features

- Empire Manager direkt in der Ikariam-Oberflaeche.
- Ressourcenuebersicht pro Stadt fuer Waren, Wohnraum, Forschung und Korruption.
- Gebaeudeuebersicht mit Stufen, Upgrade-Status, Kosten der naechsten Stufe und Ressourcendifferenzen.
- Uebersichten fuer Forschung, Landtruppen, Schiffe und Spionage.
- Stadtdatenscanner und lokaler Cache fuer schnellere Uebersichten.
- Schnellaktionen fuer Ressourcentransport, Truppenentsendung und Flottenentsendung.
- Bau-Upgrade-Watcher auf der Stadtkarte mit Stufenkreisen, Kostentooltips und Ein-Klick-Upgrade, wenn genug Ressourcen vorhanden sind.
- Militaerwarnungen, Stadt-Nachrichten-Benachrichtigungen, Warnpanel im Spiel, Desktop-Benachrichtigungen und Erweiterungs-Badge.
- Events-Tab in Alerts mit Filtern, Kopieren, Aktualisieren und Loeschen erkannter Ereignisse.

Diese Version enthaelt kein Automation Center, keinen Route Schedule, keine automatischen Ressourcentransporte, keine schwebenden Game-Event-Starter und keinen Auto Builder.

## FAQ

### Ist IkaKit ein offizielles Ikariam-Tool?

Nein. IkaKit ist ein Community-Projekt, inspiriert von Ideen aus IkaEasy v3, aber als neue WebExtension umgesetzt.

### Welche Browser werden unterstuetzt?

IkaKit unterstuetzt Chrome/Chromium und Firefox. Es wurde auf mehreren Chromium-basierten Browsern und Mozilla Firefox getestet.

### Darf ich den Code aendern oder weitergeben?

Der Code steht unter der GPL-3.0-Lizenz. Wenn du ihn aenderst, baust, verteilst oder nutzt, geschieht das auf eigene Verantwortung. Pruefe immer die aktuellen Spielregeln und Publisher-Richtlinien.

### Warum erscheinen keine Desktop-Benachrichtigungen?

Pruefe, ob Browser und Betriebssystem Benachrichtigungen fuer die Erweiterung erlauben.

### Wo ist die vollstaendige Dokumentation?

Die vollstaendige Dokumentation steht im [English README](README.md).
