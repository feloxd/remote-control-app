import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ACTIONS } from '@remote-control/shared/actions';
import { useSocket } from '../hooks/useSocket';
import useSessionStore from '../store/sessionStore';
import useSettingsStore from '../store/settingsStore';
import ActionButton from '../components/ActionButton';
import ToggleAction from '../components/ToggleAction';
import ActivityLog from '../components/ActivityLog';
import Icon from '../components/Icon';

const TOGGLE_GROUPS = [
  {
    label: 'Controles',
    controls: [
      { label: 'Bloquear teclado', icon: 'lock', enableAction: ACTIONS.lock_keyboard, disableAction: ACTIONS.unlock_keyboard },
      { label: 'Bloquear pantalla', icon: 'monitor', enableAction: ACTIONS.lock_screen, disableAction: ACTIONS.unlock_screen },
    ],
  },
  {
    label: 'Contenido remoto',
    controls: [
      { label: 'Imagen en pantalla', icon: 'image', enableAction: ACTIONS.show_image, disableAction: ACTIONS.close_image, configureOnEnable: true },
      { label: 'Reproducir video', icon: 'play', enableAction: ACTIONS.play_video, disableAction: ACTIONS.close_video, configureOnEnable: true },
      { label: 'Reproducir audio', icon: 'play', enableAction: ACTIONS.play_audio, disableAction: ACTIONS.stop_audio, configureOnEnable: true },
    ],
  },
  {
    label: 'Protección visual',
    controls: [
      { label: 'Mostrar overlay', icon: 'grid', enableAction: ACTIONS.show_overlay, disableAction: ACTIONS.hide_overlay, configureOnEnable: true },
      { label: 'Pixelar pantalla', icon: 'pixels', enableAction: ACTIONS.pixelate_screen, disableAction: ACTIONS.pixelate_screen, enablePayload: { enabled: 'true' }, disablePayload: { enabled: 'false' } },
      { label: 'Filtrar sitios', icon: 'globe', enableAction: ACTIONS.filter_sites, disableAction: ACTIONS.clear_filters, configureOnEnable: true },
    ],
  },
];

const SINGLE_ACTION_GROUPS = [
  { label: 'Acciones puntuales', actions: [ACTIONS.open_url, ACTIONS.hide_cursor, ACTIONS.blackout_screen, ACTIONS.show_text] },
];

function Header({ sessionCode, isActive, dispatch, onBack }) {
  return (
    <header className="command-header">
      <div className="command-brand">
        <span className="command-brand__mark"><Icon name="monitor" size={19} /></span>
        <strong>Remote Control</strong>
        <span>Dashboard</span>
      </div>

      <div className="client-pill">
        <span className={`status-dot ${isActive ? 'is-online' : 'is-waiting'}`} />
        <span>Cliente: <strong>{sessionCode || 'SIN SESIÓN'}</strong></span>
        <b>{isActive ? 'En línea' : 'Esperando'}</b>
      </div>

      <div className="header-actions">
        <ActionButton action={ACTIONS.take_screenshot} disabled={!isActive} onDispatch={dispatch} variant="header" />
        <button type="button" className="header-tool" title="Pantalla completa">
          <Icon name="expand" size={17} /><span>Pantalla completa</span>
        </button>
        <button type="button" className="header-tool" onClick={onBack}>
          <Icon name="logout" size={17} /><span>Desconectar</span>
        </button>
      </div>
    </header>
  );
}

