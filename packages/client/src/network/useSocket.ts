// packages/client/src/network/useSocket.ts
import { useEffect, useRef } from 'react';
import { useSocketContext } from './SocketContext';

export function useSocketEvent<T>(event: string, handler: (data: T) => void): void {
  const socket = useSocketContext();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    const fn = (data: T) => handlerRef.current(data);
    socket.on(event, fn);
    return () => { socket.off(event, fn); };
  }, [socket, event]);
}
