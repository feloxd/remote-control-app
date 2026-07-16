import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import useSessionStore from '../store/sessionStore';
import Icon from '../components/Icon';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setToken = useSessionStore((state) => state.setToken);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await axios.post('/auth/login', { username, password });
      setToken(data.token);
      navigate('/sessions');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-ambient auth-ambient--one" />
      <div className="auth-ambient auth-ambient--two" />

      <section className="auth-intro">
        <span className="command-brand__mark"><Icon name="monitor" size={21} /></span>
        <p className="eyebrow">Control privado · Windows</p>
        <h1>Administra tus equipos<br />desde un solo lugar.</h1>
        <p>Acciones remotas, protección de pantalla y censura inteligente con procesamiento local.</p>
        <div className="auth-features">
          <span><Icon name="shield" /> Comunicación protegida</span>
          <span><Icon name="cpu" /> Censor IA local</span>
          <span><Icon name="activity" /> Estado en tiempo real</span>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-card__heading">
          <span className="auth-card__icon"><Icon name="lock" /></span>
          <div><h2>Acceso del operador</h2><p>Ingresa tus credenciales para continuar</p></div>
        </div>

        <form onSubmit={handleSubmit}>
          <label>
            Usuario
            <input type="text" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Tu usuario" required autoFocus />
          </label>
          <label>
            Contraseña
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••••••" required />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" disabled={loading}>{loading ? 'Verificando…' : 'Entrar al dashboard'}</button>
        </form>

        <a href="/source" target="_blank" rel="noreferrer">Código fuente y licencias · AGPL-3.0</a>
      </section>
    </main>
  );
}
