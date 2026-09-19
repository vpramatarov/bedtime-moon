/**
 * The child screen: sky, stars, grain, tonight's moon — and the soft session arc
 * awake → active → winding-down → asleep (TKT-0001, TKT-0002).
 * All platform boundaries (clock, storage-backed session, audio, speech, wake lock, visibility,
 * motion preference) arrive as ports so the scene is testable in jsdom and mocked only where the
 * platform starts.
 */

import type { Greeter, AudioLike } from '../audio/greeter';
import type { TapSound } from '../audio/tap-sound';
import { handOffLine } from '../moon/handoff';
import type { MoonFrame } from '../moon/frames';
import { nightsAround } from '../moon/nights';
import type { VisibilityPort } from '../platform/visibility';
import { createDocumentVisibility } from '../platform/visibility';
import type { WakeLockPort } from '../platform/wake-lock';
import type { SessionController } from '../session/controller';
import type { Phase } from '../session/session';
import type { StorageLike } from '../session/storage';
import { readLocation } from '../settings/settings-storage';
import { buildClouds } from './clouds';
import { el } from './dom';
import { buildNightStrip, type NightCardHandle, type NightStripDeps } from './night-strip';
import { starField } from './stars';

export interface SceneDeps {
  /** Device clock (trusted by decision — PRD-0001 Story 1). */
  now: () => Date;
  frames: readonly MoonFrame[];
  tapSound: TapSound;
  /** Idle greeting voice (TKT-0001). */
  greeter: Greeter;
  /** True when the OS asks for reduced motion or the Parent enabled Calm mode. */
  reducedMotion: () => boolean;
  /** Idle time before the greeting, ms. Default 5 000 (TKT-0001 AC #7). */
  idleMs?: number;
  /** Session budget / cooldown state machine (TKT-0002). */
  session: SessionController;
  /** Goodnight voice, spoken once when the budget runs out (TKT-0002 AC #3). */
  goodnightVoice: Greeter;
  wakeLock: WakeLockPort;
  /** Defaults to document visibility. */
  visibility?: VisibilityPort;
  /** Lullaby asset; when set it replaces the spoken goodnight line. */
  lullabyUrl?: string | null;
  /** Audio element factory for the lullaby. Defaults to `new Audio(url)`. */
  createAudio?: (url: string) => AudioLike;
  /** Read fresh at the goodnight moment for the real-sky hand-off (TKT-0003) -- not baked in at mount, since the Parent can set location after opening the app. */
  storage: StorageLike;
  /** Testing seam for the night strip's platform boundaries (TKT-0004) -- defaults to the real IntersectionObserver/scrollIntoView. */
  nightStrip?: NightStripDeps;
}

export interface SceneHandle {
  /** The frame being shown. */
  readonly frame: MoonFrame;
  phase(): Phase;
  /** Parent's Restart (TKT-0005 wires the button): clears session + cooldown, awake again. */
  restart(): void;
  /** Parent's Calm mode toggle (TKT-0005): live override on top of deps.reducedMotion(), no remount. */
  setCalmMode(enabled: boolean): void;
  destroy(): void;
}

const DEFAULT_IDLE_MS = 5_000;
const TAP_CLASS = 'is-tapped';
const YAWN_CLASS = 'is-yawning';
const INSTANT_RELEASE_MS = 120;
const RUNNING: ReadonlySet<Phase> = new Set<Phase>(['active', 'winding-down']);

function buildStars(): HTMLElement {
  const stars = el('div', 'stars');
  for (const star of starField()) {
    const node = el('i', 'star');
    node.style.setProperty('--x', `${star.x}%`);
    node.style.setProperty('--y', `${star.y}%`);
    node.style.setProperty('--size', `${star.size}px`);
    node.style.setProperty('--dur', `${star.duration}s`);
    node.style.setProperty('--delay', `${star.delay}s`);
    stars.appendChild(node);
  }
  return stars;
}

