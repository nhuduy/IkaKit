// IkaKit — Navigation helper
// Theo dõi route của Ikariam SPA và thông báo khi trang hiện tại thay đổi.

const KNOWN_PAGES = Object.freeze([
  'island',
  'city',
  'militaryAdvisor',
  'diplomacyAdvisor',
  'transport',
  'attack',
  'topLists',
  'finances',
  'townHall',
  'options',
]);

const ROUTE_KEYS = Object.freeze([
  'view',
  'oldView',
  'page',
  'controller',
  'action',
]);

const subscribers = new Set();

let lastHref = window.location.href;
let lastPage = detectPage(window.location);
let scheduled = false;

function normalizeHash(hash) {
  return hash.replace(/^#\/?/, '');
}

function getRouteParams(location) {
  const params = new URLSearchParams(location.search);
  const hash = normalizeHash(location.hash);

  // Ikariam thường route qua hash. Hash có thể là "view=city&..." hoặc
  // chứa path kèm query, nên tách phần sau dấu ? nếu có.
  if (hash) {
    const hashQuery = hash.includes('?') ? hash.split('?').pop() : hash;
    const hashParams = new URLSearchParams(hashQuery);

    hashParams.forEach((value, key) => {
      if (!params.has(key)) {
        params.set(key, value);
      }
    });
  }

  return params;
}

function pageFromRouteValue(value) {
  if (!value) {
    return null;
  }

  return KNOWN_PAGES.find((pageName) => pageName.toLowerCase() === value.toLowerCase()) ?? null;
}

function pageFromUrlText(location) {
  const rawRouteText = `${location.pathname} ${location.search} ${location.hash}`;
  let routeText = rawRouteText.toLowerCase();

  try {
    routeText = decodeURIComponent(rawRouteText).toLowerCase();
  } catch {
    // Nếu URL có percent-encoding lỗi, vẫn dùng bản thô để tránh làm chết content script.
  }

  // Fallback cho các biến thể URL/hash không parse được bằng URLSearchParams.
  return KNOWN_PAGES.find((pageName) => {
    const escapedPageName = pageName.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escapedPageName}(?:$|[^a-z0-9])`, 'i');

    return pattern.test(routeText);
  }) ?? null;
}

function detectPage(location) {
  const params = getRouteParams(location);

  for (const key of ROUTE_KEYS) {
    const pageName = pageFromRouteValue(params.get(key));

    if (pageName) {
      return pageName;
    }
  }

  return pageFromUrlText(location) ?? 'unknown';
}

function notifyIfPageChanged() {
  scheduled = false;

  const currentHref = window.location.href;
  const currentPageName = detectPage(window.location);

  // MutationObserver có thể chạy rất nhiều lần. Chỉ xử lý khi URL hoặc
  // pageName đổi để callback không bị gọi trùng.
  if (currentHref === lastHref && currentPageName === lastPage) {
    return;
  }

  lastHref = currentHref;

  if (currentPageName === lastPage) {
    return;
  }

  lastPage = currentPageName;
  subscribers.forEach((callback) => callback(currentPageName));
}

function scheduleCheck() {
  if (scheduled) {
    return;
  }

  scheduled = true;
  window.requestAnimationFrame(notifyIfPageChanged);
}

window.addEventListener('hashchange', scheduleCheck);
window.addEventListener('popstate', scheduleCheck);

// Fallback cho trường hợp game tự đổi state/DOM mà event route chuẩn không bắn.
const observer = new MutationObserver(scheduleCheck);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
});

const navigation = Object.freeze({
  onChange(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('navigation.onChange(callback) yêu cầu callback là function.');
    }

    subscribers.add(callback);

    return () => {
      subscribers.delete(callback);
    };
  },

  currentPage() {
    return detectPage(window.location);
  },
});

export default navigation;
