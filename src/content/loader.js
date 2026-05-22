// Classic content-script entrypoint.
// Chromium/Edge content_scripts are not reliable as ES modules, so this file
// loads the real module graph through dynamic import.
(async function loadIkaKitContent() {
  try {
    await import(browser.runtime.getURL('content/init.js'));
  } catch (error) {
    console.error('[IkaKit] Không load được content module:', error);
  }
}());
