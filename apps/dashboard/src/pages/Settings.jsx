import React from 'react';
import SectionLayout from '../components/SectionLayout';
import useSettingsStore from '../store/settingsStore';

function SettingSwitch({ label, description, checked, onChange }) {
  return (
    <div className="settings-row">
      <div><strong>{label}</strong><span>{description}</span></div>
      <button type="button" role="switch" aria-checked={checked} className={`toggle ${checked ? 'is-on' : ''}`} onClick={() => onChange(!checked)}><span /></button>
    </div>
  );
}

export default function Settings() {
  const settings = useSettingsStore();
  const update = settings.updateSetting;

  return (
    <SectionLayout active="settings" eyebrow="Preferencias" title="Ajustes del dashboard" subtitle="Configura el comportamiento local y los valores predeterminados del censor.">
      <div className="settings-grid">
        <section className="settings-card">
          <header><h2>Comportamiento</h2><p>Preferencias aplicadas en este navegador.</p></header>
          <SettingSwitch label="Confirmar acciones sensibles" description="Solicita confirmación antes de bloquear o filtrar." checked={settings.confirmSensitiveActions} onChange={(value) => update('confirmSensitiveActions', value)} />
          <SettingSwitch label="Reconexión automática" description="Vuelve a conectar el dashboard cuando la red regresa." checked={settings.autoReconnect} onChange={(value) => update('autoReconnect', value)} />
          <SettingSwitch label="Mostrar actividad" description="Muestra el historial reciente bajo la vista del cliente." checked={settings.showActivity} onChange={(value) => update('showActivity', value)} />
        </section>

        <section className="settings-card">
          <header><h2>Censor IA predeterminado</h2><p>Estos valores se cargan al abrir una nueva sesión.</p></header>
          <label className="settings-field"><span>Sensibilidad</span><b>{settings.censorConfidence}%</b><input type="range" min="25" max="50" step="5" value={settings.censorConfidence} onChange={(event) => update('censorConfidence', Number(event.target.value))} /></label>
          <label className="settings-field"><span>Intensidad</span><select value={settings.censorIntensity} onChange={(event) => update('censorIntensity', event.target.value)}><option value="low">Suave</option><option value="medium">Media</option><option value="high">Fuerte</option></select></label>
          <label className="settings-field"><span>Frecuencia</span><select value={settings.censorFps} onChange={(event) => update('censorFps', event.target.value)}><option value="3">3 FPS · Menor CPU</option><option value="5">5 FPS · Equilibrado</option><option value="7">7 FPS · Más fluido</option></select></label>
          <label className="settings-field"><span>Si la IA no está disponible</span><select value={settings.censorFallback} onChange={(event) => update('censorFallback', event.target.value)}><option value="skin">Usar detector clásico</option><option value="none">No censurar</option></select></label>
        </section>

        <section className="settings-card settings-card--wide">
          <header><h2>Información</h2><p>Configuración de esta instalación.</p></header>
          <div className="settings-info"><span>Versión del dashboard</span><strong>1.2.0</strong><span>Licencia</span><strong>GNU AGPL-3.0</strong><span>Procesamiento IA</span><strong>Local en el cliente</strong></div>
          <button className="settings-reset" onClick={settings.resetSettings}>Restablecer preferencias</button>
        </section>
      </div>
    </SectionLayout>
  );
}
