'use client';

import { useEffect, useRef, useState, type ComponentProps } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import './grid-reveal.css';

export type GridRevealProps = Omit<ComponentProps<'div'>, 'children' | 'onError'> & {
  src?: string | null;
  alt?: string;
  /** The output aspect ratio. Images are contained, never cropped. */
  aspect?: number;
  caption?: string;
  status?: 'pending' | 'error' | 'cancelled';
  errorMessage?: string;
  /** Decorative pacing only. This is never exposed as provider progress. */
  progress?: number;
  estimatedDuration?: number;
  onRevealComplete?: () => void;
  onError?: () => void;
  onRetry?: () => void;
};

type Cell = {
  x: number; y: number; w: number; h: number;
  r: number; g: number; b: number; tone: number;
  detail: number; splitAt: number; parent: Cell | null; kids: [Cell, Cell] | null;
};
type Sums = { n: number; r: number; g: number; b: number; l: number; l2: number };
type Patch = Pick<Cell, 'x' | 'y' | 'w' | 'h' | 'r' | 'g' | 'b' | 'tone'>;
type Scene = {
  ctx: CanvasRenderingContext2D; root: Cell; width: number; height: number; scale: number;
  base: [number, number, number]; clock: number; split: number; tint: number; hasColors: boolean;
  image: HTMLImageElement | null;
};

const CELLS = 180;
const OPENING_CELLS = 4;
const WAIT_CAP = 0.72;
const LAST_SPLIT = 0.92;
const MORPH = 0.055;
const SAMPLE = 128;
const REVEAL_MS = 420;
const clamp01 = (n: number) => Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function smoothstep(a: number, b: number, x: number) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

function hash(x: number, y: number, z: number) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function makeCell(x: number, y: number, w: number, h: number, parent: Cell | null): Cell {
  return { x, y, w, h, r: 0, g: 0, b: 0, tone: hash(x + 3.1, y + 1.7, w * 31.7), detail: 0, splitAt: 0, parent, kids: null };
}

function buildTree(aspect: number) {
  const root = makeCell(0, 0, 1, 1, null);
  const leaves: Cell[] = [root];
  const branches: Cell[] = [];
  while (leaves.length < CELLS) {
    let pick = 0;
    let widest = -1;
    for (let i = 0; i < leaves.length; i++) {
      const c = leaves[i];
      const area = c.w * aspect * c.h * (1 + 0.12 * hash(c.x, c.y, 7.3));
      if (area > widest) { widest = area; pick = i; }
    }
    const parent = leaves.splice(pick, 1)[0];
    const wide = parent.w * aspect >= parent.h;
    const half = wide ? parent.w / 2 : parent.h / 2;
    const a = wide ? makeCell(parent.x, parent.y, half, parent.h, parent) : makeCell(parent.x, parent.y, parent.w, half, parent);
    const b = wide ? makeCell(parent.x + half, parent.y, half, parent.h, parent) : makeCell(parent.x, parent.y + half, parent.w, half, parent);
    parent.kids = [a, b];
    branches.push(parent);
    leaves.push(a, b);
  }
  const opening = OPENING_CELLS - 1;
  const rest = Math.max(1, branches.length - opening);
  branches.forEach((cell, i) => { cell.splitAt = i < opening ? -MORPH : (LAST_SPLIT * (i - opening + 1)) / rest; });
  return { root, branches };
}

