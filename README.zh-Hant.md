# IkaKit

IkaKit 是由社群建立的 Ikariam 瀏覽器擴充功能。它把帝國管理、警報與便利工具加入遊戲介面，讓玩家更快掌握城市狀態並減少重複點擊。

這是繁體中文社群摘要。完整文件請閱讀 [English README](README.md)。越南文完整文件在 [README.vi.md](README.vi.md)。

## Installation

需求：

- Node.js
- npm

從原始碼安裝：

```bash
git clone <repo-url>
cd IkaKit
npm install
npm run build
```

建置完成後，輸出會在：

```text
dist/chrome/
dist/firefox/
```

Chrome / Chromium：

1. 開啟 `chrome://extensions`。
2. 啟用 `Developer mode`。
3. 點選 `Load unpacked`。
4. 選擇 `dist/chrome`。

Firefox：

1. 開啟 `about:debugging#/runtime/this-firefox`。
2. 點選 `Load Temporary Add-on`。
3. 選擇 `dist/firefox/manifest.json`。

## Features

- 遊戲內 Empire Manager 視窗。
- 依城市查看資源、人口、研究與腐敗狀態。
- 建築總覽，包含等級、升級狀態、下一級成本與資源差額。
- 研究、陸軍、海軍與間諜相關總覽。
- 城市資料掃描與本機快取，讓總覽載入更快。
- 運輸、派遣軍隊與派遣艦隊的快速操作。
- 城鎮地圖上的建築升級監看器，含等級圓標、成本提示與可升級時的一鍵升級。
- 軍事警報、城鎮新聞通知、遊戲內警示面板、桌面通知與擴充功能徽章數字。
- Alerts 的 Events 分頁，可篩選、複製、刷新與清除目前偵測到的事件。

此版本不包含 Automation Center、Route Schedule、自動運送資源、浮動遊戲事件啟動器或 Auto Builder。

## FAQ

### 這是官方 Ikariam 工具嗎？

不是。IkaKit 是社群專案，靈感來自 IkaEasy v3 的想法，但它是重新實作的 WebExtension。

### 支援哪些瀏覽器？

IkaKit 支援 Chrome/Chromium 與 Firefox。它已在多個 Chromium 瀏覽器與 Mozilla Firefox 上測試。

### 我可以修改或重新發佈嗎？

原始碼依 GPL-3.0 授權釋出。修改、建置、發佈或使用時，請自行承擔責任並確認目前的遊戲規則與發行商政策。

### 為什麼通知沒有出現？

請檢查瀏覽器與作業系統是否允許此擴充功能顯示通知。

### 哪裡可以閱讀完整文件？

完整文件請閱讀 [English README](README.md)。
