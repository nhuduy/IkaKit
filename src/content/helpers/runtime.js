// IkaKit - Extension runtime helpers.

export function getExtensionApi() {
  if (typeof browser !== 'undefined' && browser?.runtime) {
    return browser;
  }

  if (typeof chrome !== 'undefined' && chrome?.runtime) {
    return chrome;
  }

  return null;
}

function getRuntimeApi() {
  return getExtensionApi()?.runtime ?? null;
}

export function isExtensionContextInvalidated(error) {
  return /extension context (?:was )?invalidated/i.test(String(error?.message || error || ''));
}

export function sendRuntimeMessage(message) {
  const api = getExtensionApi();

  if (!api?.runtime?.sendMessage) {
    return Promise.resolve(undefined);
  }

  if (typeof browser !== 'undefined' && api === browser) {
    return Promise.resolve(api.runtime.sendMessage(message)).catch((error) => {
      if (isExtensionContextInvalidated(error)) return undefined;
      throw error;
    });
  }

  return new Promise((resolve, reject) => {
    try {
      const result = api.runtime.sendMessage(message, (response) => {
        const error = api.runtime.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });

      if (result && typeof result.then === 'function') {
        result.then(resolve, reject);
      }
    } catch (error) {
      reject(error);
    }
  }).catch((error) => {
    if (isExtensionContextInvalidated(error)) return undefined;
    throw error;
  });
}

export function getRuntimeUrl(path) {
  const runtime = getRuntimeApi();

  if (!runtime?.getURL) {
    console.warn('[IkaKit] Extension runtime API is not available:', path);
    return '';
  }

  try {
    return runtime.getURL(String(path || '').replace(/^\/+/, ''));
  } catch (error) {
    if (isExtensionContextInvalidated(error)) return '';
    console.warn('[IkaKit] Không resolve được extension asset:', path, error);
    return '';
  }
}
