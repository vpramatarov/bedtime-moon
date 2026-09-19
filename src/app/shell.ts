/**
 * The whole app in one composition (TKT-0005): mounts the scene, the settings entry glyph and the
 * settings panel onto the same root, and wires the one piece of state this layer owns — which of
 * the entry glyph and the panel is visible. The entry's `onOpen` hides itself and opens the panel;
 * the panel's `onClose` only shows the entry glyph again — by the time it fires, `panel.close()`
 * has already hidden the panel and called this callback as its last step (see settings/panel.ts),
 * so calling `panel.close()` again here would recurse. Everything else (session, scene motion,
 * storage, the platform ports) is composed unchanged from what mountScene and mountSettingsPanel
 * already require — this file owns no state of its own beyond that visibility toggle.
 */

import type { SpeechSynthesisLike } from '../audio/greeter';
import type { GeolocationPort } from '../platform/geolocation';
import type { InstallPromptPort } from '../platform/install-prompt';
import { mountScene, type SceneDeps } from '../scene/scene';
import { mountSettingsEntry } from '../settings/entry';
import { mountSettingsPanel } from '../settings/panel';
import type { Town } from '../settings/towns';

export interface ShellDeps extends SceneDeps {
  geolocation: GeolocationPort;
  installPrompt: InstallPromptPort;
  speechSynth: SpeechSynthesisLike | null;
  towns: readonly Town[];
}

export function mountApp(root: HTMLElement, deps: ShellDeps): { destroy(): void } {
  const { storage, geolocation, installPrompt, speechSynth, towns, ...sceneDeps } = deps;

  const scene = mountScene(root, { ...sceneDeps, storage });

  const entry = mountSettingsEntry(root, () => {
    entry.element.hidden = true;
    panel.open();
  });

  const panel = mountSettingsPanel(root, {
    storage,
    restart: scene.restart,
    setCalmMode: scene.setCalmMode,
    setBudgetMs: deps.session.setBudgetMs,
    geolocation,
    installPrompt,
    speechSynth,
    towns,
    onClose: () => {
      entry.element.hidden = false;
    },
  });

  return {
    destroy(): void {
      panel.destroy();
      entry.destroy();
      scene.destroy();
    },
  };
}
