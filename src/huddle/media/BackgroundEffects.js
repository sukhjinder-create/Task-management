export const HUDDLE_BACKGROUND_EFFECTS = Object.freeze({
  OFF: "off",
  BLUR: "blur",
  REPLACEMENT: "replacement",
});

let processorsPromise = null;

function loadProcessors() {
  if (!processorsPromise) {
    processorsPromise = import("@livekit/track-processors");
  }
  return processorsPromise;
}

export function getBackgroundEffectSupport() {
  try {
    const userAgent = globalThis.navigator?.userAgent || "";
    const ios = /iPad|iPhone|iPod/i.test(userAgent);
    const canvasFallback =
      typeof globalThis.HTMLCanvasElement !== "undefined" &&
      typeof globalThis.HTMLCanvasElement.prototype?.captureStream === "function";
    const modern =
      typeof globalThis.MediaStreamTrackProcessor !== "undefined" &&
      typeof globalThis.MediaStreamTrackGenerator !== "undefined";
    return {
      supported: Boolean(
        !ios &&
        globalThis.navigator?.mediaDevices?.getUserMedia &&
        (modern || canvasFallback)
      ),
      modern,
      providerIndependent: true,
      webOnly: true,
    };
  } catch {
    return {
      supported: false,
      modern: false,
      providerIndependent: true,
      webOnly: true,
    };
  }
}

function processorOptions({ mode, imagePath = null, blurRadius = 12 }) {
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
  blurRadius = 12,
}) {
  const support = getBackgroundEffectSupport();
  if (!support.supported || !localVideoTrack?.setProcessor) {
    return {
      ok: false,
      reason: "background_effect_not_supported",
      processor,
      support,
    };
  }

  const options = processorOptions({ mode, imagePath, blurRadius });
  const {
    BackgroundProcessor,
    supportsBackgroundProcessors,
    supportsModernBackgroundProcessors,
  } = await loadProcessors();
  if (!supportsBackgroundProcessors()) {
    return {
      ok: false,
      reason: "background_effect_not_supported",
      processor,
      support: { ...support, supported: false },
    };
  }
  let activeProcessor = processor;
  if (!activeProcessor) {
    activeProcessor = BackgroundProcessor({ mode: "disabled" });
    await localVideoTrack.setProcessor(activeProcessor);
  }
  await activeProcessor.switchTo(options);
  return {
    ok: true,
    reason: "background_effect_updated",
    processor: activeProcessor,
    support,
    mode,
    modern: Boolean(supportsModernBackgroundProcessors()),
    imagePathConfigured: Boolean(imagePath),
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
  getBackgroundEffectSupport,
  applyBackgroundEffect,
  destroyBackgroundEffect,
};
