let touchDevice =
  "ontouchstart" in window || navigator.maxTouchPoints > 0;

const listeners: ((isTouch: boolean) => void)[] = [];
let initialized = false;

function setTouchMode(isTouch: boolean): void {
  if (touchDevice === isTouch) return;
  touchDevice = isTouch;
  document.documentElement.classList.toggle("touch", isTouch);
  document.documentElement.classList.toggle("no-touch", !isTouch);
  for (const cb of listeners) cb(isTouch);
}

export function initDeviceDetection(): void {
  if (initialized) return;
  initialized = true;

  document.documentElement.classList.add(touchDevice ? "touch" : "no-touch");

  let lastTouchTime = 0;

  window.addEventListener(
    "touchstart",
    () => {
      lastTouchTime = Date.now();
      setTouchMode(true);
    },
    { passive: true },
  );

  window.addEventListener(
    "mousemove",
    () => {
      // Ignore synthetic mouse events that follow touch
      if (Date.now() - lastTouchTime < 500) return;
      setTouchMode(false);
    },
    { passive: true },
  );
}

export function isTouchDevice(): boolean {
  return touchDevice;
}

export function onInputModeChange(cb: (isTouch: boolean) => void): void {
  listeners.push(cb);
}
