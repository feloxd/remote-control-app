import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ACTIONS } from '@remote-control/shared/actions';
import { useSocket } from '../hooks/useSocket';
import useSessionStore from '../store/sessionStore';
import ActionButton from '../components/ActionButton';
import ActivityLog from '../components/ActivityLog';

const ACTION_GROUPS = [
  { label: 'Navigation',       actions: [ACTIONS.open_url] },
  { label: 'Media',            actions: [ACTIONS.show_image, ACTIONS.close_image, ACTIONS.play_video, ACTIONS.close_video, ACTIONS.play_audio, ACTIONS.stop_audio] },
  { label: 'Overlay',          actions: [ACTIONS.show_overlay, ACTIONS.hide_overlay, ACTIONS.pixelate_screen, ACTIONS.censor_screen, ACTIONS.show_text, ACTIONS.blackout_screen, ACTIONS.hide_cursor] },
  { label: 'Keyboard',         actions: [ACTIONS.lock_keyboard, ACTIONS.unlock_keyboard] },
  { label: 'Screen',           actions: [ACTIONS.lock_screen, ACTIONS.unlock_screen, ACTIONS.take_screenshot] },
  { label: 'Content Filters',  actions: [ACTIONS.filter_sites, ACTIONS.clear_filters] },
];

export default function Control() {
  const navigate = useNavigate();
  const sessionCode = useSessionStore((s) => s.sessionCode);
  const sessionStatus = useSessionStore((s) => s.sessionStatus);
  const { dispatch } = useSocket();

  useEffect(() => {
    if (!sessionCode) navigate('/sessions');
  }, [sessionCode]);

  const isActive = sessionStatus === 'active';

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-card px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/sessions')}
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            ← Back
          </button>
          <div className="h-4 w-px bg-gray-800" />
          <span className="font-mono font-bold text-accent tracking-widest">{sessionCode}</span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full transition-colors"
            style={{ backgroundColor: isActive ? '#22c55e' : '#f59e0b' }}
          />
          <span className="text-xs text-gray-500">
            {isActive ? 'Client connected' : 'Waiting for client...'}
          </span>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Action Panel */}
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          {!isActive && (
            <div className="rounded-xl border border-yellow-800/40 bg-yellow-900/10 px-4 py-3">
              <p className="text-sm text-yellow-600">
                Buttons are disabled until a client joins with code{' '}
                <span className="font-mono font-bold text-accent">{sessionCode}</span>.
              </p>
            </div>
          )}

          {ACTION_GROUPS.map((group) => (
            <div key={group.label} className="rounded-xl border border-gray-800 bg-card p-5">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-3">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.actions.map((action) => (
                  <ActionButton
                    key={action}
                    action={action}
                    disabled={!isActive}
                    onDispatch={dispatch}
                  />
                ))}
              </div>
            </div>
          ))}
        </main>

        {/* Activity Log sidebar */}
        <aside className="w-72 border-l border-gray-800 shrink-0 overflow-hidden flex flex-col">
          <ActivityLog />
        </aside>
      </div>
    </div>
  );
}
