import React from 'react';
import useSessionStore from '../store/sessionStore';

const ACTION_COLORS = {
  system: 'text-gray-500',
  error:  'text-red-400',
};

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function payloadText(payload) {
  if (typeof payload === 'string') return payload;
  if (payload && Object.keys(payload).length > 0) return JSON.stringify(payload);
  return null;
}

export default function ActivityLog() {
  const activityLog = useSessionStore((s) => s.activityLog);
  const clearLog = useSessionStore((s) => s.clearLog);

  return (
    <>
      <div className="px-4 py-3 border-b border-gray-800 bg-card flex items-center justify-between shrink-0">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Activity</span>
        {activityLog.length > 0 && (
          <button
            onClick={clearLog}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-surface">
        {activityLog.length === 0 ? (
          <p className="text-xs text-gray-700 text-center pt-8">No actions dispatched yet</p>
        ) : (
          activityLog.map((entry, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <span className="text-gray-700 font-mono shrink-0 mt-0.5">
                {formatTime(entry.timestamp)}
              </span>
              <div className="min-w-0">
                <span
                  className={`font-semibold ${ACTION_COLORS[entry.action] || 'text-accent'}`}
                >
                  {entry.action.replace(/_/g, ' ')}
                </span>
                {payloadText(entry.payload) && (
                  <p className="text-gray-600 truncate">{payloadText(entry.payload)}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
