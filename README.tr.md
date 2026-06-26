# IkaKit

IkaKit, Ikariam icin topluluk tarafindan gelistirilen bir tarayici uzantisidir. Imparatorluk yonetimi, uyarilar ve kullanim kolayligi araclarini dogrudan oyun arayuzune ekler; boylece oyuncular sehirlerini daha hizli anlayabilir ve daha az tekrarli tiklama yapar.

Bu, Turkce topluluk ozetidir. Tam belgeler [English README](README.md) dosyasindadir. Tam Vietnamca belgeler [README.vi.md](README.vi.md) dosyasindadir.

## Installation

Gereksinimler:

- Node.js
- npm

Kaynak koddan kurulum:

```bash
git clone <repo-url>
cd IkaKit
npm install
npm run build
```

Build bittikten sonra cikti su dizinlere yazilir:

```text
dist/chrome/
dist/firefox/
```

Chrome / Chromium:

1. `chrome://extensions` sayfasini acin.
2. `Developer mode` secenegini etkinlestirin.
3. `Load unpacked` dugmesine tiklayin.
4. `dist/chrome` dizinini secin.

Firefox:

1. `about:debugging#/runtime/this-firefox` sayfasini acin.
2. `Load Temporary Add-on` dugmesine tiklayin.
3. `dist/firefox/manifest.json` dosyasini secin.

## Features

- Ikariam arayuzune eklenen Empire Manager penceresi.
- Her sehir icin kaynaklar, konut, arastirma ve yolsuzluk gorunumu.
- Seviyeler, yukseltme durumu, sonraki seviye maliyeti ve kaynak farklariyla bina gorunumu.
- Arastirma, kara birlikleri, gemiler ve casusluk gorunumleri.
- Daha hizli gorunum icin sehir veri tarayicisi ve yerel onbellek.
- Kaynak tasima, ordu gonderme ve filo gonderme icin hizli islemler.
- Sehir haritasinda seviye halkalari, maliyet ipuclari ve yeterli kaynak varsa tek tikla yukseltme iceren bina yukseltme izleyicisi.
- Askeri uyarilar, sehir haberleri bildirimleri, oyun ici uyari paneli, masaustu bildirimleri ve uzanti rozet sayaci.
- Alerts icinde filtreleme, kopyalama, yenileme ve temizleme ozellikli Events sekmesi.

Bu surum Automation Center, Route Schedule, otomatik kaynak gonderme akislari, kayan oyun etkinligi baslaticilari veya Auto Builder icermez.

## FAQ

### IkaKit resmi bir Ikariam araci mi?

Hayir. IkaKit, IkaEasy v3 fikirlerinden ilham alan bir topluluk projesidir, ancak WebExtension olarak bastan uygulanmistir.

### Hangi tarayicilar destekleniyor?

IkaKit Chrome/Chromium ve Firefox destekler. Birden fazla Chromium tabanli tarayicida ve Mozilla Firefox'ta test edilmistir.

### Kodu degistirebilir veya yeniden dagitabilir miyim?

Kod GPL-3.0 lisansi ile yayinlanir. Degistirme, build alma, dagitma veya kullanma islemleri kendi sorumlulugunuzdadir. Guncel oyun kurallarini ve yayinci politikalarini her zaman kontrol edin.

### Masaustu bildirimleri neden gorunmuyor?

Tarayicinin ve isletim sisteminin bu uzanti icin bildirimlere izin verdigini kontrol edin.

### Tam belgeler nerede?

Tam belgeler [English README](README.md) dosyasindadir.
