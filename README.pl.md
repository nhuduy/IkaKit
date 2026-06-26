# IkaKit

IkaKit to rozszerzenie przegladarki dla Ikariam tworzone przez spolecznosc. Dodaje zarzadzanie imperium, alerty i wygodne narzedzia bezposrednio w interfejsie gry, aby gracze szybciej rozumieli stan miast i wykonywali mniej powtarzalnych klikniec.

To jest polskie podsumowanie spolecznosciowe. Pelna dokumentacja znajduje sie w [English README](README.md). Pelna dokumentacja po wietnamsku znajduje sie w [README.vi.md](README.vi.md).

## Installation

Wymagania:

- Node.js
- npm

Instalacja ze zrodel:

```bash
git clone <repo-url>
cd IkaKit
npm install
npm run build
```

Po zbudowaniu pliki wyjsciowe znajduja sie w:

```text
dist/chrome/
dist/firefox/
```

Chrome / Chromium:

1. Otworz `chrome://extensions`.
2. Wlacz `Developer mode`.
3. Kliknij `Load unpacked`.
4. Wybierz `dist/chrome`.

Firefox:

1. Otworz `about:debugging#/runtime/this-firefox`.
2. Kliknij `Load Temporary Add-on`.
3. Wybierz `dist/firefox/manifest.json`.

## Features

- Okno Empire Manager bezposrednio w interfejsie Ikariam.
- Widok zasobow, mieszkancow, badan i korupcji dla kazdego miasta.
- Widok budynkow z poziomami, statusem ulepszenia, kosztem nastepnego poziomu i roznicami zasobow.
- Widoki badan, jednostek ladowych, statkow i szpiegostwa.
- Skaner danych miast i lokalna pamiec podreczna dla szybszego wyswietlania.
- Szybkie akcje dla transportu zasobow, wysylki armii i wysylki floty.
- Obserwator ulepszen budynkow na mapie miasta z kregami poziomow, podpowiedziami kosztow i ulepszeniem jednym kliknieciem, gdy wystarcza zasobow.
- Alerty wojskowe, powiadomienia wiadomosci miasta, panel ostrzezen w grze, powiadomienia desktopowe i licznik na ikonie rozszerzenia.
- Zakladka Events w Alerts z filtrowaniem, kopiowaniem, odswiezaniem i czyszczeniem wykrytych wydarzen.

Ta wersja nie zawiera Automation Center, Route Schedule, automatycznego wysylania zasobow, plywajacych launcherow wydarzen gry ani Auto Builder.

## FAQ

### Czy IkaKit jest oficjalnym narzedziem Ikariam?

Nie. IkaKit to projekt spolecznosciowy inspirowany pomyslami z IkaEasy v3, ale napisany od nowa jako WebExtension.

### Jakie przegladarki sa obslugiwane?

IkaKit obsluguje Chrome/Chromium i Firefox. Byl testowany na kilku przegladarkach opartych na Chromium oraz na Mozilla Firefox.

### Czy moge zmieniac lub rozpowszechniac kod?

Kod jest udostepniony na licencji GPL-3.0. Modyfikowanie, budowanie, dystrybucja i uzywanie odbywaja sie na wlasna odpowiedzialnosc. Zawsze sprawdzaj aktualne zasady gry i polityki wydawcy.

### Dlaczego nie widze powiadomien desktopowych?

Sprawdz, czy przegladarka i system operacyjny zezwalaja rozszerzeniu na wysylanie powiadomien.

### Gdzie jest pelna dokumentacja?

Pelna dokumentacja znajduje sie w [English README](README.md).
