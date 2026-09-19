/**
 * The Parent settings screen (TKT-0005 AC #2–#6) — the only screen in the app with text.
 * The DOM is built once at mount time and hidden via the native `hidden` attribute; open()
 * re-reads storage, re-checks the voice list and the install-prompt availability fresh every
 * time, since all three can change while the panel is closed (another tab writes storage, a
 * later `voiceschanged`, a later `beforeinstallprompt`). Every user-facing string is Bulgarian
 * except the credit line, which stays verbatim in English (approved exception, TKT-0005).
 */

import { detectBulgarianVoice, type SpeechSynthesisLike } from '../audio/greeter';
import type { GeolocationPort } from '../platform/geolocation';
import type { InstallPromptPort } from '../platform/install-prompt';
import { budgetMs, type BudgetMinutes } from '../session/session';
import { readBudgetMinutes, writeBudgetMinutes, type StorageLike } from '../session/storage';
import { clearLocation, readCalmMode, readLocation, writeCalmMode, writeLocation } from './settings-storage';
import type { Town } from './towns';

export interface PanelDeps {
  storage: StorageLike;
  /** SceneHandle.restart, already wired to session.restart (TKT-0002) — call this, never session.restart directly. */
  restart: () => void;
  /** SceneHandle.setCalmMode (this ticket's Groundwork). */
  setCalmMode: (enabled: boolean) => void;
  /** SessionController.setBudgetMs (this ticket's Groundwork). */
  setBudgetMs: (ms: number) => void;
  geolocation: GeolocationPort;
  installPrompt: InstallPromptPort;
  speechSynth: SpeechSynthesisLike | null;
  towns: readonly Town[];
  onClose: () => void;
}

interface SettingsPanel {
  element: HTMLElement;
  open(): void;
  close(): void;
  destroy(): void;
}

const STATIC_INSTALL_HINT = 'За да инсталираш: Сподели -> Добави към начален екран';
const VOICE_AVAILABLE = 'Гласът е наличен.';
const VOICE_FALLBACK = 'Използва се записан глас.';
const CREDIT_LINE = 'Moon images: NASA SVS / Ernie Wright';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function settingGroup(name: string): HTMLElement {
  const node = el('section', 'settings-row');
  node.dataset.setting = name;
  return node;
}

