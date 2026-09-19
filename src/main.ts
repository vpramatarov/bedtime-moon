import './styles/tokens.css';
import './styles/scene.css';
import './styles/settings.css';
import { mountApp } from './app/shell';
import { createGreeter, type SpeechSynthesisLike } from './audio/greeter';
import { GREETING_BG, GREETING_FALLBACK_URL, LULLABY_URL } from './audio/greeting';
import { createTapSound } from './audio/tap-sound';
import { loadFrames } from './moon/frames';
import { createGeolocation } from './platform/geolocation';
import { createInstallPrompt } from './platform/install-prompt';
import { createWakeLock } from './platform/wake-lock';
import { registerServiceWorker } from './pwa/register-sw';
import { createSessionController } from './session/controller';
import { budgetMs } from './session/session';
import { readBudgetMinutes } from './session/storage';
import { TOWNS } from './settings/towns';

const root = document.getElementById('app');
if (!root) throw new Error('#app root missing');

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const session = createSessionController({
  now: () => Date.now(),
  storage: localStorage,
  budgetMs: budgetMs(readBudgetMinutes(localStorage)),
});

const speechSynth: SpeechSynthesisLike | null =
  typeof speechSynthesis === 'undefined' ? null : (speechSynthesis as unknown as SpeechSynthesisLike);

mountApp(root, {
  now: () => new Date(),
  frames: loadFrames(),
  tapSound: createTapSound(),
  greeter: createGreeter({ text: GREETING_BG, fallbackUrl: GREETING_FALLBACK_URL }),
  reducedMotion: () => reducedMotionQuery.matches,
  session,
  // text/fallbackUrl are never actually spoken: scene.ts always overrides with the computed
  // real-sky hand-off line (TKT-0003) on every call.
  goodnightVoice: createGreeter({ text: '', fallbackUrl: null }),
  wakeLock: createWakeLock(),
  lullabyUrl: LULLABY_URL,
  storage: localStorage,
  geolocation: createGeolocation(),
  installPrompt: createInstallPrompt(),
  speechSynth,
  towns: TOWNS,
});

registerServiceWorker({
  isProd: import.meta.env.PROD,
  hasSupport: 'serviceWorker' in navigator,
  register: (url) => navigator.serviceWorker.register(url),
});
