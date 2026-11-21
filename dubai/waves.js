// The background: slow voice-like waves in the four speaker colours.
{
const cv = document.getElementById('waves'), cx = cv.getContext('2d');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
// each wave: colour, wavelength (px), amplitude (px), baseline (share of height), speed (px/s), line width, voice-like swell
const W8 = [
  ['#f2a93b', 520, 34, .22, 38, 2.2, 3.1],
  ['#8db8f2', 260, 18, .38, -26, 1.6, 2.2],
  ['#c9a0f2', 880, 58, .55, 18, 2.4, 4.3],
  ['#4cc38a', 170, 11, .70, 44, 1.4, 1.7],
  ['#f2a93b', 360, 24, .84, -32, 1.6, 2.7],
  ['#8db8f2', 1200, 70, .48, 12, 1.2, 5.6]
];
let w = 0, h = 0, dpr = 1, t0 = performance.now(), raf = 0;
function size() { dpr = Math.min(devicePixelRatio || 1, 2); w = innerWidth; h = innerHeight; cv.width = w * dpr; cv.height = h * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); }
function frame(now) {
  const t = (now - t0) / 1000, sy = scrollY * .15;
  cx.clearRect(0, 0, w, h);
  for (const [col, len, amp, base, speed, lw, swell] of W8) {
    const k = 2 * Math.PI / len, y0 = base * h, ph = t * speed * k + sy * k;
    cx.beginPath();
    for (let x = -8; x <= w + 8; x += 6) {
      const env = .55 + .45 * Math.sin(x / (len * swell) * 2 * Math.PI + t * .35);
      const y = y0 + Math.sin(x * k + ph) * amp * env + Math.sin(x * k * 2.3 - ph * .7) * amp * .18;
      x < 0 ? cx.moveTo(x, y) : cx.lineTo(x, y);
    }
    cx.strokeStyle = col; cx.globalAlpha = .28; cx.lineWidth = lw; cx.stroke();
  }
  if (!still) raf = requestAnimationFrame(frame);
}
size(); addEventListener('resize', () => { size(); if (still) frame(t0); });
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else if (!still) raf = requestAnimationFrame(frame); });
if (still) addEventListener('scroll', () => frame(t0), { passive: true });
frame(t0);
}
