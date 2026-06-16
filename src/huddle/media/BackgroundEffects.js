export const HUDDLE_BACKGROUND_EFFECTS = Object.freeze({
  OFF: "off",
  BLUR: "blur",
  REPLACEMENT: "replacement",
});

let processorsPromise = null;
const imagePreloads = new Map();

function betaFlagEnabled(value) {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "").trim().toLowerCase()
  );
}

export function backgroundEffectsBetaEnabled() {
  return betaFlagEnabled(
    import.meta.env?.VITE_HUDDLE_BACKGROUND_EFFECTS_BETA_ENABLED
  );
}

function now() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function duration(startedAt) {
  return Math.max(0, Math.round(now() - startedAt));
}

function loadProcessors() {
  if (!processorsPromise) {
    processorsPromise = import("@livekit/track-processors");
  }
  return processorsPromise;
}

function preloadImage(imagePath) {
  if (!imagePath || typeof Image === "undefined") return Promise.resolve(false);
  if (!imagePreloads.has(imagePath)) {
    imagePreloads.set(
      imagePath,
      new Promise((resolve) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src = imagePath;
        if (typeof image.decode === "function") {
          image.decode().then(() => resolve(true)).catch(() => {});
        }
      })
    );
  }
  return imagePreloads.get(imagePath);
}

export async function preloadBackgroundEffects({ imagePaths = [] } = {}) {
  const support = getBackgroundEffectSupport();
  if (!support.supported) {
    return { ok: false, reason: "background_effect_not_supported", support };
  }
  const startedAt = now();
  const moduleStartedAt = now();
  await loadProcessors();
  const moduleLoadMs = duration(moduleStartedAt);
  const imagesStartedAt = now();
  const imageResults = await Promise.all(imagePaths.map(preloadImage));
  return {
    ok: true,
    reason: "background_effect_assets_preloaded",
    moduleLoadMs,
    imagePreloadMs: duration(imagesStartedAt),
    totalPreloadMs: duration(startedAt),
    imageCount: imageResults.filter(Boolean).length,
    observedAt: new Date().toISOString(),
  };
}

export function getBackgroundEffectSupport() {
  try {
    const betaEnabled = backgroundEffectsBetaEnabled();
    const userAgent = globalThis.navigator?.userAgent || "";
    const ios = /iPad|iPhone|iPod/i.test(userAgent);
    const mobile = /Android|iPad|iPhone|iPod|Mobile/i.test(userAgent);
    const hardwareConcurrency = Number(
      globalThis.navigator?.hardwareConcurrency || 0
    );
    const deviceMemory = Number(globalThis.navigator?.deviceMemory || 0);
    const canvasFallback =
      typeof globalThis.HTMLCanvasElement !== "undefined" &&
      typeof globalThis.HTMLCanvasElement.prototype?.captureStream === "function";
    const modern =
      typeof globalThis.MediaStreamTrackProcessor !== "undefined" &&
      typeof globalThis.MediaStreamTrackGenerator !== "undefined";
    const processingSupported = Boolean(
      !ios &&
      globalThis.navigator?.mediaDevices?.getUserMedia &&
      (modern || canvasFallback)
    );
    const constrainedDevice =
      mobile &&
      ((hardwareConcurrency > 0 && hardwareConcurrency < 6) ||
        (deviceMemory > 0 && deviceMemory < 4));
    return {
      supported: betaEnabled && processingSupported && !constrainedDevice,
      blurSupported: betaEnabled && processingSupported && !constrainedDevice,
      replacementSupported:
        betaEnabled &&
        processingSupported &&
        modern &&
        !mobile &&
        (hardwareConcurrency === 0 || hardwareConcurrency >= 6),
      betaEnabled,
      modern,
      mobile,
      constrainedDevice,
      hardwareConcurrency: hardwareConcurrency || null,
      deviceMemory: deviceMemory || null,
      providerIndependent: true,
      webOnly: true,
    };
  } catch {
    return {
      supported: false,
      blurSupported: false,
      replacementSupported: false,
      betaEnabled: false,
      modern: false,
      providerIndependent: true,
      webOnly: true,
    };
  }
}

function processorOptions({ mode, imagePath = null, blurRadius = 8 }) {
  if (mode === HUDDLE_BACKGROUND_EFFECTS.BLUR) {
    return {
      mode: "background-blur",
      blurRadius: Math.min(Math.max(Number(blurRadius) || 12, 4), 24),
    };
  }
  if (mode === HUDDLE_BACKGROUND_EFFECTS.REPLACEMENT) {
    if (!imagePath) throw new Error("background_replacement_image_required");
    return { mode: "virtual-background", imagePath };
  }
  return { mode: "disabled" };
}

export async function applyBackgroundEffect({
  localVideoTrack,
  processor = null,
  mode = HUDDLE_BACKGROUND_EFFECTS.OFF,
  imagePath = null,
  blurRadius = 8,
}) {
  const support = getBackgroundEffectSupport();
  const modeSupported =
    mode === HUDDLE_BACKGROUND_EFFECTS.OFF ||
    (mode === HUDDLE_BACKGROUND_EFFECTS.BLUR && support.blurSupported) ||
    (mode === HUDDLE_BACKGROUND_EFFECTS.REPLACEMENT &&
      support.replacementSupported);
  if (!modeSupported || !localVideoTrack?.setProcessor) {
    return {
      ok: false,
      reason:
        mode === HUDDLE_BACKGROUND_EFFECTS.REPLACEMENT
          ? "background_replacement_not_supported"
          : "background_effect_not_supported",
      processor,
      support,
    };
  }

  const options = processorOptions({ mode, imagePath, blurRadius });
  const totalStartedAt = now();
  const moduleStartedAt = now();
  const {
    BackgroundProcessor,
    supportsBackgroundProcessors,
    supportsModernBackgroundProcessors,
  } = await loadProcessors();
  const moduleLoadMs = duration(moduleStartedAt);
  if (!supportsBackgroundProcessors()) {
    return {
      ok: false,
      reason: "background_effect_not_supported",
      processor,
      support: { ...support, supported: false },
    };
  }
  let activeProcessor = processor;
  let processorAttachMs = 0;
  if (!activeProcessor) {
    const attachStartedAt = now();
    activeProcessor = BackgroundProcessor({ mode: "disabled" });
    await localVideoTrack.setProcessor(activeProcessor);
    processorAttachMs = duration(attachStartedAt);
  }
  const switchStartedAt = now();
  await activeProcessor.switchTo(options);
  const switchMs = duration(switchStartedAt);
  return {
    ok: true,
    reason: "background_effect_updated",
    processor: activeProcessor,
    support,
    mode,
    modern: Boolean(supportsModernBackgroundProcessors()),
    imagePathConfigured: Boolean(imagePath),
    timings: {
      moduleLoadMs,
      processorAttachMs,
      switchMs,
      totalMs: duration(totalStartedAt),
    },
    observedAt: new Date().toISOString(),
  };
}

export async function destroyBackgroundEffect(processor) {
  if (!processor) return;
  try {
    await processor.destroy();
  } catch {
    // Call cleanup must continue even when the browser already ended the track.
  }
}

export default {
  HUDDLE_BACKGROUND_EFFECTS,
  backgroundEffectsBetaEnabled,
  getBackgroundEffectSupport,
  preloadBackgroundEffects,
  applyBackgroundEffect,
  destroyBackgroundEffect,
};
