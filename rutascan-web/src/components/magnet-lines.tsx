"use client";

import { useEffect, useRef } from "react";

type MagnetLinesProps = {
  className?: string;
  style?: React.CSSProperties;
  lineColor?: string;
  spacing?: number;
  lineWidth?: number;
  lineHeight?: number;
  radius?: number;
  fade?: number;
  stretch?: number;
  bounce?: number;
  ripple?: number;
};

export default function MagnetLines({
  className,
  style,
  lineColor = "#dc1928",
  spacing = 56,
  lineWidth = 2,
  lineHeight = 18,
  radius = 200,
  fade = 0.65,
  stretch = 0.4,
  bounce = 0.3,
  ripple = 0.3,
}: MagnetLinesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = container.clientWidth;
    let height = container.clientHeight;

    // Cached layout rect: reading it every frame forces layout work.
    let rect = canvas.getBoundingClientRect();

    canvas.width = width;
    canvas.height = height;

    const resize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = width;
      canvas.height = height;
      rect = canvas.getBoundingClientRect();
      schedule();
    };

    const ro = new ResizeObserver(resize);

    const cols = Math.ceil(width / spacing) + 2;
    const rows = Math.ceil(height / spacing) + 2;

    const lines: Array<{
      x: number;
      y: number;
      angle: number;
      targetAngle: number;
      speed: number;
    }> = [];

    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        lines.push({
          x: col * spacing + spacing / 2,
          y: row * spacing + spacing / 2,
          angle: 0,
          targetAngle: Math.random() * Math.PI * 2,
          speed: 0.04 + Math.random() * 0.08,
        });
      }
    }

    let mouseX = -10000;
    let mouseY = -10000;
    let lastTouch = 0;

    ro.observe(container);

    const updatePointer = (clientX: number, clientY: number) => {
      mouseX = clientX;
      mouseY = clientY;
      schedule();
    };

    const clearPointer = () => {
      mouseX = -10000;
      mouseY = -10000;
      schedule();
    };

    const onMouseMove = (e: MouseEvent) => {
      // Touch screens emit synthetic mouse events after a tap; ignore them so
      // the lines do not stay stuck around the last tap position.
      if (Date.now() - lastTouch < 1200) return;
      updatePointer(e.clientX, e.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      lastTouch = Date.now();
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        updatePointer(touch.clientX, touch.clientY);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      lastTouch = Date.now();
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        updatePointer(touch.clientX, touch.clientY);
      }
    };

    const onTouchEnd = () => {
      lastTouch = Date.now();
      clearPointer();
    };

    const onMouseLeave = () => {
      clearPointer();
    };

    const onScroll = () => {
      const next = canvas.getBoundingClientRect();
      if (next.left !== rect.left || next.top !== rect.top) {
        rect = next;
        schedule();
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    window.addEventListener("scroll", onScroll, { passive: true });

    let raf = 0;

    function schedule() {
      if (!raf) raf = requestAnimationFrame(draw);
    }

    const colorRGB = hexToRgb(lineColor);
    const strokeStyle = `rgb(${colorRGB.r}, ${colorRGB.g}, ${colorRGB.b})`;

    const draw = () => {
      raf = 0;

      const relX = mouseX - rect.left;
      const relY = mouseY - rect.top;

      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = strokeStyle;

      let maxDelta = 0;

      for (const line of lines) {
        const dx = relX - line.x;
        const dy = relY - line.y;
        const dist = Math.hypot(dx, dy);
        const influence = dist < radius ? 1 - dist / radius : 0;

        const targetAngle = influence > 0 ? Math.atan2(dy, dx) : line.targetAngle;
        const delta = targetAngle - line.angle;
        line.angle += delta * (0.04 + bounce * 0.06);
        const absDelta = Math.abs(delta);
        if (absDelta > maxDelta) maxDelta = absDelta;

        const emphasis = Math.exp(-(dist * dist) / (radius * radius));
        const len = lineHeight * (1 + stretch * emphasis);
        const w = lineWidth * (1 + emphasis);
        const alphaVal = (fade > 0 ? (0.2 + emphasis * (1 - fade)) : 0.2 + emphasis);

        ctx.beginPath();
        ctx.moveTo(
          line.x - Math.cos(line.angle) * len / 2,
          line.y - Math.sin(line.angle) * len / 2
        );
        ctx.lineTo(
          line.x + Math.cos(line.angle) * len / 2,
          line.y + Math.sin(line.angle) * len / 2
        );
        ctx.lineWidth = w;
        ctx.globalAlpha = alphaVal;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      // Stop the loop once everything has settled: an idle page should not keep
      // repainting (battery / scroll smoothness on phones). Any pointer, touch,
      // resize or scroll movement schedules the next frame.
      if (maxDelta > 0.0015) schedule();
    };

    schedule();

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else {
        schedule();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("scroll", onScroll);
    };
  }, [spacing, radius, lineColor, lineWidth, lineHeight, fade, stretch, bounce]);

  return (
    <div
      ref={containerRef}
      className={`magnet-lines ${className || ""}`}
      style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", ...style }}
    >
      <canvas ref={canvasRef} className="magnet-lines__canvas" aria-hidden="true" />
    </div>
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }
  return { r: 220, g: 25, b: 40 };
}
