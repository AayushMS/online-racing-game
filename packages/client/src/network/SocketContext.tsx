// packages/client/src/network/SocketContext.tsx
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);

  if (!socketRef.current) {
    socketRef.current = io(SERVER_URL, { autoConnect: true, transports: ['websocket'] });
  }

  useEffect(() => {
    return () => { socketRef.current?.disconnect(); };
  }, []);

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext(): Socket {
  const socket = useContext(SocketContext);
  if (!socket) throw new Error('useSocketContext must be used inside SocketProvider');
  return socket;
}
