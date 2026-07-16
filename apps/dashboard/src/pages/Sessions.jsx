import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import useSessionStore from '../store/sessionStore';
import Icon from '../components/Icon';

export default function Sessions() {
  const [inputCode, setInputCode] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdCode, setCreatedCode] = useState(null);
  const [createError, setCreateError] = useState('');
  const socketRef = useRef(null);

  const token = useSessionStore((state) => state.token);
  const sessionCode = useSessionStore((state) => state.sessionCode);
  const setSession = useSessionStore((state) => state.setSession);
  const logout = useSessionStore((state) => state.logout);
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionCode) setInputCode(sessionCode);
    return () => socketRef.current?.disconnect();
  }, [sessionCode]);

  const handleCodeInput = (event) => {
    setInputCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
    setError('');
  };

  const handleCreateSession = async () => {
    setCreating(true);
    setCreateError('');
    setCreatedCode(null);
    try {
      const { data } = await axios.post('/sessions/create', {}, { headers: { Authorization: `Bearer ${token}` } });
      setCreatedCode(data.code);
    } catch (requestError) {
      setCreateError(requestError.response?.data?.error || 'No se pudo crear la sesión');
    } finally {
      setCreating(false);
    }
  };

  const handleConnect = (codeOverride) => {
    const code = (codeOverride || inputCode).trim();
    if (code.length !== 6) {
      setError('Ingresa el código completo de 6 caracteres.');
      return;
    }

    setConnecting(true);
    setError('');
    const socket = io('/dash', { auth: { token }, timeout: 8000 });
    socketRef.current = socket;

    const failTimer = setTimeout(() => {
      socket.disconnect();
      socketRef.current = null;
      setConnecting(false);
      setError('La conexión tardó demasiado. Comprueba el servidor.');
    }, 8000);

    const done = (message) => {
      clearTimeout(failTimer);
      socket.disconnect();
      socketRef.current = null;
      setConnecting(false);
      if (message) setError(message);
    };

    socket.on('connect', () => socket.emit('join_session', code));
    socket.on('session_joined', ({ code: joined, status }) => { setSession(joined, status); done(null); });
    socket.on('error', ({ message }) => done(message));
    socket.on('connect_error', () => done('No se pudo contactar al servidor.'));
  };

  const handleDisconnect = () => {
    setSession(null, null);
    setInputCode('');
    setCreatedCode(null);
    setError('');
  };

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="sessions-page">
      <header className="sessions-header">
        <div className="command-brand">
          <span className="command-brand__mark"><Icon name="monitor" size={19} /></span>
          <strong>Remote Control</strong><span>Dashboard</span>
        </div>
        <button onClick={handleLogout}><Icon name="logout" size={16} /> Cerrar sesión</button>
      </header>

      <main className="sessions-content">
        <div className="sessions-title">
          <div><p className="eyebrow">Centro de conexiones</p><h1>Selecciona un cliente</h1><span>Crea una sesión nueva o conecta con un código existente.</span></div>
          <div className="system-health"><i /> Servidor disponible</div>
        </div>

        {sessionCode ? (
          <section className="active-session-card">
            <span className="active-session-card__icon"><Icon name="monitor" size={25} /></span>
            <div><p>Sesión preparada</p><strong>{sessionCode}</strong><span>El panel conservará este código mientras trabajas.</span></div>
            <div className="active-session-card__actions">
              <button onClick={() => navigate('/control')}>Abrir panel de control <Icon name="chevronLeft" className="rotate-180" /></button>
              <button onClick={handleDisconnect}>Cambiar sesión</button>
            </div>
          </section>
        ) : (
          <div className="session-grid">
            <section className="session-card session-card--primary">
              <span className="session-card__icon"><Icon name="users" /></span>
              <p className="eyebrow">Nueva conexión</p>
              <h2>Crear una sesión</h2>
              <p>Genera un código temporal y compártelo con el equipo cliente.</p>
              <button onClick={handleCreateSession} disabled={creating}>{creating ? 'Creando…' : 'Generar código de sesión'}</button>
              {createError && <div className="form-error">{createError}</div>}
              {createdCode && (
                <div className="generated-code">
                  <span>Código listo</span><strong>{createdCode}</strong>
                  <button onClick={() => handleConnect(createdCode)} disabled={connecting}>{connecting ? 'Conectando…' : 'Abrir esta sesión'}</button>
                </div>
              )}
            </section>

            <section className="session-card">
              <span className="session-card__icon"><Icon name="link" /></span>
              <p className="eyebrow">Código existente</p>
              <h2>Conectar con un cliente</h2>
              <p>Introduce los seis caracteres que aparecen en el cliente de Windows.</p>
              <input value={inputCode} onChange={handleCodeInput} onKeyDown={(event) => event.key === 'Enter' && handleConnect()} maxLength={6} placeholder="XXXXXX" autoFocus />
              {error && <div className="form-error">{error}</div>}
              <button onClick={() => handleConnect()} disabled={connecting || inputCode.length !== 6}>{connecting ? 'Conectando…' : 'Conectar al cliente'}</button>
            </section>
          </div>
        )}
      </main>

      <footer className="sessions-footer"><span>Remote Control App · v1.1</span><a href="/source" target="_blank" rel="noreferrer">Código fuente · AGPL-3.0</a></footer>
    </div>
  );
}
