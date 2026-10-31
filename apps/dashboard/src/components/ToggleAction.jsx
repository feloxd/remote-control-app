import React, { useCallback, useState } from 'react';
import Icon from './Icon';
import PayloadModal from './PayloadModal';
import useSettingsStore from '../store/settingsStore';

const SENSITIVE_ACTIONS = new Set(['lock_keyboard', 'lock_screen', 'filter_sites']);

export default function ToggleAction({
  label,
  icon,
  enableAction,
  disableAction,
  enablePayload = {},
  disablePayload = {},
  configureOnEnable = false,
  disabled,
  onDispatch,
}) {
  const [enabled, setEnabled] = useState(false);
  const [requestState, setRequestState] = useState('idle');
  const [showModal, setShowModal] = useState(false);
  const confirmSensitiveActions = useSettingsStore((state) => state.confirmSensitiveActions);

  const applyState = useCallback(async (nextEnabled, payload = {}) => {
    if (disabled || requestState === 'loading') return;
    setRequestState('loading');

    const action = nextEnabled ? enableAction : disableAction;
    const basePayload = nextEnabled ? enablePayload : disablePayload;

    try {
      const result = await onDispatch(action, { ...basePayload, ...payload });
      if (result.success) {
        setEnabled(nextEnabled);
        setRequestState('success');
      } else {
        setRequestState('error');
      }
    } catch {
      setRequestState('error');
    }

    setTimeout(() => setRequestState('idle'), 1500);
  }, [disabled, requestState, enableAction, disableAction, enablePayload, disablePayload, onDispatch]);

  const handleToggle = () => {
    const nextEnabled = !enabled;
    if (
      nextEnabled
      && confirmSensitiveActions
      && SENSITIVE_ACTIONS.has(enableAction)
      && !window.confirm(`¿Confirmas que deseas activar "${label}" en el cliente?`)
    ) return;
    if (nextEnabled && configureOnEnable) {
      setShowModal(true);
      return;
    }
    applyState(nextEnabled);
  };

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled || requestState === 'loading'}
        className={`toggle-control ${enabled ? 'is-on' : ''} is-${requestState}`}
        onClick={handleToggle}
        title={disabled ? 'Esperando conexión del cliente' : `${label}: ${enabled ? 'activado' : 'desactivado'}`}
      >
        <span className="toggle-control__identity">
          <Icon name={icon} size={16} />
          <span><strong>{label}</strong><small>{requestState === 'loading' ? 'Aplicando…' : enabled ? 'Activado' : 'Desactivado'}</small></span>
        </span>
        <span className="toggle-control__switch" aria-hidden="true"><i /></span>
      </button>

      {showModal && (
        <PayloadModal
          action={enableAction}
          onConfirm={(payload) => {
            setShowModal(false);
            applyState(true, payload);
          }}
          onCancel={() => setShowModal(false)}
        />
      )}
    </>
  );
}
