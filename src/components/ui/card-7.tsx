"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface InteractiveTiltSurfaceProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onMouseMove" | "onMouseLeave"> {
  maxTiltDeg?: number;
  perspectivePx?: number;
  hoverScale?: number;
}

export function InteractiveTiltSurface({
  className,
  children,
  maxTiltDeg = 8,
  perspectivePx = 1000,
  hoverScale = 1.05,
  style: styleProp,
  ...props
}: InteractiveTiltSurfaceProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const tiltRef = React.useRef<HTMLDivElement>(null);
  const rafRef = React.useRef<number | null>(null);
  const pointerRef = React.useRef<{ cx: number; cy: number } | null>(null);
  const reduceMotion = useReducedMotion();

  const clearRaf = React.useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const applyTiltFrame = React.useCallback(() => {
    rafRef.current = null;
    const root = rootRef.current;
    const tilt = tiltRef.current;
    const p = pointerRef.current;
    if (!root || !tilt || !p || reduceMotion) return;

    const rect = root.getBoundingClientRect();
    const x = p.cx - rect.left;
    const y = p.cy - rect.top;
    const h = rect.height;
    const w = rect.width;
    if (w < 1 || h < 1) return;

    const rotateX = ((y - h / 2) / (h / 2)) * -maxTiltDeg;
    const rotateY = ((x - w / 2) / (w / 2)) * maxTiltDeg;

    tilt.style.transition = "transform 75ms linear";
    tilt.style.transform = `perspective(${perspectivePx}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${hoverScale}, ${hoverScale}, ${hoverScale})`;
  }, [hoverScale, maxTiltDeg, perspectivePx, reduceMotion]);

  const scheduleTilt = React.useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(applyTiltFrame);
  }, [applyTiltFrame]);

  const handlePointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (reduceMotion) return;
      pointerRef.current = { cx: e.clientX, cy: e.clientY };
      scheduleTilt();
    },
    [reduceMotion, scheduleTilt]
  );

  const handlePointerLeave = React.useCallback(() => {
    pointerRef.current = null;
    clearRaf();
    const tilt = tiltRef.current;
    if (!tilt || reduceMotion) return;
    tilt.style.transition =
      "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)";
    tilt.style.transform = `perspective(${perspectivePx}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    tilt.style.willChange = "auto";
  }, [clearRaf, perspectivePx, reduceMotion]);

  const handlePointerEnter = React.useCallback(() => {
    const tilt = tiltRef.current;
    if (!tilt || reduceMotion) return;
    tilt.style.willChange = "transform";
  }, [reduceMotion]);

  React.useEffect(() => {
    return () => {
      clearRaf();
    };
  }, [clearRaf]);

  return (
    <div
      ref={rootRef}
      className={cn("h-full min-h-0", className)}
      style={styleProp}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      {...props}
    >
      <div
        ref={tiltRef}
        className="h-full min-h-0 [transform-style:preserve-3d] backface-hidden"
      >
        {children}
      </div>
    </div>
  );
}

interface InteractiveProductCardProps extends React.HTMLAttributes<HTMLDivElement> {
  imageUrl: string;
  logoUrl: string;
  title: string;
  description: string;
  price: string;
}

/** Optional shadcn-style product demo; uses remote `<img>` URLs (not next/image). */
export function InteractiveProductCard({
  className,
  imageUrl,
  logoUrl,
  title,
  description,
  price,
  ...props
}: InteractiveProductCardProps) {
  return (
    <InteractiveTiltSurface
      className={cn(
        "relative aspect-[9/12] w-full max-w-[340px] rounded-3xl bg-card shadow-lg",
        className
      )}
      {...props}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- remote Unsplash */}
      <img
        src={imageUrl}
        alt={title}
        className="absolute inset-0 h-full w-full rounded-3xl object-cover transition-transform duration-300 group-hover:scale-110"
        style={{ transform: "translateZ(-20px) scale(1.1)" }}
      />
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

      <div
        className="absolute inset-0 flex flex-col p-5"
        style={{ transform: "translateZ(40px)" }}
      >
        <div className="flex items-start justify-between rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <div className="flex flex-col">
            <h3 className="text-xl font-bold text-white">{title}</h3>
            <p className="text-xs text-white/70">{description}</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- remote logo */}
          <img src={logoUrl} alt="" className="h-4 w-auto" />
        </div>

        <div className="absolute top-[108px] left-5">
          <div className="rounded-full bg-black/40 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm">
            {price}
          </div>
        </div>

        <div className="mt-auto flex w-full justify-center gap-2 pb-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                index === 0 ? "bg-white" : "bg-white/30"
              )}
            />
          ))}
        </div>
      </div>
    </InteractiveTiltSurface>
  );
}
