# IkaKit

IkaKit là tiện ích mở rộng trình duyệt dành cho Ikariam, được cộng đồng phát
triển để bổ sung công cụ quản lý đế chế và cải thiện trải nghiệm chơi hằng ngày
ngay trong giao diện game.

Extension hỗ trợ Chrome/Chromium và Firefox thông qua WebExtension Manifest V3,
content script, background script và `webextension-polyfill`.

Tài liệu tiếng Anh: [README.md](README.md)

## Tính năng

- Empire Manager dạng modal được inject vào Ikariam.
- Các tab tổng quan theo thành phố:
  - Resources: tài nguyên, nhà ở, nghiên cứu và tham nhũng.
  - Buildings: cấp công trình, trạng thái nâng cấp và chi phí cấp tiếp theo.
  - Military: lục quân và hải quân theo từng thành phố.
  - Espionage: cấp nhà gián điệp, học viện và xưởng.
- Quét dữ liệu thành phố và cache cục bộ để hiển thị tổng quan nhanh hơn.
- Nút thao tác nhanh để chuyển tài nguyên, điều quân và điều hạm đội.
- Nút tăng/giảm nhanh số lượng tài nguyên trong form vận chuyển.
- Theo dõi điều hướng SPA để UI tự cập nhật khi Ikariam đổi view.
- Metadata extension bằng tiếng Anh và tiếng Việt.

## Yêu cầu

- Node.js
- npm

Cài dependencies:

```bash
npm install
```

## Build

Build cho Chrome/Chromium:

```bash
npm run build:chrome
```

Build cho Firefox:

```bash
npm run build:firefox
```

Build cả hai bản:

```bash
npm run build
```

Output sau khi build nằm tại:

```text
dist/chrome/
dist/firefox/
```

## Cài Extension Để Test

### Chrome / Chromium

1. Mở `chrome://extensions`.
2. Bật `Developer mode`.
3. Chọn `Load unpacked`.
4. Chọn thư mục `dist/chrome`.

### Firefox

1. Mở `about:debugging#/runtime/this-firefox`.
2. Chọn `Load Temporary Add-on`.
3. Chọn file `dist/firefox/manifest.json`.

## Cấu Trúc Dự Án

```text
src/
  manifests/          Manifest riêng cho từng browser
  background/         Background script
  content/            Content scripts inject vào Ikariam
    helpers/          Storage, navigation và game data bridge
    modules/
      empire/         Empire Manager và các tab tổng quan
      transport/      Quick controls cho form vận chuyển
  css/                Style inject vào game
  assets/             Icon và hình ảnh UI
  _locales/           Metadata tiếng Anh và tiếng Việt

scripts/
  build.js            Script build theo browser

dist/
  chrome/             Output build cho Chrome/Chromium
  firefox/            Output build cho Firefox
```

## Cách Hoạt Động

IkaKit chạy trên các trang Ikariam khớp với:

```text
*.ikariam.gameforge.com
```

`content/loader.js` load module chính từ `content/init.js`. Entry point này
khởi động Empire Manager, transport helpers, navigation watcher và game data
layer.

Game data layer inject bridge script vào page context, đọc dữ liệu Ikariam có
sẵn, merge với cache chi tiết thành phố, rồi thông báo cho UI khi cần refresh
tổng quan.

## License

IkaKit sử dụng giấy phép GPL-3.0. Xem [LICENSE](LICENSE).

## Credit

Được truyền cảm hứng từ IkaEasy của vltansky.