function Sidebar({ isActive, dispatch, navigate }) {
  return (
    <aside className="command-sidebar">
      <nav className="primary-nav" aria-label="Navegación principal">
        <p>Dashboard</p>
        <button onClick={() => navigate('/sessions')}><Icon name="grid" /> Resumen</button>
        <button onClick={() => navigate('/sessions')}><Icon name="users" /> Clientes</button>
        <button className="is-active"><Icon name="monitor" /> Vista en vivo</button>
        <button onClick={() => navigate('/files')}><Icon name="folder" /> Archivos</button>
        <button onClick={() => navigate('/settings')}><Icon name="settings" /> Ajustes</button>
      </nav>

      <div className="action-list">
        {TOGGLE_GROUPS.map((group) => (
          <section key={group.label}>
            <p>{group.label}</p>
            {group.controls.map((control) => (
              <ToggleAction
                key={control.label}
                {...control}
                disabled={!isActive}
                onDispatch={dispatch}
              />
            ))}
          </section>
        ))}
        {SINGLE_ACTION_GROUPS.map((group) => (
          <section key={group.label}>
            <p>{group.label}</p>
            {group.actions.map((action) => (
              <ActionButton key={action} action={action} disabled={!isActive} onDispatch={dispatch} />
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
}

function DesktopPreview({ sessionCode, isActive }) {
  const showActivity = useSettingsStore((state) => state.showActivity);
  return (
    <section className="live-stage">
      <div className="live-stage__heading">
        <div>
          <span className="eyebrow">Vista del cliente</span>
          <h1>Escritorio remoto</h1>
        </div>
        <span className="beta-badge">Vista previa · 3.1</span>
      </div>

      <div className="desktop-frame">
        <div className="desktop-wallpaper">
          <div className="desktop-orb desktop-orb--one" />
          <div className="desktop-orb desktop-orb--two" />
          <div className="desktop-icon"><Icon name="monitor" /><span>Este equipo</span></div>
          <div className="desktop-icon desktop-icon--second"><Icon name="folder" /><span>Trabajo</span></div>

          <div className="mock-window mock-window--back">
            <div className="mock-window__bar"><i /><i /><i /><span>Panel de rendimiento</span></div>
            <div className="mock-chart">
              <span /><span /><span /><span /><span />
            </div>
          </div>

          <div className="mock-window mock-window--front">
            <div className="mock-window__bar"><i /><i /><i /><span>Protección inteligente</span></div>
            <div className="mock-media">
              <div className="mock-media__shield"><Icon name="shield" size={28} /></div>
              <strong>Censor IA preparado</strong>
              <p>Detección regional en el equipo cliente</p>
              <div className="mock-media__regions"><span /><span /><span /></div>
            </div>
          </div>

          <div className="preview-message">
            <span className={`preview-message__icon ${isActive ? 'is-ready' : ''}`}>
              <Icon name={isActive ? 'monitor' : 'link'} size={22} />
            </span>
            <div>
              <strong>{isActive ? 'Cliente listo para recibir acciones' : 'Esperando conexión del cliente'}</strong>
              <p>{isActive ? 'La transmisión de escritorio se conectará en el paso 3.2.' : `Abre el cliente e introduce el código ${sessionCode || 'de sesión'}.`}</p>
            </div>
          </div>

          <div className="monitor-switcher">
            <button className="is-active"><Icon name="monitor" /> <span>1</span></button>
            <button><Icon name="monitor" /> <span>2</span></button>
          </div>
        </div>
      </div>

      {!isActive && (
        <div className="connection-notice">
          <Icon name="link" size={16} />
          Los controles se habilitarán cuando el cliente se conecte a la sesión <strong>{sessionCode}</strong>.
        </div>
      )}

      {showActivity && <ActivityLog />}
    </section>
  );
}

function CensorPanel({ isActive, dispatch }) {
  const defaultConfidence = useSettingsStore((state) => state.censorConfidence);
  const defaultIntensity = useSettingsStore((state) => state.censorIntensity);
  const defaultFps = useSettingsStore((state) => state.censorFps);
  const fallbackEngine = useSettingsStore((state) => state.censorFallback);
  const [enabled, setEnabled] = useState(false);
  const [confidence, setConfidence] = useState(defaultConfidence);
  const [intensity, setIntensity] = useState(defaultIntensity);
  const [fps, setFps] = useState(defaultFps);
  const [requestState, setRequestState] = useState('idle');

  const confidenceLabel = useMemo(() => {
    if (confidence <= 30) return 'Alta cobertura';
    if (confidence >= 45) return 'Precisa';
    return 'Equilibrada';
  }, [confidence]);

  const applyCensor = async (nextEnabled = enabled) => {
    if (!isActive || requestState === 'loading') return false;
    setRequestState('loading');
    const result = await dispatch(ACTIONS.censor_screen, {
      enabled: nextEnabled,
      engine: 'ai',
      intensity,
      confidence: confidence / 100,
      fps: Number(fps),
      fallbackEngine,
      fallback: false,
    });
    setRequestState(result.success ? 'success' : 'error');
    setTimeout(() => setRequestState('idle'), 1800);
    return result.success;
  };

  const handleCensorToggle = async () => {
    const nextEnabled = !enabled;
    if (await applyCensor(nextEnabled)) setEnabled(nextEnabled);
  };

  return (
    <aside className="censor-panel">
      <div className="ai-status-card">
        <span className="ai-hex"><Icon name="cpu" size={24} /></span>
        <div><strong>Censor IA</strong><p>Detección local en tiempo real</p></div>
        <span className={`status-dot ${isActive ? 'is-online' : 'is-waiting'}`} />
      </div>

      <section className="censor-settings">
        <div className="setting-row setting-row--toggle">
          <div><strong>Activar censor IA</strong><span>Motor regional NudeNet</span></div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            className={`toggle ${enabled ? 'is-on' : ''}`}
            disabled={!isActive || requestState === 'loading'}
            onClick={handleCensorToggle}
          ><span /></button>
        </div>

        <div className="privacy-stack">
          <div><Icon name="cpu" /><span><strong>Procesamiento local</strong><small>El análisis ocurre en el cliente</small></span></div>
          <div><Icon name="shield" /><span><strong>Sin subida a la nube</strong><small>Las capturas no salen del equipo</small></span></div>
        </div>

        <div className="setting-block">
          <label><span>Sensibilidad</span><b>{confidenceLabel}</b></label>
          <input type="range" min="25" max="50" step="5" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} />
          <div className="range-legend"><span>Más cobertura</span><span>{confidence}% confianza</span></div>
        </div>

        <div className="setting-block">
          <label><span>Intensidad de píxel</span><b>{intensity === 'high' ? 'Fuerte' : intensity === 'medium' ? 'Media' : 'Suave'}</b></label>
          <div className="segment-control">
            {['low', 'medium', 'high'].map((value) => (
              <button key={value} className={intensity === value ? 'is-active' : ''} onClick={() => setIntensity(value)}>
                {value === 'low' ? 'Suave' : value === 'medium' ? 'Media' : 'Fuerte'}
              </button>
            ))}
          </div>
        </div>

        <div className="setting-block">
          <label><span>Zonas detectadas</span><b>Explícitas</b></label>
          <div className="detection-tags"><span>Pecho</span><span>Genitales</span><span>Glúteos</span><span>Ano</span></div>
        </div>

        <div className="setting-block">
          <label htmlFor="censor-fps"><span>Frecuencia</span><b>{fps} FPS</b></label>
          <select id="censor-fps" value={fps} onChange={(event) => setFps(event.target.value)}>
            <option value="3">3 FPS · Menor CPU</option>
            <option value="5">5 FPS · Equilibrado</option>
            <option value="7">7 FPS · Más fluido</option>
          </select>
        </div>

        <button
          type="button"
          className={`censor-apply is-${requestState}`}
          disabled={!isActive || requestState === 'loading'}
          onClick={() => applyCensor(enabled)}
        >
          <Icon name="settings" size={17} />
          {requestState === 'loading' ? 'Aplicando…' : requestState === 'success' ? 'Configuración aplicada' : requestState === 'error' ? 'No se pudo aplicar' : 'Aplicar configuración'}
        </button>
      </section>
    </aside>
  );
}

export default function Control() {
  const navigate = useNavigate();
  const sessionCode = useSessionStore((state) => state.sessionCode);
  const sessionStatus = useSessionStore((state) => state.sessionStatus);
  const token = useSessionStore((state) => state.token);
  const { dispatch } = useSocket();

  useEffect(() => {
    if (!sessionCode) navigate('/sessions');
  }, [sessionCode, navigate]);

  const isActive = sessionStatus === 'active';
  const go = (path) => navigate(`${path}${token === 'local-preview' ? '?preview=1' : ''}`);

  return (
    <div className="command-center">
      <Header sessionCode={sessionCode} isActive={isActive} dispatch={dispatch} onBack={() => navigate('/sessions')} />
      <div className="command-layout">
        <Sidebar isActive={isActive} dispatch={dispatch} navigate={go} />
        <DesktopPreview sessionCode={sessionCode} isActive={isActive} />
        <CensorPanel isActive={isActive} dispatch={dispatch} />
      </div>
      <footer className="status-bar">
        <span><i className={isActive ? 'is-online' : ''} /> {isActive ? 'Conectado' : 'En espera'}</span>
        <span>Sesión <strong>{sessionCode || '—'}</strong></span>
        <span>Windows Client</span>
        <span>Censor IA Beta</span>
        <a href="/source" target="_blank" rel="noreferrer">Código fuente · AGPL-3.0</a>
      </footer>
    </div>
  );
}
