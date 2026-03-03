// packages/client/src/screens/GameScreen.tsx
import React, { useRef, useEffect, useState } from 'react';
import { useSocketContext } from '../network/SocketContext';
import { useSocketEvent } from '../network/useSocket';
import { SceneManager } from '../game/SceneManager';
import { KartPool } from '../game/KartPool';
import { ClientPhysics } from '../game/ClientPhysics';
import { InputHandler } from '../game/InputHandler';
import { createTrack } from '../game/Track';
import { createItemBoxes, syncItemBoxes, animateItemBoxes } from '../game/ItemBoxes';
import { ParticleSystem } from '../game/ParticleSystem';
import { HUD } from '../components/HUD';
import {
  EV_GAME_STATE, EV_PLAYER_INPUT, EV_USE_ITEM, EV_RACE_FINISHED,
  GameState, TICK_MS,
} from '@racing/shared';
import { AppState, Screen } from '../App';

interface Props {
  appState: AppState;
  navigate: (screen: Screen, patch?: Partial<AppState>) => void;
}

export function GameScreen({ appState, navigate }: Props) {
  const socket = useSocketContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const stateRef = useRef<GameState | null>(null);

  useSocketEvent<GameState>(EV_GAME_STATE, (state) => {
    setGameState(state);
    stateRef.current = state;
  });

  useSocketEvent<unknown>(EV_RACE_FINISHED, () => {
    navigate('podium', { ...appState });
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new SceneManager(canvas);
    const kartPool = new KartPool(scene.scene);
    const clientPhysics = new ClientPhysics();
    const inputHandler = new InputHandler();
    const particles = new ParticleSystem(scene.scene);
    const itemBoxes = createItemBoxes(scene.scene);
    createTrack(scene.scene);

    let seq = 0;

    const inputInterval = setInterval(() => {
      const input = inputHandler.getInput();
      const frame = {
        seq: ++seq,
        steer: input.steer,
        throttle: input.throttle,
        brake: input.brake,
        timestamp: Date.now(),
      };
      socket.emit(EV_PLAYER_INPUT, frame);
      if (input.useItem) socket.emit(EV_USE_ITEM);
      clientPhysics.tick(frame, TICK_MS / 1000);
    }, TICK_MS);

    let elapsed = 0;
    scene.startRenderLoop((dt) => {
      elapsed += dt;
      const state = stateRef.current;
      if (!state) return;

      kartPool.syncPlayers(state.players);

      const myKart = kartPool.getKart(socket.id ?? '');
      if (myKart) {
        const pos = clientPhysics.getPosition();
        const quat = clientPhysics.getQuaternion();
        myKart.position.copy(pos);
        myKart.quaternion.copy(quat);
        scene.followTarget(pos, quat);
      }

      animateItemBoxes(itemBoxes, elapsed);
      if (state.itemBoxes.length > 0) syncItemBoxes(itemBoxes, state.itemBoxes);
      particles.tick(dt);
    });

    return () => {
      clearInterval(inputInterval);
      scene.stopRenderLoop();
      kartPool.dispose();
      inputHandler.dispose();
      scene.renderer.dispose();
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {gameState && <HUD state={gameState} myId={socket.id ?? ''} />}
    </div>
  );
}
