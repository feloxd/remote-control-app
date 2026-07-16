import React, { useState, useEffect, useRef } from 'react';

const CATEGORY_DOMAINS = {
  adult:  ['pornhub.com', 'xvideos.com', 'xhamster.com', 'redtube.com', 'youporn.com'],
  social: ['facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com', 'snapchat.com'],
  gaming: ['steampowered.com', 'twitch.tv', 'epicgames.com', 'roblox.com', 'minecraft.net'],
  news:   ['cnn.com', 'bbc.com', 'foxnews.com', 'nytimes.com', 'theguardian.com'],
};

const CONFIG = {
  open_url:     { type: 'text', field: 'url',     title: 'Open URL',        placeholder: 'https://' },
  show_image:   { type: 'text', field: 'url',     title: 'Show Image',      placeholder: 'https://example.com/image.jpg' },
  play_video:   { type: 'text', field: 'url',     title: 'Play Video',      placeholder: 'https://example.com/video.mp4' },
  play_audio:   { type: 'text', field: 'url',     title: 'Play Audio',      placeholder: 'https://example.com/audio.mp3' },
  show_text:    { type: 'textarea', field: 'text', title: 'Show Text',       placeholder: 'Message to display' },
  show_overlay: {
    type:    'select',
    field:   'speed',
    title:   'Hypnotic Spiral — Speed',
    default: 'normal',
    options: [
      { value: 'slow',   label: 'Slow' },
      { value: 'normal', label: 'Normal' },
      { value: 'fast',   label: 'Fast' },
    ],
  },
  blackout_screen: {
    type:    'select',
    field:   'duration',
    title:   'Blackout Screen — Duration',
    default: 30,
    options: [
      { value: 15, label: '15 seconds' },
      { value: 30, label: '30 seconds' },
      { value: 60, label: '60 seconds' },
    ],
  },
  hide_cursor: {
    type:    'select',
    field:   'duration',
    title:   'Hide Cursor — Duration',
    default: 10,
    options: [
      { value: 10, label: '10 seconds' },
      { value: 30, label: '30 seconds' },
      { value: 60, label: '60 seconds' },
    ],
  },
  pixelate_screen: {
    type:    'select',
    field:   'enabled',
    title:   'Pixelate Screen',
    default: 'true',
    options: [
      { value: 'true', label: 'Enable' },
      { value: 'false', label: 'Disable' },
    ],
  },
  censor_screen: {
    type: 'censor',
    title: 'Smart Censor',
    defaults: {
      enabled: 'true',
      engine: 'ai',
      intensity: 'medium',
      confidence: '0.35',
      fps: '5',
      fallbackEngine: 'skin',
    },
  },
  filter_sites: { type: 'categories', title: 'Block Categories' },
};

export function needsModal(action) {
  return action in CONFIG;
}

export default function PayloadModal({ action, onConfirm, onCancel }) {
  const cfg = CONFIG[action];
  const [url, setUrl] = useState('');
  const [selected, setSelected] = useState({});
  const [choice, setChoice] = useState(cfg.type === 'select' ? cfg.default : '');
  const [censor, setCensor] = useState(cfg.type === 'censor' ? cfg.defaults : {});
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const isValid =
    cfg.type === 'text' || cfg.type === 'textarea' ? url.trim().length > 0 :
    cfg.type === 'select' ? !!choice :
    cfg.type === 'censor' ? true :
                            Object.values(selected).some(Boolean);

  const handleConfirm = () => {
    if (!isValid) return;
    if (cfg.type === 'text' || cfg.type === 'textarea') {
      onConfirm({ [cfg.field]: url.trim() });
    } else if (cfg.type === 'select') {
      onConfirm({ [cfg.field]: choice });
    } else if (cfg.type === 'censor') {
      onConfirm({
        enabled: censor.enabled === 'true',
        engine: censor.engine,
        intensity: censor.intensity,
        confidence: Number(censor.confidence),
        fps: Number(censor.fps),
        fallbackEngine: censor.fallbackEngine,
        fallback: false,
      });
    } else {
      const domains = Object.entries(selected)
        .filter(([, v]) => v)
        .flatMap(([cat]) => CATEGORY_DOMAINS[cat]);
      onConfirm({ domains });
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && (cfg.type === 'text' || cfg.type === 'select')) handleConfirm();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      onKeyDown={handleKey}
    >
      <div className="bg-card border border-gray-700 rounded-xl p-6 w-80 shadow-2xl">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">{cfg.title}</h3>

        {cfg.type === 'text' && (
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={cfg.placeholder}
            className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent"
          />
        )}

        {cfg.type === 'censor' && (
          <div className="space-y-3" ref={inputRef} tabIndex={-1}>
            {[
              ['enabled', 'State', [['true', 'Enable'], ['false', 'Disable']]],
              ['engine', 'Detection', [['ai', 'AI regional (Beta)'], ['skin', 'Legacy skin-color']]],
              ['confidence', 'Confidence', [['0.25', '25% · More coverage'], ['0.35', '35% · Balanced'], ['0.5', '50% · Fewer false positives']]],
              ['intensity', 'Pixelation', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]],
              ['fps', 'Detection rate', [['3', '3 FPS · Low CPU'], ['5', '5 FPS · Balanced'], ['7', '7 FPS · Smoother']]],
              ['fallbackEngine', 'If AI is unavailable', [['skin', 'Use legacy detector'], ['none', 'Do not censor']]],
            ].map(([field, label, options]) => (
              <div key={field}>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
                <select
                  value={censor[field]}
                  onChange={(e) => setCensor((s) => ({ ...s, [field]: e.target.value }))}
                  className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-accent"
                >
                  {options.map(([value, text]) => (
                    <option key={value} value={value}>{text}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        {cfg.type === 'textarea' && (
          <textarea
            ref={inputRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={cfg.placeholder}
            rows={5}
            className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent resize-none"
          />
        )}

        {cfg.type === 'select' && (
          <div className="space-y-2" ref={inputRef} tabIndex={-1}>
            {cfg.options.map((opt) => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name={cfg.field}
                  value={opt.value}
                  checked={choice === opt.value}
                  onChange={() => setChoice(opt.value)}
                  className="w-4 h-4 accent-accent cursor-pointer"
                />
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
        )}

        {cfg.type === 'categories' && (
          <div className="space-y-3" ref={inputRef}>
            {Object.keys(CATEGORY_DOMAINS).map((cat) => (
              <label key={cat} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={!!selected[cat]}
                  onChange={(e) => setSelected((s) => ({ ...s, [cat]: e.target.checked }))}
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
                <span className="text-sm text-gray-300 capitalize group-hover:text-white transition-colors">
                  {cat}
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-5 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid}
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
