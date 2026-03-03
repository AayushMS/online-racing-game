// packages/client/src/network/useSocket.ts
import { useEffect } from 'react';
import { useSocketContext } from './SocketContext';

export function useSocketEvent<T>(event: string, handler: (data: T) => void): void {
  const socket = useSocketContext();
  useEffect(() => {
    socket.on(event, handler);
    return () => { socket.off(event, handler); };
  }, [socket, event, handler]);
}
