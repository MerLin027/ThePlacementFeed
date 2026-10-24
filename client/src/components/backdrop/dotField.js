/**
 * Cursor-reactive dot grid on a 2D canvas. Dots near the pointer are pushed away on springs, grow a
 * little and shift towards the brand blue; when the pointer leaves they spring back.
 *
 * Cost control: only a rectangle around the pointer (plus wherever dots are still moving) is
 * cleared and redrawn each frame, a few hundred dots rather than the whole screen; the animation
 * loop stops as soon as every dot has settled, and while the tab is hidden. No React state is
 * touched per frame.
 *
 * createDotField(canvas, options) → { destroy } or null when 2D canvas is unavailable.
 */
const GAP = 22; // same pitch as the CSS dot grid (index.css)
const BASE_R = 1.15;
const SETTLE = 0.02;

const INTENSITY = {
  hero: { radius: 150, push: 16, grow: 1.1, alpha: 0.3 },
  content: { radius: 110, push: 10, grow: 0.7, alpha: 0.22 },
};

export const createDotField = (canvas, { intensity = 'content', onFrame } = {}) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const cfg = INTENSITY[intensity] || INTENSITY.content;
  let dpr = 1;
  let width = 0;
  let height = 0;
  let cols = 0;
  let rows = 0;
  let offset = null; // Float32Array [dx, dy, vx, vy] per dot
  let pointer = null; // { x, y } in CSS px, null when away
  let held = null; // grid box of dots still displaced: they must spring back wherever the pointer goes
  let frame = 0;
  let dirty = null; // last drawn moving region { x0, y0, x1, y1 }
  let destroyed = false;

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, intensity === 'hero' ? 2 : 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    cols = Math.ceil(width / GAP) + 1;
    rows = Math.ceil(height / GAP) + 1;
    offset = new Float32Array(cols * rows * 4);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawRegion(0, 0, width, height);
  };

  // Redraws every dot whose rest position lies in the region (padded by the push distance)
  const drawRegion = (x0, y0, x1, y1) => {
    const pad = cfg.push + 4;
    const cx0 = Math.max(0, Math.floor((x0 - pad) / GAP));
    const cy0 = Math.max(0, Math.floor((y0 - pad) / GAP));
    const cx1 = Math.min(cols - 1, Math.ceil((x1 + pad) / GAP));
    const cy1 = Math.min(rows - 1, Math.ceil((y1 + pad) / GAP));
    ctx.clearRect(cx0 * GAP - pad, cy0 * GAP - pad, (cx1 - cx0) * GAP + pad * 2, (cy1 - cy0) * GAP + pad * 2);
    for (let cy = cy0; cy <= cy1; cy += 1) {
      for (let cx = cx0; cx <= cx1; cx += 1) {
        const i = (cy * cols + cx) * 4;
        const rx = cx * GAP + 1;
        const ry = cy * GAP + 1;
        const dx = offset[i];
        const dy = offset[i + 1];
        // Displacement drives the highlight: 0 at rest, 1 at full push
        const t = Math.min(1, Math.hypot(dx, dy) / cfg.push);
        const r = BASE_R * (1 + cfg.grow * t);
        const a = cfg.alpha + (0.85 - cfg.alpha) * t;
        ctx.fillStyle = t > 0.02 ? `rgba(37, 99, 235, ${a.toFixed(3)})` : `rgba(0, 74, 198, ${cfg.alpha})`;
        ctx.beginPath();
        ctx.arc(rx + dx, ry + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const step = () => {
    frame = 0;
    if (destroyed) return;
    onFrame?.();
    const reach = cfg.radius + cfg.push;
    let moving = false;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const grow = (x, y) => {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    };

    // Only dots near the pointer or still displaced need physics
    const span = Math.ceil(reach / GAP) + 1;
    let nextHeld = null;
    const visit = (cx, cy) => {
      const i = (cy * cols + cx) * 4;
      const rx = cx * GAP + 1;
      const ry = cy * GAP + 1;
      let tx = 0;
      let ty = 0;
      if (pointer) {
        const ddx = rx - pointer.x;
        const ddy = ry - pointer.y;
        const dist = Math.hypot(ddx, ddy);
        if (dist < cfg.radius && dist > 0.001) {
          const falloff = (1 - dist / cfg.radius) ** 2;
          tx = (ddx / dist) * cfg.push * falloff;
          ty = (ddy / dist) * cfg.push * falloff;
        }
      }
      // Damped spring towards the target offset
      offset[i + 2] = offset[i + 2] * 0.78 + (tx - offset[i]) * 0.14;
      offset[i + 3] = offset[i + 3] * 0.78 + (ty - offset[i + 1]) * 0.14;
      offset[i] += offset[i + 2];
      offset[i + 1] += offset[i + 3];
      // Settled = at its target and not moving (a dot pushed by a resting pointer is settled too)
      const off = Math.abs(tx - offset[i]) + Math.abs(ty - offset[i + 1]) + Math.abs(offset[i + 2]) + Math.abs(offset[i + 3]);
      if (off > SETTLE) {
        moving = true;
        grow(rx, ry);
      } else if (offset[i] !== tx || offset[i + 1] !== ty) {
        offset[i] = tx;
        offset[i + 1] = ty;
        offset[i + 2] = offset[i + 3] = 0;
        grow(rx, ry); // repaint once at the exact resting spot
      }
      if (offset[i] !== 0 || offset[i + 1] !== 0) {
        nextHeld = nextHeld
          ? { x0: Math.min(nextHeld.x0, cx), y0: Math.min(nextHeld.y0, cy), x1: Math.max(nextHeld.x1, cx), y1: Math.max(nextHeld.y1, cy) }
          : { x0: cx, y0: cy, x1: cx, y1: cy };
      }
    };

    // Region to simulate: around the pointer, plus the last region that was still moving
    let sx0 = Infinity;
    let sy0 = Infinity;
    let sx1 = -Infinity;
    let sy1 = -Infinity;
    if (pointer) {
      sx0 = Math.floor(pointer.x / GAP) - span;
      sy0 = Math.floor(pointer.y / GAP) - span;
      sx1 = Math.floor(pointer.x / GAP) + span;
      sy1 = Math.floor(pointer.y / GAP) + span;
    }
    if (held) {
      sx0 = Math.min(sx0, held.x0 - 1);
      sy0 = Math.min(sy0, held.y0 - 1);
      sx1 = Math.max(sx1, held.x1 + 1);
      sy1 = Math.max(sy1, held.y1 + 1);
    }
    if (dirty) {
      sx0 = Math.min(sx0, Math.floor(dirty.x0 / GAP) - 1);
      sy0 = Math.min(sy0, Math.floor(dirty.y0 / GAP) - 1);
      sx1 = Math.max(sx1, Math.ceil(dirty.x1 / GAP) + 1);
      sy1 = Math.max(sy1, Math.ceil(dirty.y1 / GAP) + 1);
    }
    sx0 = Math.max(0, sx0);
    sy0 = Math.max(0, sy0);
    sx1 = Math.min(cols - 1, sx1);
    sy1 = Math.min(rows - 1, sy1);
    for (let cy = sy0; cy <= sy1; cy += 1) {
      for (let cx = sx0; cx <= sx1; cx += 1) visit(cx, cy);
    }

    // Repaint what moved this frame and what moved last frame (so dots return cleanly)
    const region = x0 !== Infinity ? { x0, y0, x1, y1 } : null;
    const paint = [region, dirty].filter(Boolean);
    if (paint.length > 0) {
      drawRegion(
        Math.min(...paint.map((p) => p.x0)),
        Math.min(...paint.map((p) => p.y0)),
        Math.max(...paint.map((p) => p.x1)),
        Math.max(...paint.map((p) => p.y1))
      );
    }
    dirty = moving ? region : null;
    held = nextHeld;
    if (moving) frame = requestAnimationFrame(step);
  };

  const wake = () => {
    if (!frame && !destroyed && document.visibilityState === 'visible') frame = requestAnimationFrame(step);
  };

  const onMove = (e) => {
    pointer = { x: e.clientX, y: e.clientY };
    wake();
  };
  const onLeave = () => {
    pointer = null;
    wake();
  };
  const onVisibility = () => {
    if (document.visibilityState !== 'visible' && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  };

  resize();
  window.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  window.addEventListener('blur', onLeave);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', onResize);

  return {
    destroy() {
      destroyed = true;
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(resizeTimer);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
    },
  };
};
