import gameData from '../../helpers/gameData.js';

const ACTION_ICONS = Object.freeze({
  resources: 'res.png',
  fleet: 'fleet.png',
  army: 'army.png',
});

function createActionButton(action, title, params) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `ika-transport-button ika-transport-${action}`;
  button.title = title;

  const icon = document.createElement('img');
  icon.alt = '';
  icon.src = browser.runtime.getURL(`assets/images/empire/actions/${ACTION_ICONS[action]}`);

  const label = document.createElement('span');
  label.className = 'ika-sr-label';
  label.textContent = title;

  button.append(icon, label);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    event.preventDefault();
    gameData.openGameView(params);
    document.querySelector('#ika-empire-modal .ika-modal-close')?.click();
  });

  return button;
}

export function appendTransportHeader(row) {
  const th = document.createElement('th');
  th.className = 'ika-transport-header';
  th.title = 'Actions';
  row.appendChild(th);
}

export function appendTransportCell(row, city) {
  const cell = document.createElement('td');
  const inner = document.createElement('div');
  const cityId = city?.id;

  cell.className = 'ika-transport-cell';
  inner.className = 'ika-transport-actions';

  if (cityId) {
    inner.append(...actionsForCity(city, ['army', 'fleet', 'resources']));
  }

  cell.appendChild(inner);
  row.appendChild(cell);
}

export function appendResourceTransportCell(row, city) {
  const cell = document.createElement('td');
  const inner = document.createElement('div');

  cell.className = 'ika-transport-cell';
  inner.className = 'ika-transport-actions';
  inner.append(...actionsForCity(city, ['army', 'fleet', 'resources']));

  cell.appendChild(inner);
  row.appendChild(cell);
}

export function appendMilitaryTransportCell(row, city) {
  const cell = document.createElement('td');
  const inner = document.createElement('div');

  cell.className = 'ika-transport-cell ika-transport-cell-military';
  inner.className = 'ika-transport-actions';
  inner.append(...actionsForCity(city, ['army', 'fleet', 'resources']));

  cell.appendChild(inner);
  row.appendChild(cell);
}

function actionsForCity(city, actions) {
  const cityId = city?.id;
  if (!cityId) return [];

  const params = {
    resources: {
      title: 'Transport resources',
      query: {
        view: 'transport',
        destinationCityId: cityId,
      },
    },
    fleet: {
      title: 'Deploy fleet',
      query: {
        view: 'deployment',
        deploymentType: 'fleet',
        destinationCityId: cityId,
      },
    },
    army: {
      title: 'Deploy army',
      query: {
        view: 'deployment',
        deploymentType: 'army',
        destinationCityId: cityId,
      },
    },
  };

  return actions.map((action) => createActionButton(action, params[action].title, params[action].query));
}
