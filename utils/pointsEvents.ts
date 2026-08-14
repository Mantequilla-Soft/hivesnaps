// RN has no window.dispatchEvent/CustomEvent — this is the mobile stand-in
// for the DOM CustomEvent snapie.io's web client uses to notify the toast
// and any live balance display the instant an award lands on this device.

export interface PointsEarnedDetail {
  awarded: number;
  balance: number;
}

type Listener = (detail: PointsEarnedDetail) => void;

const listeners = new Set<Listener>();

export function onPointsEarned(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function emitPointsEarned(detail: PointsEarnedDetail): void {
  listeners.forEach(cb => cb(detail));
}
