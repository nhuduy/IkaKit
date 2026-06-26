# IkaKit

IkaKit là tiện ích mở rộng trình duyệt dành cho Ikariam, được cộng đồng phát
triển để bổ sung công cụ quản lý đế chế và cải thiện trải nghiệm chơi hằng ngày
ngay trong giao diện game.

Extension hỗ trợ Chrome/Chromium và Firefox thông qua WebExtension Manifest V3,
content script, background script và `webextension-polyfill`.

Tài liệu tiếng Anh: [README.md](README.md)

## Cảnh Báo

Source code này được chia sẻ cho cộng đồng sử dụng và tham khảo. Người dùng tự
quyết định cách sử dụng và tự chịu trách nhiệm với mục đích sử dụng của mình.

Tác giả không chịu trách nhiệm cho bất kỳ vấn đề, thiệt hại, xử lý tài khoản
hoặc hậu quả nào phát sinh khi người dùng chỉnh sửa, build, phân phối hoặc sử
dụng source code này cho mục đích riêng.

Luật chơi Ikariam, chính sách của nhà phát hành và các giới hạn liên quan đến
tính năng trả phí có thể thay đổi theo thời gian. Trước khi thêm hoặc sử dụng
các chức năng nâng cao, đặc biệt là những chức năng có thể trùng hoặc cạnh tranh
với tính năng premium/trả phí do nhà phát hành cung cấp, hãy tự kiểm tra luật
hiện tại và cân nhắc kỹ.

## Tính năng

README hiện mô tả 16 nhóm chức năng:

1. Empire Manager dạng modal được inject trực tiếp vào giao diện Ikariam.
2. Tổng quan Resources theo từng thành phố, gồm tài nguyên, nhà ở, nghiên cứu
   và tham nhũng.
3. Tổng quan Buildings theo từng thành phố, gồm cấp công trình, trạng thái nâng
   cấp và chi phí cấp tiếp theo.
4. Tổng quan Military theo từng thành phố, gồm lục quân và hải quân.
5. Tổng quan Espionage theo từng thành phố, gồm cấp nhà gián điệp, học viện và
   xưởng.
6. Bộ quét dữ liệu thành phố để thu thập chi tiết thành phố từ giao diện game.
7. Cache dữ liệu thành phố cục bộ để hiển thị tổng quan đế chế nhanh hơn.
8. Nút thao tác nhanh để chuyển tài nguyên, điều quân và điều hạm đội.
9. Nút chọn nhanh số lượng tài nguyên trong form vận chuyển.
10. Bấm vào tên thành phố trong Empire Manager để chuyển thẳng tới thành phố đó.
11. Bộ theo dõi nâng cấp công trình trên màn hình thành phố: hiển thị vòng tròn
    cấp công trình, tooltip chi phí/chênh lệch tài nguyên và cho phép nâng cấp
    trực tiếp khi thành phố đủ tài nguyên.
12. Theo dõi điều hướng SPA để UI tự cập nhật khi Ikariam đổi view.
13. Panel Alerts để cấu hình Military Alerts, mức độ nguy hiểm incoming, panel
    cảnh báo trong game, desktop notification, badge count và reminder.
14. Town News Notification Alert để phát hiện báo cáo gián điệp/quân sự đã xuất
    hiện trong Town News, kèm nút scan, clear và test notification.
15. Tab Research trong Empire Manager với đồng bộ Research Advisor, tổng quan
    nhóm nghiên cứu, bảng academy/scientist và nút mở Research Advisor/Academy.
16. Tab Events trong Alerts để xem sự kiện Military, Town News và game đang
    active, kèm filter, copy, refresh và clear.

Extension cũng có metadata bằng tiếng Anh và tiếng Việt.

Bản port notification này không bao gồm Automation Center, Route Schedule,
auto-send resource, floating game-event launcher hoặc construction
automation/Auto Builder.

## Yêu cầu

- Node.js
- npm

## Cài Đặt Từ Source

Clone repository, cài dependencies, rồi build extension:

```bash
git clone <repo-url>
cd IkaKit
npm install
npm run build
```

Sau khi build xong, output nằm tại:

```text
dist/chrome/
dist/firefox/
```

Load extension vào trình duyệt từ thư mục build tương ứng.

### Chrome / Chromium

1. Mở `chrome://extensions`.
2. Bật `Developer mode`.
3. Chọn `Load unpacked`.
4. Chọn thư mục `dist/chrome`.

### Firefox

1. Mở `about:debugging#/runtime/this-firefox`.
2. Chọn `Load Temporary Add-on`.
3. Chọn file `dist/firefox/manifest.json`.

## Lệnh Build

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

## Cấu Trúc Dự Án

```text
src/
  manifests/          Manifest riêng cho từng browser
  background/         Background script
  content/            Content scripts inject vào Ikariam
    helpers/          Storage, navigation và game data bridge
    modules/
      alerts/         Panel Alerts độc lập kèm tab Events
      cityWatcher/    Vòng tròn theo dõi/nâng cấp công trình trên town map
      empire/         Empire Manager và các tab tổng quan
      militaryAlerts/ Cảnh báo sự kiện quân sự incoming
      notificationAlerts/ Cảnh báo Town News gián điệp/quân sự
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
khởi động Empire Manager, Alerts panel, transport helpers, Military Alerts,
Notification Alert, navigation watcher và game data layer.

Game data layer inject bridge script vào page context, đọc dữ liệu Ikariam có
sẵn, quét Research Advisor khi được yêu cầu, merge với cache chi tiết thành phố,
rồi thông báo cho UI khi cần refresh tổng quan.

Desktop notification được gửi qua background script của extension. Nếu alert đã
được phát hiện nhưng không thấy notification hệ thống, hãy kiểm tra quyền
notification của trình duyệt và hệ điều hành cho extension.

Tab Alerts Events dùng store active event trong bộ nhớ. Tab này hiển thị sự
kiện được phát hiện trong phiên content script hiện tại và không lưu trạng thái
automation.

## License

IkaKit sử dụng giấy phép GPL-3.0. Xem [LICENSE](LICENSE).

## Credit

Được truyền cảm hứng từ IkaEasy của vltansky.
