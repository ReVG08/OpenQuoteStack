"use client";
import { useEffect } from "react";
export function EmbedResize({
  origin,
  channel,
}: {
  origin: string;
  channel: string;
}) {
  useEffect(() => {
    let scheduled = 0,
      last = 0;
    const resize = () => {
      cancelAnimationFrame(scheduled);
      scheduled = requestAnimationFrame(() => {
        const root = document.querySelector(".public-page");
        if (!root) return;
        const height = Math.ceil(root.scrollHeight);
        if (height !== last && height >= 80 && height <= 10000) {
          last = height;
          window.parent.postMessage(
            { type: "oqs:resize/v1", channel, height },
            origin,
          );
        }
      });
    };
    const observer = new ResizeObserver(resize);
    const root = document.querySelector(".public-page");
    if (root) observer.observe(root);
    window.addEventListener("resize", resize);
    resize();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(scheduled);
      window.removeEventListener("resize", resize);
    };
  }, [origin, channel]);
  return null;
}
