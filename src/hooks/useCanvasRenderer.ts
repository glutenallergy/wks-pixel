import { useEffect, useRef, useCallback } from 'react';
import type { AppState } from '../state';
import { computeCompositingLayout, computeLayerLayout, render, type CompositingInfo } from '../renderer';

export function useCanvasRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  wrapperRef: React.RefObject<HTMLDivElement | null>,
  stateRef: React.MutableRefObject<AppState>,
  needsResize: React.MutableRefObject<boolean>,
  badgeRef: React.RefObject<HTMLDivElement | null>,
) {
  const compRef = useRef<CompositingInfo | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    function resize() {
      const rect = wrapper!.getBoundingClientRect();
      const state = stateRef.current;
      const comp = computeCompositingLayout(state, rect.width - 24, rect.height - 24);
      compRef.current = comp;

      canvas!.style.width = `${comp.compositingW}px`;
      canvas!.style.height = `${comp.compositingH}px`;
      canvas!.width = comp.compositingW * comp.dpr;
      canvas!.height = comp.compositingH * comp.dpr;

      if (badgeRef.current) {
        badgeRef.current.textContent = `${comp.baseCols * comp.maxRes} × ${comp.baseRows * comp.maxRes} @ ${comp.maxRes}x`;
      }
      needsResize.current = false;
    }

    function animate() {
      if (needsResize.current) resize();

      const state = stateRef.current;
      const comp = compRef.current;
      if (!comp) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      // Advance time per-layer (mutate ref directly — not React state)
      if (state.animating) {
        if (state.loopEnabled) {
          // In loop mode, layer.time is a phase 0→1 that wraps around
          // Phase increment per frame: 1 / (duration_seconds * ~60fps)
          const dt = 1 / (state.loopDuration * 60);
          for (const layer of state.layers) {
            // Speed still affects rate — normalized around 50 as "1x"
            layer.time += dt * (layer.noiseSpeed / 50);
            if (layer.time >= 1) layer.time -= Math.floor(layer.time);
          }
        } else {
          for (const layer of state.layers) {
            layer.time += 0.00002 * layer.noiseSpeed;
          }
        }
      }

      render(canvas!, state, comp);
      rafRef.current = requestAnimationFrame(animate);
    }

    const onResize = () => { needsResize.current = true; };
    window.addEventListener('resize', onResize);

    resize();
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [canvasRef, wrapperRef, stateRef, needsResize, badgeRef]);

  return compRef;
}
