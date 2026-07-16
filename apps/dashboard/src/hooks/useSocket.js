import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import useSessionStore from '../store/sessionStore';

const ACK_TIMEOUT_MS = 8000;

export function useSocket() {
  const socketRef = useRef(null);
  const pendingAcks = useRef({});
  const token = useSessionStore((s) => s.token);
  const sessionCode = useSessionStore((s) => s.sessionCode);
  const setSessionStatus = useSessionStore((s) => s.setSessionStatus);
  const addLog = useSessionStore((s) => s.addLog);

  useEffect(() => {
    if (!token || !sessionCode) return;

    const socket = io('/dash', { auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_session', sessionCode);
    });

    socket.on('session_joined', ({ status }) => {
      setSessionStatus(status);
    });

    socket.on('session_active', () => {
      setSessionStatus('active');
      addLog({ action: 'system', payload: 'Client connected — session active', timestamp: new Date().toISOString() });
    });

    socket.on('client_disconnected', () => {
      setSessionStatus('pending');
      addLog({ action: 'system', payload: 'Client disconnected', timestamp: new Date().toISOString() });
    });

    socket.on('action_logged', ({ action, payload }) => {
      addLog({ action, payload, timestamp: new Date().toISOString() });
    });

    socket.on('action_ack', ({ action, success, error }) => {
      const resolve = pendingAcks.current[action];
      if (resolve) {
        delete pendingAcks.current[action];
        resolve({ success, error });
      }
    });

    socket.on('error', ({ message }) => {
      addLog({ action: 'error', payload: message, timestamp: new Date().toISOString() });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, sessionCode]);

  const dispatch = (action, payload = {}) => {
    if (!socketRef.current?.connected) {
      return Promise.resolve({ success: false, error: 'Not connected' });
    }
    return new Promise((resolve) => {
      pendingAcks.current[action] = resolve;
      socketRef.current.emit('dispatch_action', { action, payload });
      setTimeout(() => {
        if (pendingAcks.current[action]) {
          delete pendingAcks.current[action];
          resolve({ success: false, error: 'timeout' });
        }
      }, ACK_TIMEOUT_MS);
    });
  };

  return { dispatch };
}