function measureTree(root: Cell, pixels: Uint8ClampedArray, size: number) {
  const gather = (cell: Cell): Sums => {
    let s: Sums;
    if (cell.kids) {
      const a = gather(cell.kids[0]);
      const b = gather(cell.kids[1]);
      s = { n: a.n + b.n, r: a.r + b.r, g: a.g + b.g, b: a.b + b.b, l: a.l + b.l, l2: a.l2 + b.l2 };
    } else {
      s = { n: 0, r: 0, g: 0, b: 0, l: 0, l2: 0 };
      const x0 = Math.round(cell.x * size);
      const y0 = Math.round(cell.y * size);
      const x1 = Math.min(size, Math.max(x0 + 1, Math.round((cell.x + cell.w) * size)));
      const y1 = Math.min(size, Math.max(y0 + 1, Math.round((cell.y + cell.h) * size)));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * size + x) * 4;
          const r = pixels[i]; const g = pixels[i + 1]; const b = pixels[i + 2];
          const l = 0.299 * r + 0.587 * g + 0.114 * b;
          s.n++; s.r += r; s.g += g; s.b += b; s.l += l; s.l2 += l * l;
        }
      }
    }
    const n = s.n || 1;
    cell.r = s.r / n; cell.g = s.g / n; cell.b = s.b / n;
    cell.detail = Math.max(0, s.l2 / n - (s.l / n) * (s.l / n));
    return s;
  };
  gather(root);
}

function orderByDetail(branches: Cell[], openedBefore: number) {
  const pending = branches.filter((c) => c.splitAt > openedBefore);
  const slots = pending.map((c) => c.splitAt).sort((a, b) => a - b);
  const queue = pending.filter((c) => !c.parent || c.parent.splitAt <= openedBefore);
  let next = 0;
  while (queue.length && next < slots.length) {
    let pick = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i].detail > queue[pick].detail) pick = i;
    const cell = queue.splice(pick, 1)[0];
    cell.splitAt = slots[next++];
    for (const kid of cell.kids ?? []) if (kid.kids) queue.push(kid);
  }
}

function containRect(iw: number, ih: number, w: number, h: number) {
  const scale = Math.min(w / iw, h / ih);
  return { dx: (w - iw * scale) / 2, dy: (h - ih * scale) / 2, dw: iw * scale, dh: ih * scale };
}

function drawScene(s: Scene) {
  const { ctx, root, width, height, split } = s;
  const tint = s.hasColors ? s.tint : 0;
  const shade = (channel: number, target: number, tone: number) => Math.round(mix(channel + tone * 12 + Math.sin(s.clock * 1.5 + tone * 6.28) * 2, target, tint));
  ctx.fillStyle = `rgb(${s.base.join(',')})`;
  ctx.fillRect(0, 0, width, height);
  const soft = 1 - smoothstep(0.35, 0.75, split);
  const gutter = s.scale * soft;
  const rounded = soft > 0.01 && typeof ctx.roundRect === 'function';
  const paint = (p: Patch) => {
    const x = Math.round(p.x); const y = Math.round(p.y);
    const w = Math.round(p.x + p.w) - x; const h = Math.round(p.y + p.h) - y;
    const left = x <= 0 ? 0 : gutter; const top = y <= 0 ? 0 : gutter;
    const innerW = w - left - (x + w >= width ? 0 : gutter);
    const innerH = h - top - (y + h >= height ? 0 : gutter);
    if (innerW <= 0 || innerH <= 0) return;
    ctx.fillStyle = `rgb(${shade(s.base[0], p.r, p.tone)},${shade(s.base[1], p.g, p.tone)},${shade(s.base[2], p.b, p.tone)})`;
    if (rounded) {
      ctx.beginPath(); ctx.roundRect(x + left, y + top, innerW, innerH, Math.min(innerW, innerH) * 0.12 * soft); ctx.fill();
    } else ctx.fillRect(x + left, y + top, innerW, innerH);
  };
  const walk = (cell: Cell, p: Patch) => {
    if (!cell.kids || split < cell.splitAt) { paint(p); return; }
    const t = easeOut(clamp01((split - cell.splitAt) / MORPH));
    for (const kid of cell.kids) walk(kid, {
      x: mix(p.x, kid.x * width, t), y: mix(p.y, kid.y * height, t),
      w: mix(p.w, kid.w * width, t), h: mix(p.h, kid.h * height, t),
      r: mix(p.r, kid.r, t), g: mix(p.g, kid.g, t), b: mix(p.b, kid.b, t), tone: mix(p.tone, kid.tone, t),
    });
  };
  walk(root, { x: 0, y: 0, w: width, h: height, r: root.r, g: root.g, b: root.b, tone: root.tone });
  if (s.image) {
    const fit = containRect(s.image.naturalWidth, s.image.naturalHeight, width, height);
    ctx.globalAlpha = smoothstep(0.35, 1, s.tint);
    ctx.drawImage(s.image, fit.dx, fit.dy, fit.dw, fit.dh);
    ctx.globalAlpha = 1;
  }
}