export function mountSettingsPanel(root: HTMLElement, deps: PanelDeps): SettingsPanel {
  const element = el('div', 'settings-screen');
  element.hidden = true;

  // --- Back: navigation chrome, outside every data-setting group; never touches session/scene. ---
  const back = el('button', 'settings-back');
  back.type = 'button';
  back.textContent = 'Назад';
  back.addEventListener('click', () => close());

  // --- budget ---
  const budgetGroup = settingGroup('budget');
  const budget5 = el('button', 'settings-button');
  budget5.type = 'button';
  budget5.textContent = '5 минути';
  const budget10 = el('button', 'settings-button');
  budget10.type = 'button';
  budget10.textContent = '10 минути';

  function refreshBudget(): void {
    const current = readBudgetMinutes(deps.storage);
    budget5.setAttribute('aria-pressed', String(current === 5));
    budget10.setAttribute('aria-pressed', String(current === 10));
  }

  function applyBudget(minutes: BudgetMinutes): void {
    writeBudgetMinutes(deps.storage, minutes);
    deps.setBudgetMs(budgetMs(minutes));
    refreshBudget();
  }

  budget5.addEventListener('click', () => applyBudget(5));
  budget10.addEventListener('click', () => applyBudget(10));
  budgetGroup.append(budget5, budget10);

  // --- location ---
  const locationGroup = settingGroup('location');
  const locationHint = el('p');
  locationHint.textContent = 'Локацията прави финала по-точен.';

  const grantButton = el('button', 'settings-button');
  grantButton.type = 'button';
  grantButton.textContent = 'Разреши достъп до локацията';

  const townSelect = el('select');
  const blankOption = el('option');
  blankOption.value = '';
  blankOption.textContent = '';
  townSelect.appendChild(blankOption);
  for (const town of deps.towns) {
    const option = el('option');
    option.value = town.id;
    option.textContent = town.name;
    townSelect.appendChild(option);
  }

  const latInput = el('input');
  latInput.type = 'number';
  latInput.placeholder = 'напр. 42.69';
  const lonInput = el('input');
  lonInput.type = 'number';
  lonInput.placeholder = 'напр. 23.32';

  const saveButton = el('button', 'settings-button');
  saveButton.type = 'button';
  saveButton.textContent = 'Запази';
  const clearButton = el('button', 'settings-button');
  clearButton.type = 'button';
  clearButton.textContent = 'Изчисти';

  function refreshLocation(): void {
    const location = readLocation(deps.storage);
    townSelect.value = location?.source === 'town' && location.townId ? location.townId : '';
    latInput.value = location ? String(location.lat) : '';
    lonInput.value = location ? String(location.lon) : '';
  }

  grantButton.addEventListener('click', () => {
    deps.geolocation.request().then(
      ({ lat, lon }) => {
        writeLocation(deps.storage, { lat, lon, source: 'geolocation', townId: null });
        refreshLocation();
      },
      () => {
        /* denied, unsupported or timed out — location stays whatever it was */
      }
    );
  });

  townSelect.addEventListener('change', () => {
    const town = deps.towns.find((candidate) => candidate.id === townSelect.value);
    if (!town) return;
    writeLocation(deps.storage, { lat: town.lat, lon: town.lon, source: 'town', townId: town.id });
    refreshLocation();
  });

  saveButton.addEventListener('click', () => {
    // valueAsNumber (not Number(value)) so a blank or invalid number input reads as NaN, not 0 —
    // jsdom and real browsers both sanitize a non-numeric typed value to '' for type="number".
    const lat = latInput.valueAsNumber;
    const lon = lonInput.valueAsNumber;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    writeLocation(deps.storage, { lat, lon, source: 'manual', townId: null });
    refreshLocation();
  });

  clearButton.addEventListener('click', () => {
    clearLocation(deps.storage);
    refreshLocation();
  });

  locationGroup.append(locationHint, grantButton, townSelect, latInput, lonInput, saveButton, clearButton);

  // --- restart ---
  const restartGroup = settingGroup('restart');
  const restartButton = el('button', 'settings-button');
  restartButton.type = 'button';
  restartButton.textContent = 'Рестартирай';
  restartButton.addEventListener('click', () => deps.restart());
  restartGroup.appendChild(restartButton);

  // --- install ---
  const installGroup = settingGroup('install');
  const installHintNode = document.createTextNode(STATIC_INSTALL_HINT);
  const installButton = el('button', 'settings-button');
  installButton.type = 'button';
  installButton.textContent = 'Инсталирай';
  installButton.addEventListener('click', () => {
    void deps.installPrompt.prompt();
  });
  installGroup.appendChild(installHintNode);

  function renderInstall(available: boolean): void {
    installGroup.replaceChildren(available ? installButton : installHintNode);
  }

  const unsubscribeInstall = deps.installPrompt.onAvailability(renderInstall);

  // --- voice ---
  const voiceGroup = settingGroup('voice');
  const voiceStatus = el('p');
  voiceGroup.appendChild(voiceStatus);

  function refreshVoice(): void {
    void detectBulgarianVoice(deps.speechSynth).then((available) => {
      voiceStatus.textContent = available ? VOICE_AVAILABLE : VOICE_FALLBACK;
    });
  }

  // --- calm mode ---
  const calmGroup = settingGroup('calm-mode');
  const calmLabel = el('label');
  const calmCheckbox = el('input');
  calmCheckbox.type = 'checkbox';
  calmLabel.append(calmCheckbox, document.createTextNode('Спокоен режим'));
  calmCheckbox.addEventListener('change', () => {
    writeCalmMode(deps.storage, calmCheckbox.checked);
    deps.setCalmMode(calmCheckbox.checked);
  });
  calmGroup.appendChild(calmLabel);

  function refreshCalmMode(): void {
    calmCheckbox.checked = readCalmMode(deps.storage);
  }

  // --- credit ---
  const creditGroup = settingGroup('credit');
  const creditLine = el('p');
  creditLine.textContent = CREDIT_LINE;
  creditGroup.appendChild(creditLine);

  element.append(back, budgetGroup, locationGroup, restartGroup, installGroup, voiceGroup, calmGroup, creditGroup);
  root.appendChild(element);

  // Consistent state even before the first open(), harmless since the panel is hidden either way.
  refreshBudget();
  refreshLocation();
  refreshCalmMode();
  renderInstall(deps.installPrompt.isAvailable());

  function open(): void {
    refreshBudget();
    refreshLocation();
    refreshCalmMode();
    refreshVoice();
    renderInstall(deps.installPrompt.isAvailable());
    element.hidden = false;
  }

  function close(): void {
    element.hidden = true;
    deps.onClose();
  }

  function destroy(): void {
    unsubscribeInstall();
    element.remove();
  }

  return { element, open, close, destroy };
}
