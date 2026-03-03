// packages/client/src/game/useGameCanvas.ts
import { useEffect, useRef } from 'react';
import { SceneManager } from './SceneManager';

export function useGameCanvas(onInit: (mgr: SceneManager) => () => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mgr = new SceneManager(canvas);
    const cleanup = onInit(mgr);
    return () => { cleanup(); mgr.dispose(); };
  }, []);

  return canvasRef;
}
