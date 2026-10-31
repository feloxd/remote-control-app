import React from 'react';
import { useNavigate } from 'react-router-dom';
import useSessionStore from '../store/sessionStore';
import Icon from './Icon';

const NAV_ITEMS = [
  { id: 'sessions', label: 'Clientes', icon: 'users', path: '/sessions' },
  { id: 'control', label: 'Vista en vivo', icon: 'monitor', path: '/control' },
  { id: 'files', label: 'Archivos', icon: 'folder', path: '/files' },
  { id: 'settings', label: 'Ajustes', icon: 'settings', path: '/settings' },
];

export default function SectionLayout({ active, eyebrow, title, subtitle, children }) {
  const navigate = useNavigate();
  const token = useSessionStore((state) => state.token);
  const sessionCode = useSessionStore((state) => state.sessionCode);
  const sessionStatus = useSessionStore((state) => state.sessionStatus);
  const logout = useSessionStore((state) => state.logout);
  const isPreview = token === 'local-preview';

  const go = (path) => navigate(`${path}${isPreview ? '?preview=1' : ''}`);

  return (
    <div className="section-shell">
      <header className="command-header">
        <div className="command-brand">
          <span className="command-brand__mark"><Icon name="monitor" size={19} /></span>
          <strong>Remote Control</strong><span>Dashboard</span>
        </div>
        <div className="client-pill">
          <span className={`status-dot ${sessionStatus === 'active' ? 'is-online' : 'is-waiting'}`} />
          <span>Cliente: <strong>{sessionCode || 'SIN SESIÓN'}</strong></span>
        </div>
        <div className="header-actions">
          <button className="header-tool" onClick={() => { logout(); navigate('/'); }}><Icon name="logout" size={17} /><span>Cerrar sesión</span></button>
        </div>
      </header>

      <div className="section-shell__body">
        <aside className="section-nav">
          <p>Dashboard</p>
          {NAV_ITEMS.map((item) => (
            <button key={item.id} className={active === item.id ? 'is-active' : ''} onClick={() => go(item.path)}>
              <Icon name={item.icon} size={17} />{item.label}
            </button>
          ))}
        </aside>

        <main className="section-content">
          <div className="section-heading">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <span>{subtitle}</span>
          </div>
          {children}
        </main>
      </div>

      <footer className="status-bar">
        <span><i className={sessionStatus === 'active' ? 'is-online' : ''} /> {sessionStatus === 'active' ? 'Conectado' : 'En espera'}</span>
        <span>Sesión <strong>{sessionCode || '—'}</strong></span>
        <a href="/source" target="_blank" rel="noreferrer">Código fuente · AGPL-3.0</a>
      </footer>
    </div>
  );
}