function readAverages(image: HTMLImageElement, scene: Scene, branches: Cell[]) {
  const buffer = document.createElement('canvas');
  buffer.width = SAMPLE; buffer.height = SAMPLE;
  const ctx = buffer.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.fillStyle = `rgb(${scene.base.join(',')})`;
  ctx.fillRect(0, 0, SAMPLE, SAMPLE);
  // Match the visible frame, including letterboxing, without cropping the artwork.
  const sampleHeight = Math.max(1, Math.round(SAMPLE * scene.height / Math.max(1, scene.width)));
  const fit = containRect(image.naturalWidth, image.naturalHeight, SAMPLE, sampleHeight);
  ctx.drawImage(image, fit.dx, fit.dy * SAMPLE / sampleHeight, fit.dw, fit.dh * SAMPLE / sampleHeight);
  try {
    measureTree(scene.root, ctx.getImageData(0, 0, SAMPLE, SAMPLE).data, SAMPLE);
    orderByDetail(branches, scene.split);
    return true;
  } catch {
    // Cross-origin images without pixel-read permission still reveal normally.
    return false;
  }
}

/** Decorative waiting state. Completion always follows the actual image load. */
export function GridReveal(props: GridRevealProps) {
  const [attempt, setAttempt] = useState(0);
  return <GridRevealFrame key={`${props.src ?? ''}:${attempt}`} {...props} retry={() => {
    setAttempt((value) => value + 1);
    props.onRetry?.();
  }} />;
}

