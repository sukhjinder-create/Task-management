const renderTargets = new WeakMap();

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function bounded(value, minimum, maximum) {
  return Math.min(Math.max(Math.round(value), minimum), maximum);
}

export function getLiveKitRenderTarget(publication) {
  return publication ? renderTargets.get(publication) || null : null;
}

export function updateLiveKitRenderTarget(publication, {
  width,
  height,
  visible = true,
  source = "camera",
} = {}) {
  if (!publication || typeof publication.setVideoDimensions !== "function") {
    return null;
  }

  const cssWidth = positiveNumber(width);
  const cssHeight = positiveNumber(height);
  if (!cssWidth || !cssHeight) return null;

  const pixelRatio = Math.min(
    Math.max(positiveNumber(globalThis.devicePixelRatio) || 1, 1),
    2
  );
  const screenShare = source === "screen" || source === "screen_share";
  const target = {
    cssWidth: Math.round(cssWidth),
    cssHeight: Math.round(cssHeight),
    width: bounded(cssWidth * pixelRatio, 160, screenShare ? 1920 : 1280),
    height: bounded(cssHeight * pixelRatio, 90, screenShare ? 1080 : 720),
    framesPerSecond: screenShare ? 30 : cssWidth >= 720 ? 30 : 24,
    pixelRatio,
    source,
    visible: Boolean(visible),
    observedAt: new Date().toISOString(),
  };
  const previous = renderTargets.get(publication);
  const materiallyChanged =
    !previous ||
    Math.abs(previous.width - target.width) >= 24 ||
    Math.abs(previous.height - target.height) >= 24 ||
    previous.visible !== target.visible ||
    previous.source !== target.source;

  if (materiallyChanged) {
    publication.setVideoDimensions({
      width: target.width,
      height: target.height,
    });
    publication.setVideoFPS?.(target.framesPerSecond);
  }
  renderTargets.set(publication, target);
  return target;
}

export function clearLiveKitRenderTarget(publication) {
  if (publication) renderTargets.delete(publication);
}
