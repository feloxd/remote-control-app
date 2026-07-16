import React, { useState, useCallback } from 'react';
import PayloadModal, { needsModal } from './PayloadModal';

const STYLES = {
  idle:    'border-gray-700 text-gray-300 bg-surface hover:border-gray-500 hover:text-white',
  loading: 'border-accent text-accent bg-surface opacity-70 cursor-wait',
  success: 'border-green-600 text-green-400 bg-green-900/20',
  error:   'border-red-700 text-red-400 bg-red-900/20',
};

export default function ActionButton({ action, disabled, onDispatch }) {
  const [btnState, setBtnState] = useState('idle');
  const [showModal, setShowModal] = useState(false);

  const label = action.replace(/_/g, ' ');

  const fire = useCallback(async (payload = {}) => {
    setBtnState('loading');
    try {
      const { success } = await onDispatch(action, payload);
      setBtnState(success ? 'success' : 'error');
    } catch {
      setBtnState('error');
    }
    setTimeout(() => setBtnState('idle'), 1500);
  }, [onDispatch, action]);

  const handleClick = useCallback(() => {
    if (btnState !== 'idle' || disabled) return;
    if (needsModal(action)) {
      setShowModal(true);
    } else {
      fire();
    }
  }, [btnState, disabled, action, fire]);

  return (
    <>
      <button
        onClick={handleClick}
        disabled={disabled || btnState === 'loading'}
        className={`
          px-4 py-2 rounded-lg text-sm font-medium border capitalize
          transition-all duration-200
          disabled:opacity-40 disabled:cursor-not-allowed
          ${STYLES[btnState]}
        `}
        title={disabled ? 'Waiting for client to connect' : action}
      >
        {btnState === 'loading' ? '...' : label}
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
