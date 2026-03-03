// packages/client/src/screens/GameScreen.tsx
import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useSocketContext } from '../network/SocketContext';
import { useSocketEvent } from '../network/useSocket';
import { SceneManager } from '../game/SceneManager';
import { KartPool } from '../game/KartPool';
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
    const inputHandler = new InputHandler();
    const particles = new ParticleSystem(scene.scene);
    const itemBoxes = createItemBoxes(scene.scene);
    createTrack(scene.scene);

    let seq = 0;

    // Send inputs to server at tick rate
    const inputInterval = setInterval(() => {
      const input = inputHandler.getInput();
      socket.emit(EV_PLAYER_INPUT, {
        seq: ++seq,
        steer: input.steer,
        throttle: input.throttle,
        brake: input.brake,
        timestamp: Date.now(),
      });
      if (input.useItem) socket.emit(EV_USE_ITEM);
    }, TICK_MS);

    let elapsed = 0;
    scene.startRenderLoop((dt) => {
      elapsed += dt;
      const state = stateRef.current;
      if (!state) return;

      // All karts (including own) rendered from authoritative server state
      kartPool.syncPlayers(state.players);

      // Camera follows own kart using server state
      const myState = state.players[socket.id ?? ''];
      if (myState) {
        const pos = new THREE.Vector3(myState.position.x, myState.position.y, myState.position.z);
        const quat = new THREE.Quaternion(myState.rotation.x, myState.rotation.y, myState.rotation.z, myState.rotation.w);
        scene.followTarget(pos, quat);
      }

      animateItemBoxes(itemBoxes, elapsed);
      if (state.itemBoxes.length > 0) syncItemBoxes(itemBoxes, state.itemBoxes);
      particles.tick(dt);
    });

    return () => {
      clearInterval(inputInterval);
      inputHandler.dispose();
      kartPool.dispose();
      scene.dispose();
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {gameState && <HUD state={gameState} myId={socket.id ?? ''} />}
    </div>
  );
}
