// IkaKit — Transport helpers
// Adds v3-style quick amount buttons to Ikariam transport forms.

const TRANSPORT_ROOT_SELECTOR = '#transportGoods, #transportForm, #transport';
const RESOURCE_ROW_SELECTOR = 'ul.resourceAssign li';
const BUTTONS = Object.freeze([
  [-500, '-'],
  [500, '+'],
  [1000, '+1k'],
  [5000, '+5k'],
  [50000, '+50k'],
]);

let observer = null;
let scheduled = false;

function isTransportDomReady() {
  return Boolean(document.querySelector(TRANSPORT_ROOT_SELECTOR));
}

function getInput(row) {
  return row.querySelector('.sliderinput input:not([type="hidden"]), input[type="text"], input[type="number"]');
}

function setInputValue(input, value) {
  input.value = String(Math.max(0, value));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.focus();
  input.blur();
}

function changeAmount(input, sum) {
  const current = Number.parseInt(input.value, 10);
  let value = Number.isFinite(current) ? current : 0;

  if (sum === -500) {
    if (value > 0 && value % 500 !== 0) {
      value -= value % 500;
    } else {
      value += sum;
    }
  } else if (value % 500 === 0) {
    value += sum;
  } else if (value % sum !== 0) {
    value += sum - (value % sum);
  } else {
    value += sum;
  }

  setInputValue(input, value);
}

function createButton(sum, label, input) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ika-transport-quick-button';
  button.textContent = label;
  button.title = sum > 0 ? `+${sum.toLocaleString()}` : sum.toLocaleString();
  button.addEventListener('click', (event) => {
    event.preventDefault();
    changeAmount(input, sum);
  });

  return button;
}

function createButtons(input) {
  const wrap = document.createElement('span');
  wrap.className = 'ika-transport-quick-buttons';

  BUTTONS.forEach(([sum, label]) => {
    wrap.appendChild(createButton(sum, label, input));
  });

  return wrap;
}

function enhanceRow(row) {
  if (row.querySelector('.ika-transport-quick-buttons')) {
    return;
  }

  const input = getInput(row);
  const slider = row.querySelector('.sliderinput');

  if (!input || !slider) {
    return;
  }

  row.querySelectorAll('.button.minus, .button.plus').forEach((button) => {
    button.remove();
  });

  slider.classList.add('ika-transport-quick-enabled');
  slider.prepend(createButtons(input));
}

function enhance() {
  scheduled = false;

  if (!isTransportDomReady()) {
    return;
  }

  document.querySelectorAll(RESOURCE_ROW_SELECTOR).forEach(enhanceRow);
}

function scheduleEnhance() {
  if (scheduled) {
    return;
  }

  scheduled = true;
  window.requestAnimationFrame(enhance);
}

function startObserver() {
  if (observer || !document.body) {
    return;
  }

  observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function stopObserver() {
  if (!observer) {
    return;
  }

  observer.disconnect();
  observer = null;
}

const transport = Object.freeze({
  init(pageName) {
    this.onPageChange(pageName);
  },

  onPageChange(pageName) {
    if (pageName === 'transport' || isTransportDomReady()) {
      startObserver();
      scheduleEnhance();
      return;
    }

    stopObserver();
  },
});

export default transport;
