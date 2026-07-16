import React from 'react';
import useSessionStore from '../store/sessionStore';
import Icon from './Icon';

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
    <section className="activity-card">
      <div className="activity-card__header">
        <span><Icon name="activity" size={15} /> Actividad reciente</span>
        {activityLog.length > 0 && <button onClick={clearLog}>Limpiar</button>}
      </div>

      <div className="activity-card__body">
        {activityLog.length === 0 ? (
          <div className="activity-empty">
            <span className="activity-empty__pulse" />
            Las acciones aparecerán aquí
          </div>
        ) : (
          activityLog.slice(0, 12).map((entry, index) => (
            <div key={`${entry.timestamp}-${index}`} className="activity-entry">
              <span className={`activity-entry__dot ${entry.action === 'error' ? 'is-error' : ''}`} />
              <div>
                <strong>{entry.action.replace(/_/g, ' ')}</strong>
                {payloadText(entry.payload) && <p>{payloadText(entry.payload)}</p>}
              </div>
              <time>{formatTime(entry.timestamp)}</time>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
