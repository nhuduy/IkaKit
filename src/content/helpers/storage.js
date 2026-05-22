// IkaKit — Storage helper
// Wrapper mỏng cho browser.storage.local

const storage = {
  get(key) {
    return browser.storage.local.get(key).then(result => {
      const value = result[key];
      return value !== undefined ? value : null;
    });
  },

  set(key, value) {
    return browser.storage.local.set({ [key]: value });
  },

  remove(key) {
    return browser.storage.local.remove(key);
  },
};

export default storage;