export function mountScene(root: HTMLElement, deps: SceneDeps): SceneHandle {
  const idleMs = deps.idleMs ?? DEFAULT_IDLE_MS;
  const visibility = deps.visibility ?? createDocumentVisibility();
  const lullabyUrl = deps.lullabyUrl ?? null;
  const createAudio = deps.createAudio ?? ((url: string): AudioLike => new Audio(url));
  const { session } = deps;
  const nights = nightsAround(deps.now(), deps.frames);
  const tonight = nights.find((n) => n.offset === 0)!;

  let calmModeOverride = false;
  const recomputeMotion = (): void => {
    if (deps.reducedMotion() || calmModeOverride) root.dataset.motion = 'reduced';
    else delete root.dataset.motion;
  };
  recomputeMotion();

  const scene = el('div', 'scene');
  const nightStrip = buildNightStrip(nights, deps.nightStrip);
  scene.append(buildStars(), el('div', 'grain'), nightStrip.element);
  root.appendChild(scene);

  // --- the centred card: what wind-down/goodnight target, kept fresh as the Child swipes (TKT-0004) ---
  let centeredCard: NightCardHandle = nightStrip.cards[nightStrip.centeredIndex()]!;
  const unsubscribeCenter = nightStrip.onCenterChange((index) => {
    centeredCard = nightStrip.cards[index]!;
  });

  let clouds: HTMLElement | null = null;
  let destroyed = false;
  const isAsleep = (): boolean => session.phase() === 'asleep';

  // --- idle greeting: once per session, after idleMs without input; deferred to a tap if blocked ---
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let greetingAttempted = false;
  let greetingPending = false;

  const attemptGreeting = (): void => {
    greetingAttempted = true;
    greetingPending = false;
    void deps.greeter.speak().then((started) => {
      if (!destroyed && !started && !isAsleep()) greetingPending = true;
    });
  };

  const armIdle = (): void => {
    if (greetingAttempted || isAsleep()) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(attemptGreeting, idleMs);
  };

  const resetGreeting = (): void => {
    clearTimeout(idleTimer);
    greetingAttempted = false;
    greetingPending = false;
  };

  // --- goodnight: once per session ---
  let saidGoodnight = false;
  const sayGoodnight = (): void => {
    if (saidGoodnight) return;
    saidGoodnight = true;
    if (lullabyUrl) {
      createAudio(lullabyUrl)
        .play()
        .catch(() => undefined);
    } else {
      const text = handOffLine(deps.now(), readLocation(deps.storage));
      void deps.goodnightVoice.speak({ text });
    }
  };

  // --- phase application ---
  let yawned = false;
  // The specific card that got the yawn class -- not necessarily `centeredCard` anymore by the
  // time it needs cleaning up, since the Child can swipe away mid-wind-down (TKT-0004).
  let yawnedCard: NightCardHandle | null = null;

  const applyPhase = (phase: Phase, prev: Phase | null, instant = false): void => {
    root.dataset.phase = phase;
    switch (phase) {
      case 'awake':
        clouds?.remove();
        clouds = null;
        scene.removeAttribute('inert');
        if (yawnedCard) {
          yawnedCard.body.classList.remove(YAWN_CLASS);
          yawnedCard = null;
        }
        yawned = false;
        saidGoodnight = false;
        void deps.wakeLock.release();
        if (prev !== null) {
          resetGreeting();
          armIdle();
        }
        break;
      case 'active':
        void deps.wakeLock.request();
        break;
      case 'winding-down':
        if (!yawned) {
          yawned = true;
          yawnedCard = centeredCard;
          yawnedCard.body.classList.add(YAWN_CLASS);
        }
        if (prev === null || prev === 'awake') void deps.wakeLock.request();
        break;
      case 'asleep':
        clearTimeout(idleTimer);
        greetingPending = false;
        if (!clouds) {
          clouds = buildClouds();
          scene.appendChild(clouds);
        }
        scene.setAttribute('inert', '');
        for (const card of nightStrip.cards) card.moon.classList.remove(TAP_CLASS);
        if (yawnedCard) {
          yawnedCard.body.classList.remove(YAWN_CLASS);
          yawnedCard = null;
        }
        void deps.wakeLock.release();
        if (instant) saidGoodnight = true; // reopened during the cooldown: the picture, not the ceremony
        else sayGoodnight();
        break;
    }
  };

  // --- tap: restart the spring + glow, one chime, flush a deferred greeting ---
  const restartTapAnimation = (card: NightCardHandle): void => {
    card.moon.classList.remove(TAP_CLASS);
    void card.body.offsetWidth; // reflow so the animation restarts on rapid taps
    card.moon.classList.add(TAP_CLASS);
  };

  const makeOnMoonPointerDown = (card: NightCardHandle) => (event: PointerEvent): void => {
    if (event.isPrimary === false || isAsleep()) return;
    if (session.phase() === 'awake') session.start();
    if (isAsleep()) return;
    restartTapAnimation(card);
    deps.tapSound.play();
    if (greetingPending) attemptGreeting();
  };

  const onAnyPointerDown = (): void => armIdle();

  // Delegated on nightStrip.element (not per-card): animationend bubbles, so one listener covers
  // whichever of the 15 cards actually animated (TKT-0004).
  const onAnimationEnd = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains('moon-body')) return;
    const name = (event as AnimationEvent).animationName;
    if (!name || name === 'tap-spring') target.parentElement?.classList.remove(TAP_CLASS);
    if (!name || name === 'yawn') target.classList.remove(YAWN_CLASS);
  };

  // --- visibility: re-evaluate from the wall clock, then re-acquire the wake lock ---
  const onVisibility = (visible: boolean): void => {
    if (!visible) return;
    const phase = session.evaluateNow();
    if (RUNNING.has(phase)) void deps.wakeLock.request();
  };

  // --- wire up ---
  const unsubscribeSession = session.subscribe((next, prev) => applyPhase(next, prev));
  const unsubscribeVisibility = visibility.onChange(onVisibility);
  const moonPointerDownHandlers = nightStrip.cards.map((card) => makeOnMoonPointerDown(card));
  nightStrip.cards.forEach((card, i) => card.moon.addEventListener('pointerdown', moonPointerDownHandlers[i]!));
  root.addEventListener('pointerdown', onAnyPointerDown);
  nightStrip.element.addEventListener('animationend', onAnimationEnd);

  const initial = session.phase();
  if (initial === 'asleep') {
    root.dataset.instant = '';
    setTimeout(() => delete root.dataset.instant, INSTANT_RELEASE_MS);
  }
  applyPhase(initial, null, initial === 'asleep');
  armIdle();

  return {
    frame: tonight.frame,
    phase: () => session.phase(),
    restart: () => session.restart(),
    setCalmMode(enabled: boolean): void {
      calmModeOverride = enabled;
      recomputeMotion();
    },
    destroy(): void {
      destroyed = true;
      clearTimeout(idleTimer);
      unsubscribeSession();
      unsubscribeVisibility();
      unsubscribeCenter();
      nightStrip.cards.forEach((card, i) => card.moon.removeEventListener('pointerdown', moonPointerDownHandlers[i]!));
      root.removeEventListener('pointerdown', onAnyPointerDown);
      nightStrip.element.removeEventListener('animationend', onAnimationEnd);
      void deps.wakeLock.release();
      session.destroy();
      nightStrip.destroy();
      scene.remove();
      delete root.dataset.motion;
      delete root.dataset.phase;
      delete root.dataset.instant;
    },
  };
}
