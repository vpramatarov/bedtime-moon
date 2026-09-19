import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GeolocationPort } from '../src/platform/geolocation';
import type { InstallPromptPort } from '../src/platform/install-prompt';
import { budgetMs } from '../src/session/session';
import { readBudgetMinutes } from '../src/session/storage';
import { mountSettingsPanel, type PanelDeps } from '../src/settings/panel';
import { readCalmMode, readLocation, writeLocation } from '../src/settings/settings-storage';
import type { Town } from '../src/settings/towns';
import { FakeSpeechSynthesis } from './helpers/fake-speech';
import { MemoryStorage } from './helpers/memory-storage';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const CREDIT_LINE = 'Moon images: NASA SVS / Ernie Wright';
const CYRILLIC = /[Ѐ-ӿ]/;

const TEST_TOWNS: readonly Town[] = [
  { id: 'sofia', name: 'София', lat: 42.7, lon: 23.32 },
  { id: 'plovdiv', name: 'Пловдив', lat: 42.14, lon: 24.75 },
];

function fakeGeolocation(outcome: 'success' | 'failure', coords = { lat: 42.5, lon: 23.55 }): GeolocationPort {
  return {
    request: () => (outcome === 'success' ? Promise.resolve(coords) : Promise.reject(new Error('denied'))),
  };
}

