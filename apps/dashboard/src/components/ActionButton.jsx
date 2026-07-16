import React, { useCallback, useState } from 'react';
import PayloadModal, { needsModal } from './PayloadModal';
import Icon from './Icon';
import useSettingsStore from '../store/settingsStore';

const ACTION_META = {
  open_url: ['Abrir URL', 'globe'],
  show_image: ['Mostrar imagen', 'image'],
  close_image: ['Cerrar imagen', 'eyeOff'],
  play_video: ['Reproducir video', 'play'],
  close_video: ['Cerrar video', 'eyeOff'],
  play_audio: ['Reproducir audio', 'play'],
  stop_audio: ['Detener audio', 'eyeOff'],
  show_overlay: ['Mostrar overlay', 'grid'],
  hide_overlay: ['Ocultar overlay', 'eyeOff'],
  pixelate_screen: ['Pixelar pantalla', 'pixels'],
  censor_screen: ['Censor IA', 'shield'],
  show_text: ['Mostrar texto', 'type'],
  blackout_screen: ['Pantalla negra', 'monitor'],
  hide_cursor: ['Ocultar cursor', 'mouse'],
  lock_keyboard: ['Bloquear teclado', 'lock'],
  unlock_keyboard: ['Desbloquear teclado', 'lock'],
  lock_screen: ['Bloquear pantalla', 'lock'],
  unlock_screen: ['Desbloquear pantalla', 'monitor'],
  take_screenshot: ['Captura', 'camera'],
  filter_sites: ['Filtrar sitios', 'globe'],
  clear_filters: ['Limpiar filtros', 'globe'],
};

const STATES = {
  idle: '',
  loading: 'is-loading',
  success: 'is-success',
  error: 'is-error',
};

export default function ActionButton({ action, disabled, onDispatch, variant = 'sidebar' }) {
  const [buttonState, setButtonState] = useState('idle');
  const [showModal, setShowModal] = useState(false);
  const confirmSensitiveActions = useSettingsStore((state) => state.confirmSensitiveActions);
  const [label, icon] = ACTION_META[action] || [action.replace(/_/g, ' '), 'bolt'];

  const fire = useCallback(async (payload = {}) => {
    setButtonState('loading');
    try {
      const { success } = await onDispatch(action, payload);
      setButtonState(success ? 'success' : 'error');
    } catch {
      setButtonState('error');
    }
    setTimeout(() => setButtonState('idle'), 1500);
  }, [onDispatch, action]);

  const handleClick = useCallback(() => {
    if (buttonState !== 'idle' || disabled) return;
    if (
      confirmSensitiveActions
      && action === 'blackout_screen'
      && !window.confirm('¿Confirmas que deseas activar la pantalla negra en el cliente?')
    ) return;
    if (needsModal(action)) setShowModal(true);
    else fire();
  }, [buttonState, disabled, action, fire, confirmSensitiveActions]);

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || buttonState === 'loading'}
        className={`action-control action-control--${variant} ${STATES[buttonState]}`}
        title={disabled ? 'Esperando conexión del cliente' : label}
      >
        <Icon name={buttonState === 'loading' ? 'activity' : icon} size={variant === 'header' ? 17 : 16} />
        <span>{buttonState === 'loading' ? 'Procesando…' : label}</span>
      </button>

      {showModal && (
        <PayloadModal
          action={action}
          onConfirm={(payload) => { setShowModal(false); fire(payload); }}
          onCancel={() => setShowModal(false)}
        />
      )}
    </>
  );
}
