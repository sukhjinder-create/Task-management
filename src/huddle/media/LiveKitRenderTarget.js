const renderTargets = new WeakMap();

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function bounded(value, minimum, maximum) {
  return Math.min(Math.max(Math.round(value), minimum), maximum);
}

function isMobileMediaDevice() {
  return (
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "")
  );
}

export function getLiveKitRenderTarget(publication) {
  return publication ? renderTargets.get(publication) || null : null;
}

export function updateLiveKitRenderTarget(publication, {
  width,
  height,
  visible = true,
  source = "camera",
  mediaWidth = null,
  mediaHeight = null,
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
  const sourceWidth = positiveNumber(mediaWidth);
  const sourceHeight = positiveNumber(mediaHeight);
  const sourcePortrait = sourceHeight > sourceWidth;
  const mobile = isMobileMediaDevice();
  let targetCssWidth = cssWidth;
  let targetCssHeight = cssHeight;
  if (!screenShare && sourceWidth && sourceHeight) {
    const scale = Math.min(cssWidth / sourceWidth, cssHeight / sourceHeight);
    if (scale > 0) {
      targetCssWidth = sourceWidth * scale;
      targetCssHeight = sourceHeight * scale;
    }
  }
  const maxCameraWidth = sourcePortrait ? 720 : 1280;
  const maxCameraHeight = sourcePortrait ? 1280 : 720;
  const minimumCameraWidth = mobile ? 160 : maxCameraWidth;
  const minimumCameraHeight = mobile ? 90 : maxCameraHeight;
  const rawTargetWidth = targetCssWidth * pixelRatio;
  const rawTargetHeight = targetCssHeight * pixelRatio;
  const target = {
    cssWidth: Math.round(cssWidth),
    cssHeight: Math.round(cssHeight),
    contentCssWidth: Math.round(targetCssWidth),
    contentCssHeight: Math.round(targetCssHeight),
    sourceWidth: sourceWidth || null,
    sourceHeight: sourceHeight || null,
    width: bounded(
      !screenShare ? Math.max(rawTargetWidth, minimumCameraWidth) : rawTargetWidth,
      160,
      screenShare ? 1920 : maxCameraWidth
    ),
    height: bounded(
      !screenShare ? Math.max(rawTargetHeight, minimumCameraHeight) : rawTargetHeight,
      90,
      screenShare ? 1080 : maxCameraHeight
    ),
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
