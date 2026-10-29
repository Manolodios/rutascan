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

    const resize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = width;
      canvas.height = height;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

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

    const onMouseMove = (e: MouseEvent) => {
      // Global mouse tracking — relative conversion done in draw loop using canvas rect
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const onMouseLeave = () => {
      mouseX = -10000;
      mouseY = -10000;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);

    let raf = 0;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const relX = mouseX - rect.left;
      const relY = mouseY - rect.top;

      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const colorRGB = hexToRgb(lineColor);

      for (const line of lines) {
        const dx = relX - line.x;
        const dy = relY - line.y;
        const dist = Math.hypot(dx, dy);
        const influence = dist < radius ? 1 - dist / radius : 0;

        const targetAngle = influence > 0 ? Math.atan2(dy, dx) : line.targetAngle;
        line.angle += (targetAngle - line.angle) * (0.04 + bounce * 0.06);

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
        ctx.strokeStyle = `rgba(${colorRGB.r}, ${colorRGB.g}, ${colorRGB.b}, ${alphaVal})`;
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
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
