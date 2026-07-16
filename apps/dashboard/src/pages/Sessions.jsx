import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import useSessionStore from '../store/sessionStore';

export default function Sessions() {
  const [inputCode, setInputCode]     = useState('');
  const [connecting, setConnecting]   = useState(false);
  const [error, setError]             = useState('');
  const [creating, setCreating]       = useState(false);
  const [createdCode, setCreatedCode] = useState(null);
  const [createError, setCreateError] = useState('');
  const socketRef = useRef(null);

  const token       = useSessionStore((s) => s.token);
  const sessionCode = useSessionStore((s) => s.sessionCode);
  const setSession  = useSessionStore((s) => s.setSession);
  const logout      = useSessionStore((s) => s.logout);
  const navigate    = useNavigate();

  useEffect(() => {
    if (sessionCode) setInputCode(sessionCode);
    return () => socketRef.current?.disconnect();
  }, []);

  const handleCodeInput = (e) => {
    setInputCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
    setError('');
  };

  const handleCreateSession = async () => {
    setCreating(true);
    setCreateError('');
    setCreatedCode(null);
    try {
      const { data } = await axios.post('/sessions/create', {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCreatedCode(data.code);
    } catch (err) {
      setCreateError(err.response?.data?.error || 'No se pudo crear la sesión');
    } finally {
      setCreating(false);
    }
  };

  // codeOverride permite conectar directamente con un código conocido
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
      setError('Connection timed out. Make sure the server is running.');
    }, 8000);

    const done = (errMsg) => {
      clearTimeout(failTimer);
      socket.disconnect();
      socketRef.current = null;
      setConnecting(false);
      if (errMsg) setError(errMsg);
    };

    socket.on('connect',       ()                       => { socket.emit('join_session', code); });
    socket.on('session_joined', ({ code: joined, status }) => { setSession(joined, status); done(null); });
    socket.on('error',          ({ message })            => { done(message); });
    socket.on('connect_error',  ()                       => { done('Cannot reach server. Is it running?'); });
  };

  const handleDisconnect = () => {
    setSession(null, null);
    setInputCode('');
    setCreatedCode(null);
    setError('');
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const isConnected = !!sessionCode;

  return (
    <div className="min-h-screen bg-surface p-8">
      <div className="max-w-md mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="w-8 h-0.5 bg-accent rounded mb-3" />
            <h1 className="text-xl font-bold text-white">Connect to Client</h1>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Logout
          </button>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-card p-6">

          {!isConnected ? (
            <div className="space-y-6">

              {/* ── Crear sesión desde el dashboard ── */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Crear sesión
                </p>

                <button
                  onClick={handleCreateSession}
                  disabled={creating}
                  className="w-full py-2.5 rounded-lg font-semibold text-white bg-accent
                             hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed
                             transition-all"
                >
                  {creating ? 'Creando...' : 'Crear Nueva Sesión'}
                </button>

                {createError && (
                  <div className="mt-3 px-4 py-2.5 rounded-lg bg-red-900/20 border border-red-800/50">
                    <p className="text-sm text-red-400">{createError}</p>
                  </div>
                )}

                {createdCode && (
                  <div className="mt-4 p-5 rounded-xl bg-surface border border-gray-800 text-center">
                    <p className="text-4xl font-mono font-bold tracking-[0.3em] text-accent mb-2">
                      {createdCode}
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      Comparte este código con tu cliente
                    </p>
                    <button
                      onClick={() => handleConnect(createdCode)}
                      disabled={connecting}
                      className="w-full py-2.5 rounded-lg font-semibold text-white bg-accent
                                 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed
                                 transition-all"
                    >
                      {connecting ? 'Conectando...' : 'Conectar'}
                    </button>
                  </div>
                )}
              </div>

              {/* ── Divider ── */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-xs text-gray-700 uppercase tracking-wider">o</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>

              {/* ── Ingresar código del cliente ── */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Session Code
                </p>
                <p className="text-gray-600 text-sm mb-5">
                  Ask the client for the code displayed on their screen and enter it below.
                </p>

                <input
                  type="text"
                  value={inputCode}
                  onChange={handleCodeInput}
                  onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                  maxLength={6}
                  disabled={connecting}
                  placeholder="XXXXXX"
                  autoFocus
                  className="w-full px-4 py-3 mb-4 rounded-lg bg-surface border border-gray-700
                             font-mono text-2xl font-bold text-center tracking-[0.4em] uppercase
                             text-accent placeholder-gray-700
                             focus:outline-none focus:border-accent transition-colors
                             disabled:opacity-50"
                />

                {error && (
                  <div className="px-4 py-2.5 rounded-lg bg-red-900/20 border border-red-800/50 mb-4">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <button
                  onClick={() => handleConnect()}
                  disabled={connecting || inputCode.length !== 6}
                  className="w-full py-2.5 rounded-lg font-semibold text-white bg-accent
                             hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed
                             transition-all"
                >
                  {connecting ? 'Connecting...' : 'Connect'}
                </button>
              </div>

            </div>

          ) : (

            /* ── Sesión activa ── */
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-surface border border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-600 uppercase tracking-widest">Client Session</p>
                  <span className="flex items-center gap-1.5 text-xs text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Connected
                  </span>
                </div>
                <p className="text-4xl font-mono font-bold tracking-[0.3em] text-accent">
                  {sessionCode}
                </p>
              </div>

              <button
                onClick={() => navigate('/control')}
                className="w-full py-2.5 rounded-lg font-semibold text-white bg-accent
                           hover:brightness-110 transition-all"
              >
                Open Control Panel
              </button>

              <button
                onClick={handleDisconnect}
                className="w-full py-2.5 rounded-lg font-medium text-gray-500 border border-gray-800
                           hover:border-gray-600 hover:text-gray-300 transition-all"
              >
                Connect to different session
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
