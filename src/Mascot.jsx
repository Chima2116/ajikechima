import { useEffect, useRef } from "react";

// A small blob with eyes that follow the pointer, blink on their own and change with state.
// state: "idle" | "thinking" | "talking" | "happy"
export default function Mascot({ size = 40, state = "idle", dark = true, wake = 0 }) {
  const eyes = useRef(null);
  const body = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const wakeRef = useRef(0);
  const root = useRef(null);

  useEffect(() => { wakeRef.current = performance.now(); }, [wake]);

  useEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0, blinkAt = performance.now() + 2500, blinkT = -1;
    const aim = (cx, cy) => {
      const r = root.current.getBoundingClientRect();
      const dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 160);
      tx = (dx / d) * k; ty = (dy / d) * k;
    };
    const onMove = (e) => aim(e.clientX, e.clientY);
    const onMsg = (e) => { const m = e.data; if (m && m.t === "ptr" && root.current) aim(m.x, m.y); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("message", onMsg);
    const tick = (now) => {
      const st = stateRef.current;
      let gx = tx, gy = ty;
      if (st === "thinking") { gx = 0.55; gy = -0.7; }
      x += (gx - x) * 0.14; y += (gy - y) * 0.14;
      if (now > blinkAt) { blinkT = now; blinkAt = now + 2600 + Math.random() * 3400; }
      let sy = 1;
      if (blinkT > 0) { const t = (now - blinkT) / 140; if (t >= 1) blinkT = -1; else sy = 1 - 0.92 * Math.sin(t * Math.PI); }
      if (st === "happy") sy = Math.min(sy, 0.35);
      const w = now - wakeRef.current; if (w < 520) sy = Math.min(sy, 1 - 0.9 * Math.sin((w / 520) * Math.PI));
      const t = now / 1000;
      const bob = calm ? 0 : st === "talking" ? Math.sin(t * 9) * 1.1 : Math.sin(t * 1.6) * 0.9;
      const squish = st === "thinking" ? 0.97 : 1;
      if (eyes.current) eyes.current.setAttribute("transform", `translate(${(x * 3.2).toFixed(2)} ${(y * 2.6).toFixed(2)})`);
      if (eyes.current) for (const e of eyes.current.children) e.setAttribute("transform", `translate(${e.dataset.cx} 22) scale(1 ${sy.toFixed(3)}) translate(${-e.dataset.cx} -22)`);
      if (body.current) body.current.setAttribute("transform", `translate(0 ${bob.toFixed(2)}) scale(${squish})`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("pointermove", onMove); window.removeEventListener("message", onMsg); };
  }, []);

  const fill = dark ? "#86CFAE" : "#0F6B4F";
  const ink = dark ? "#0B1A14" : "#FFFFFF";
  return (
    <svg ref={root} width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Portfolio assistant" style={{ display: "block", flex: "none", overflow: "visible" }}>
      <g ref={body} style={{ transformOrigin: "24px 40px" }}>
        <path d="M24 4c11.6 0 19 7.2 19 18.4C43 35 36 43 24 43S5 35 5 22.4C5 11.2 12.4 4 24 4z" fill={fill} />
        <path d="M13 12c3-3.2 7-4.5 11-4.5" stroke="#fff" strokeOpacity=".35" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <g ref={eyes}>
          <ellipse data-cx="17" cx="17" cy="22" rx="3.1" ry="4.6" fill={ink} />
          <ellipse data-cx="31" cx="31" cy="22" rx="3.1" ry="4.6" fill={ink} />
        </g>
      </g>
    </svg>
  );
}
