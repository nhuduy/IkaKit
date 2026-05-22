import { cpSync, rmSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const browser = process.argv[2];

if (!['chrome', 'firefox'].includes(browser)) {
  console.error('Cách dùng: node scripts/build.js <chrome|firefox>');
  process.exit(1);
}

const srcDir      = resolve(__dirname, '../src');
const distDir     = resolve(__dirname, `../dist/${browser}`);
const manifestSrc = resolve(__dirname, `../src/manifests/${browser}.json`);
const polyfillSrc = resolve(__dirname, '../node_modules/webextension-polyfill/dist/browser-polyfill.min.js');

// 1. Dọn dist/browser
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

// 2. Copy toàn bộ src/ → dist/browser/ (bỏ qua thư mục manifests/)
cpSync(srcDir, distDir, {
  recursive: true,
  filter: (src) => !src.includes(`${srcDir}/manifests`),
});

// 3. Đặt đúng manifest cho từng browser
copyFileSync(manifestSrc, resolve(distDir, 'manifest.json'));

// 4. Copy webextension-polyfill
if (existsSync(polyfillSrc)) {
  mkdirSync(resolve(distDir, 'libs'), { recursive: true });
  copyFileSync(polyfillSrc, resolve(distDir, 'libs/browser-polyfill.min.js'));
} else {
  console.warn('⚠ Chưa tìm thấy webextension-polyfill. Chạy npm install trước.');
}

console.log(`✓ Build xong → dist/${browser}/`);