function GridRevealFrame({
  src, alt = '', aspect = 1, caption, status = 'pending', errorMessage,
  progress, estimatedDuration = 6000, onRevealComplete, onError, onRetry,
  retry, className, style, ...props
}: GridRevealProps & { retry: () => void }) {
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [reduced, setReduced] = useState(false);
  const completed = useRef(false);
  const errorReported = useRef(false);
  const callbacks = useRef({ onRevealComplete, onError, progress, estimatedDuration });
  useEffect(() => { callbacks.current = { onRevealComplete, onError, progress, estimatedDuration }; });

  const complete = () => {
    setRevealed(true);
    if (!completed.current) { completed.current = true; callbacks.current.onRevealComplete?.(); }
  };
  const fail = () => {
    setFailed(true);
    if (!errorReported.current) { errorReported.current = true; callbacks.current.onError?.(); }
  };

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame || status !== 'pending' || failed) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try { ctx = canvas.getContext('2d'); } catch { /* Native image fallback. */ }
    if (!ctx) { setFallback(true); return; }
    const { root, branches } = buildTree(ratio);
    const rgb = window.getComputedStyle(frame).backgroundColor.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    const scene: Scene = {
      ctx, root, width: 0, height: 0, scale: 1,
      base: rgb?.length === 3 ? rgb as [number, number, number] : [34, 34, 34],
      clock: 0, split: 0, tint: 0, hasColors: false, image: null,
    };
    let frameId = 0;
    let last = 0;
    let elapsed = 0;
    let revealElapsed = 0;
    let revealFrom = 0;
    let stopped = false;
    let inView = true;
    const isReduced = () => reduced || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finish = () => {
      stopped = true;
      scene.split = 1; scene.tint = 1;
      drawScene(scene);
      setRevealed(true);
      if (!completed.current) { completed.current = true; callbacks.current.onRevealComplete?.(); }
    };
    const resize = () => {
      const rect = frame.getBoundingClientRect();
      scene.scale = Math.min(window.devicePixelRatio || 1, 2);
      scene.width = Math.max(1, Math.round(rect.width * scene.scale));
      scene.height = Math.max(1, Math.round(rect.height * scene.scale));
      canvas.width = scene.width; canvas.height = scene.height;
      drawScene(scene);
    };
    resize();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(frame);
    const image = imageRef.current;
    if (loaded && image?.naturalWidth && image.naturalHeight) {
      scene.image = image;
      scene.hasColors = readAverages(image, scene, branches);
      revealFrom = scene.split;
      if (isReduced()) finish();
    }
    const tick = (now: number) => {
      if (stopped || !inView || document.hidden) return;
      const dt = last ? Math.min(now - last, 50) : 0;
      last = now; elapsed += dt; scene.clock = elapsed / 1000;
      if (scene.image) {
        revealElapsed += dt;
        const amount = clamp01(revealElapsed / REVEAL_MS);
        scene.split = mix(revealFrom, 1, easeOut(amount));
        scene.tint = smoothstep(0, 1, amount);
        if (amount === 1) { finish(); return; }
      } else {
        const duration = Math.max(1000, callbacks.current.estimatedDuration || 6000);
        const supplied = callbacks.current.progress;
        const target = supplied === undefined ? WAIT_CAP * (1 - Math.exp(-elapsed / duration)) : Math.min(WAIT_CAP, clamp01(supplied));
        scene.split += (target - scene.split) * (1 - Math.exp(-dt / 180));
      }
      drawScene(scene);
      frameId = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frameId);
      last = 0;
      if (isReduced()) {
        if (scene.image) finish(); else { scene.split = WAIT_CAP; drawScene(scene); }
      } else if (!stopped && inView && !document.hidden) frameId = requestAnimationFrame(tick);
    };
    const visibility = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting; sync();
    }, { rootMargin: '100px' }) : null;
    visibility?.observe(frame);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
      observer?.disconnect(); visibility?.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [failed, loaded, ratio, reduced, status]);

  useEffect(() => {
    if (loaded && (fallback || reduced) && status === 'pending' && !failed) {
      setRevealed(true);
      if (!completed.current) { completed.current = true; callbacks.current.onRevealComplete?.(); }
    }
  }, [fallback, failed, loaded, reduced, status]);

  const error = failed || status === 'error';
  const cancelled = status === 'cancelled';
  const settled = revealed || (fallback && loaded);
  const message = cancelled ? 'Création interrompue' : error ? errorMessage || 'Impossible d’afficher le visuel.' : settled ? 'Visuel disponible' : caption || 'Création de votre visuel';
  return <div
    ref={frameRef}
    data-slot="grid-reveal"
    data-state={cancelled ? 'cancelled' : error ? 'error' : settled ? 'ready' : 'pending'}
    className={cn('grid-reveal', className)}
    style={{ aspectRatio: ratio, ...style }}
    aria-busy={!settled && !error && !cancelled}
    {...props}
  >
    <canvas ref={canvasRef} className="grid-reveal-canvas" aria-hidden="true" />
    {src && !error && !cancelled && <Image unoptimized fill
      ref={imageRef}
      src={src}
      alt={alt}
      className="grid-reveal-image"
      decoding="async"
      draggable={false}
      onLoad={(event) => {
        if (!event.currentTarget.naturalWidth || !event.currentTarget.naturalHeight) { fail(); return; }
        setLoaded(true);
        if (fallback) complete();
      }}
      onError={fail}
    />}
    {(error || cancelled) && <div className="grid-reveal-notice">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg>
      <p>{message}</p>
      {(failed || onRetry) && <button type="button" className="grid-reveal-retry" onClick={retry}>Réessayer</button>}
    </div>}
    {!settled && !error && !cancelled && <span className="grid-reveal-caption" aria-hidden="true">{message}</span>}
    <span className="grid-reveal-sr" role="status" aria-live="polite" aria-atomic="true">{message}</span>
  </div>;
}

export default GridReveal;
