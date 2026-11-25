// One definition of the 2D map -> 3D basilica path, used by the GPU shader (app.js copies the same
// numbers into GLSL), by picking, and by every overlay (corridors, labels). So lines and labels move
// with the points, and nothing jumps.
//
// Each point has a delay d in [0, 1 - WINDOW]. Built stones: low stones and old cohorts first,
// so the basilica grows from the ground up; scaffold points come last. Going back, the order reverses.
// Each point flies on a quadratic Bezier curve that swings toward the viewer, not on a straight line.
export const WINDOW = 0.45;
export const MAX_DELAY = 1 - WINDOW;

export function localMorph(g, d) {
  const t = Math.min(1, Math.max(0, (g - d) / WINDOW));
  return t * t * (3 - 2 * t);
}

// control point offset for the Bezier curve (same numbers as the shader)
export function ctrlOffset(branch) {
  return [0, -6, 16 + (branch - 2.5) * 3];
}

// p0 = map position, p1 = basilica position, m = local morph (0-1). Writes to out (array of 3).
export function bezier(out, p0, p1, branch, m) {
  const o = ctrlOffset(branch), a = (1 - m) * (1 - m), b = 2 * (1 - m) * m, c = m * m;
  for (let k = 0; k < 3; k++) {
    const ctrl = (p0[k] + p1[k]) * 0.5 + o[k];
    out[k] = a * p0[k] + b * ctrl + c * p1[k];
  }
  return out;
}

// Delay for one stone point: height share hn (0 bottom, 1 top), cohort share cn, jitter 0-1
export function stoneDelay(hn, cn, jitter) {
  return Math.min(MAX_DELAY, Math.max(0, MAX_DELAY * (0.62 * hn + 0.3 * cn) + 0.08 * MAX_DELAY * jitter));
}
// Delay for one scaffold (gap) point: after the stones
export function ghostDelay(hn) {
  return Math.min(MAX_DELAY, 0.72 * MAX_DELAY + 0.28 * MAX_DELAY * hn);
}

// Camera pose between two presets: direction is slerped, distance and target are lerped.
export function camPose(from, to, k, outPos, outTarget) {
  outTarget.lerpVectors(from.target, to.target, k);
  const a = from.pos.clone().sub(from.target), b = to.pos.clone().sub(to.target);
  const la = a.length(), lb = b.length();
  a.normalize(); b.normalize();
  const dot = Math.min(1, Math.max(-1, a.dot(b))), om = Math.acos(dot);
  let dir;
  if (om < 1e-4) dir = a.clone().lerp(b, k).normalize();
  else {
    const s = Math.sin(om);
    dir = a.clone().multiplyScalar(Math.sin((1 - k) * om) / s).add(b.clone().multiplyScalar(Math.sin(k * om) / s));
  }
  outPos.copy(outTarget).addScaledVector(dir, la + (lb - la) * k);
}