/** Fake install-prompt port: starts unavailable, `fire()` simulates beforeinstallprompt / appinstalled. */
class FakeInstallPrompt implements InstallPromptPort {
  private available = false;
  private readonly listeners = new Set<(available: boolean) => void>();
  promptCalls = 0;
  isAvailable(): boolean {
    return this.available;
  }
  prompt(): Promise<void> {
    this.promptCalls += 1;
    return Promise.resolve();
  }
  onAvailability(listener: (available: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  fire(available: boolean): void {
    this.available = available;
    for (const listener of this.listeners) listener(available);
  }
}

/** Two microtask turns — enough for detectBulgarianVoice's promise chain to settle and repaint text. */
function flush(): Promise<void> {
  return Promise.resolve()
    .then(() => Promise.resolve())
    .then(() => undefined);
}

function createDeps(overrides: Partial<PanelDeps> = {}): PanelDeps {
  return {
    storage: new MemoryStorage(),
    restart: vi.fn(),
    setCalmMode: vi.fn(),
    setBudgetMs: vi.fn(),
    geolocation: fakeGeolocation('success'),
    installPrompt: new FakeInstallPrompt(),
    speechSynth: new FakeSpeechSynthesis([{ lang: 'bg-BG', name: 'Daria' }]),
    towns: TEST_TOWNS,
    onClose: vi.fn(),
    ...overrides,
  };
}

function mount(deps: PanelDeps) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  return mountSettingsPanel(root, deps);
}

function group(panelElement: HTMLElement, name: string): HTMLElement {
  const found = panelElement.querySelector(`[data-setting="${name}"]`);
  if (!found) throw new Error(`no [data-setting="${name}"] group`);
  return found as HTMLElement;
}

describe('AC #4 — exactly seven data-setting groups', () => {
  it('has exactly the seven named groups and no others', () => {
    const panel = mount(createDeps());
    const names = Array.from(panel.element.querySelectorAll('[data-setting]')).map((node) =>
      node.getAttribute('data-setting')
    );
    expect(names).toHaveLength(7);
    expect(new Set(names)).toEqual(
      new Set(['budget', 'location', 'restart', 'install', 'voice', 'calm-mode', 'credit'])
    );
  });

  it('has no eighth element — every top-level child is Back or a data-setting group', () => {
    const panel = mount(createDeps());
    // Back (chrome) + the seven data-setting groups, and nothing else: a stray heading, hint,
    // or decorative element bolted on later would land here uncounted by the query above alone.
    expect(panel.element.children).toHaveLength(8);
    for (const child of Array.from(panel.element.children)) {
      const isBack = child.classList.contains('settings-back');
      const isGroup = child.hasAttribute('data-setting');
      expect(isBack || isGroup, `unexpected top-level child: ${child.outerHTML}`).toBe(true);
    }
  });
});

describe('Back', () => {
  it('closes the panel without touching session or scene state', () => {
    const deps = createDeps();
    const panel = mount(deps);
    panel.open();
    expect(panel.element.hidden).toBe(false);

    const back = panel.element.querySelector('.settings-back') as HTMLButtonElement;
    expect(back).not.toBeNull();
    back.click();

    expect(panel.element.hidden).toBe(true);
    expect(deps.onClose).toHaveBeenCalledOnce();
    expect(deps.restart).not.toHaveBeenCalled();
    expect(deps.setCalmMode).not.toHaveBeenCalled();
    expect(deps.setBudgetMs).not.toHaveBeenCalled();
  });
});

describe('AC #4/#5 — budget', () => {
  it('reflects the stored budget on open and persists + applies immediately on click', () => {
    const deps = createDeps();
    const panel = mount(deps);
    panel.open();
    const [btn5, btn10] = Array.from(group(panel.element, 'budget').querySelectorAll('button')) as [
      HTMLButtonElement,
      HTMLButtonElement,
    ];

    expect(btn5.getAttribute('aria-pressed')).toBe('true');
    expect(btn10.getAttribute('aria-pressed')).toBe('false');

    btn10.click();
    expect(deps.setBudgetMs).toHaveBeenCalledWith(budgetMs(10));
    expect(readBudgetMinutes(deps.storage)).toBe(10);
    expect(btn10.getAttribute('aria-pressed')).toBe('true');
    expect(btn5.getAttribute('aria-pressed')).toBe('false');

    btn5.click();
    expect(deps.setBudgetMs).toHaveBeenCalledWith(budgetMs(5));
    expect(readBudgetMinutes(deps.storage)).toBe(5);
    expect(btn5.getAttribute('aria-pressed')).toBe('true');
    expect(btn10.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('AC #4/#5 — location', () => {
  it('grant persists the resolved coordinates with source geolocation', async () => {
    const deps = createDeps({ geolocation: fakeGeolocation('success', { lat: 42.5, lon: 23.55 }) });
    const panel = mount(deps);
    panel.open();
    const grant = group(panel.element, 'location').querySelectorAll('button')[0] as HTMLButtonElement;

    grant.click();
    await flush();

    expect(readLocation(deps.storage)).toEqual({ lat: 42.5, lon: 23.55, source: 'geolocation', townId: null });
  });

  it('rejection leaves the stored location unchanged and does not throw', async () => {
    const deps = createDeps({ geolocation: fakeGeolocation('failure') });
    writeLocation(deps.storage, { lat: 1, lon: 2, source: 'manual', townId: null });
    const panel = mount(deps);
    panel.open();
    const grant = group(panel.element, 'location').querySelectorAll('button')[0] as HTMLButtonElement;

    expect(() => grant.click()).not.toThrow();
    await flush();

    expect(readLocation(deps.storage)).toEqual({ lat: 1, lon: 2, source: 'manual', townId: null });
  });

  it('choosing a town persists that town lat/lon and id', () => {
    const deps = createDeps();
    const panel = mount(deps);
    panel.open();
    const select = group(panel.element, 'location').querySelector('select') as HTMLSelectElement;

    select.value = 'plovdiv';
    select.dispatchEvent(new Event('change'));

    expect(readLocation(deps.storage)).toEqual({ lat: 42.14, lon: 24.75, source: 'town', townId: 'plovdiv' });
  });

  it('manual entry persists with source manual when both numbers are valid', () => {
    const deps = createDeps();
    const panel = mount(deps);
    panel.open();
    const locationEl = group(panel.element, 'location');
    const [latInput, lonInput] = Array.from(locationEl.querySelectorAll('input')) as [
      HTMLInputElement,
      HTMLInputElement,
    ];
    const save = locationEl.querySelectorAll('button')[1] as HTMLButtonElement;

    latInput.value = '42.11';
    lonInput.value = '23.99';
    save.click();

    expect(readLocation(deps.storage)).toEqual({ lat: 42.11, lon: 23.99, source: 'manual', townId: null });
  });

  it('manual entry silently rejects non-numeric input', () => {
    const deps = createDeps();
    const panel = mount(deps);
    panel.open();
    const locationEl = group(panel.element, 'location');
    const [latInput, lonInput] = Array.from(locationEl.querySelectorAll('input')) as [
      HTMLInputElement,
      HTMLInputElement,
    ];
    const save = locationEl.querySelectorAll('button')[1] as HTMLButtonElement;

    latInput.value = 'not-a-number';
    lonInput.value = '23.99';
    save.click();

    expect(readLocation(deps.storage)).toBeNull();
  });

  it('clear removes the stored location and resets the select and inputs to empty', () => {
    const deps = createDeps();
    const panel = mount(deps);
    panel.open();
    const locationEl = group(panel.element, 'location');
    const select = locationEl.querySelector('select') as HTMLSelectElement;
    const [latInput, lonInput] = Array.from(locationEl.querySelectorAll('input')) as [
      HTMLInputElement,
      HTMLInputElement,
    ];
    const clearBtn = locationEl.querySelectorAll('button')[2] as HTMLButtonElement;

    select.value = 'sofia';
    select.dispatchEvent(new Event('change'));
    expect(readLocation(deps.storage)).not.toBeNull();

    clearBtn.click();

    expect(readLocation(deps.storage)).toBeNull();
    expect(select.value).toBe('');
    expect(latInput.value).toBe('');
    expect(lonInput.value).toBe('');
  });
});

describe('AC #4 — restart', () => {
  it('calls the injected restart function exactly once per click', () => {
    const deps = createDeps();
    const panel = mount(deps);
    panel.open();
    const restartButton = group(panel.element, 'restart').querySelector('button') as HTMLButtonElement;

    restartButton.click();
    expect(deps.restart).toHaveBeenCalledTimes(1);

    restartButton.click();
    expect(deps.restart).toHaveBeenCalledTimes(2);
  });
});

describe('AC #4 — install', () => {
  it('shows the static hint by default, swaps to a working button once available, reverts when unavailable again', () => {
    const installPrompt = new FakeInstallPrompt();
    const deps = createDeps({ installPrompt });
    const panel = mount(deps);
    panel.open();
    const installEl = group(panel.element, 'install');

    expect(installEl.querySelector('button')).toBeNull();
    expect(installEl.textContent).toMatch(CYRILLIC);

    installPrompt.fire(true);
    const button = installEl.querySelector('button') as HTMLButtonElement;
    expect(button).not.toBeNull();
    button.click();
    expect(installPrompt.promptCalls).toBe(1);

    installPrompt.fire(false);
    expect(installEl.querySelector('button')).toBeNull();
    expect(installEl.textContent).toMatch(CYRILLIC);
  });
});

describe('AC #4 — voice status', () => {
  it('shows the "available" line when a Bulgarian voice exists', async () => {
    const deps = createDeps({ speechSynth: new FakeSpeechSynthesis([{ lang: 'bg-BG', name: 'Daria' }]) });
    const panel = mount(deps);
    panel.open();
    await flush();

    expect(group(panel.element, 'voice').textContent).toBe('Гласът е наличен.');
  });

  it('shows the recorded-fallback line when no Bulgarian voice exists', async () => {
    const deps = createDeps({ speechSynth: new FakeSpeechSynthesis([{ lang: 'en-US', name: 'Samantha' }]) });
    const panel = mount(deps);
    panel.open();
    await flush();

    expect(group(panel.element, 'voice').textContent).toBe('Използва се записан глас.');
  });
});

describe('AC #4/#5 — calm mode', () => {
  it('toggling persists and calls setCalmMode immediately with the right boolean', () => {
    const deps = createDeps();
    const panel = mount(deps);
    panel.open();
    const checkbox = group(panel.element, 'calm-mode').querySelector('input[type="checkbox"]') as HTMLInputElement;

    expect(checkbox.checked).toBe(false);

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    expect(deps.setCalmMode).toHaveBeenCalledWith(true);
    expect(readCalmMode(deps.storage)).toBe(true);

    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    expect(deps.setCalmMode).toHaveBeenCalledWith(false);
    expect(readCalmMode(deps.storage)).toBe(false);
  });
});

describe('AC #3 — Bulgarian text, credit line the one exception', () => {
  it('the credit line is exactly the literal English string while every other visible text node is Bulgarian', async () => {
    const panel = mount(createDeps());
    panel.open();
    await flush();

    const creditGroup = group(panel.element, 'credit');
    expect(creditGroup.textContent).toBe(CREDIT_LINE);

    const walker = document.createTreeWalker(panel.element, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    let checkedAtLeastOne = false;
    // eslint-disable-next-line no-cond-assign
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim() ?? '';
      if (!text) continue;
      if (creditGroup.contains(node)) {
        expect(text).toBe(CREDIT_LINE);
        continue;
      }
      checkedAtLeastOne = true;
      expect(text).toMatch(CYRILLIC);
    }
    expect(checkedAtLeastOne).toBe(true);
  });
});

describe('AC #6 — no links, no network', () => {
  it('renders no <a> elements anywhere', () => {
    const panel = mount(createDeps());
    panel.open();
    expect(panel.element.querySelectorAll('a')).toHaveLength(0);
  });

  it('never calls fetch or XMLHttpRequest while open and being interacted with', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const xhrOpen = vi.spyOn(XMLHttpRequest.prototype, 'open');

    const installPrompt = new FakeInstallPrompt();
    const deps = createDeps({ installPrompt });
    const panel = mount(deps);
    panel.open();

    const [btn5, btn10] = Array.from(group(panel.element, 'budget').querySelectorAll('button')) as [
      HTMLButtonElement,
      HTMLButtonElement,
    ];
    btn10.click();
    btn5.click();

    const locationEl = group(panel.element, 'location');
    const select = locationEl.querySelector('select') as HTMLSelectElement;
    select.value = 'plovdiv';
    select.dispatchEvent(new Event('change'));
    const grant = locationEl.querySelectorAll('button')[0] as HTMLButtonElement;
    grant.click();

    const checkbox = group(panel.element, 'calm-mode').querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    installPrompt.fire(true);
    (group(panel.element, 'install').querySelector('button') as HTMLButtonElement).click();

    group(panel.element, 'restart').querySelector('button')!.dispatchEvent(new Event('click', { bubbles: true }));

    await flush();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpen).not.toHaveBeenCalled();
  });
});
