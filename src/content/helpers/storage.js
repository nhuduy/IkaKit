// IkaKit — Storage helper
// Wrapper mỏng cho browser.storage.local

import { getExtensionApi, isExtensionContextInvalidated } from './runtime.js';

const extensionApi = getExtensionApi();
const usesPromiseApi = typeof browser !== 'undefined' && extensionApi === browser;

function safeStorageCall(callback, fallback) {
  try {
    return Promise.resolve(callback()).catch((error) => {
      if (isExtensionContextInvalidated(error)) return fallback;
      throw error;
    });
  } catch (error) {
    if (isExtensionContextInvalidated(error)) return Promise.resolve(fallback);
    return Promise.reject(error);
  }
}

function withCallback(callbackStyleCall) {
  return new Promise((resolve, reject) => {
    try {
      const result = callbackStyleCall((value) => {
        const error = extensionApi?.runtime?.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve(value);
      });

      if (result && typeof result.then === 'function') {
        result.then(resolve, reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

function storageGet(key) {
  if (!extensionApi?.storage?.local) {
    return Promise.resolve({});
  }

  if (usesPromiseApi) {
    return safeStorageCall(() => extensionApi.storage.local.get(key), {});
  }

  return safeStorageCall(
    () => withCallback((done) => extensionApi.storage.local.get(key, done)),
    {},
  );
}

function storageSet(value) {
  if (!extensionApi?.storage?.local) {
    return Promise.resolve(undefined);
  }

  if (usesPromiseApi) {
    return safeStorageCall(() => extensionApi.storage.local.set(value), undefined);
  }

  return safeStorageCall(
    () => withCallback((done) => extensionApi.storage.local.set(value, done)),
    undefined,
  );
}

function storageRemove(key) {
  if (!extensionApi?.storage?.local) {
    return Promise.resolve(undefined);
  }

  if (usesPromiseApi) {
    return safeStorageCall(() => extensionApi.storage.local.remove(key), undefined);
  }

  return safeStorageCall(
    () => withCallback((done) => extensionApi.storage.local.remove(key, done)),
    undefined,
  );
}

const storage = {
  get(key) {
    return storageGet(key).then(result => {
      const value = result[key];
      return value !== undefined ? value : null;
    });
  },

  set(key, value) {
    return storageSet({ [key]: value });
  },

  remove(key) {
    return storageRemove(key);
  },
};

export default storage;
