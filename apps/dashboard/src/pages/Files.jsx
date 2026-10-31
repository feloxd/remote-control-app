import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import SectionLayout from '../components/SectionLayout';
import useSessionStore from '../store/sessionStore';
import Icon from '../components/Icon';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const CHUNK_BYTES = 256 * 1024;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Files() {
  const navigate = useNavigate();
  const token = useSessionStore((state) => state.token);
  const sessionCode = useSessionStore((state) => state.sessionCode);
  const sessionStatus = useSessionStore((state) => state.sessionStatus);
  const setSessionStatus = useSessionStore((state) => state.setSessionStatus);
  const [selectedFile, setSelectedFile] = useState(null);
  const [transfer, setTransfer] = useState(null);
  const [history, setHistory] = useState([]);
  const socketRef = useRef(null);
  const cancelledRef = useRef(false);
  const isPreview = token === 'local-preview';

  useEffect(() => {
    if (!sessionCode) {
      navigate('/sessions');
      return undefined;
    }
    if (token === 'local-preview') return undefined;

    const socket = io('/dash', { auth: { token } });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join_session', sessionCode));
    socket.on('session_joined', ({ status }) => setSessionStatus(status));
    socket.on('session_active', () => setSessionStatus('active'));
    socket.on('client_disconnected', () => setSessionStatus('pending'));
    socket.on('file_transfer_status', (status) => {
      setTransfer((current) => current?.id === status.transferId ? {
        ...current,
        state: status.state,
        progress: status.total ? Math.round(((status.received || status.sent || current.sent || 0) / status.total) * 100) : current.progress,
        error: status.error || '',
        destination: status.path || current.destination,
      } : current);
      if (status.state === 'complete' || status.state === 'error' || status.state === 'cancelled') {
        setHistory((items) => [{ ...status, timestamp: new Date().toISOString() }, ...items].slice(0, 20));
      }
    });
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [token, sessionCode, navigate, setSessionStatus]);

  const chooseFile = (file) => {
    if (!file) return;
    if (file.size < 1 || file.size > MAX_FILE_BYTES) {
      setTransfer({ state: 'error', error: 'El archivo debe pesar entre 1 byte y 25 MB.', progress: 0 });
      return;
    }
    setSelectedFile(file);
    setTransfer(null);
  };

  const sendFile = async () => {
    const socket = socketRef.current;
    if (!selectedFile || sessionStatus !== 'active' || (!isPreview && !socket?.connected)) return;
    const id = crypto.randomUUID();
    cancelledRef.current = false;
    setTransfer({ id, name: selectedFile.name, size: selectedFile.size, state: 'sending', sent: 0, progress: 0, error: '' });
    if (isPreview) {
      for (const progress of [18, 42, 68, 100]) {
        await new Promise((resolve) => setTimeout(resolve, 120));
        setTransfer((current) => ({ ...current, progress, state: progress === 100 ? 'complete' : 'sending' }));
      }
      setHistory((items) => [{ transferId: id, state: 'complete', name: selectedFile.name, timestamp: new Date().toISOString() }, ...items]);
      return;
    }
    socket.emit('file_transfer_start', { transferId: id, name: selectedFile.name, size: selectedFile.size, mime: selectedFile.type });

    for (let offset = 0, index = 0; offset < selectedFile.size; offset += CHUNK_BYTES, index += 1) {
      if (cancelledRef.current) return;
      const data = await selectedFile.slice(offset, Math.min(offset + CHUNK_BYTES, selectedFile.size)).arrayBuffer();
      socket.emit('file_transfer_chunk', { transferId: id, index, data });
      const sent = Math.min(offset + data.byteLength, selectedFile.size);
      setTransfer((current) => current?.id === id ? { ...current, sent, progress: Math.round((sent / selectedFile.size) * 100) } : current);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    socket.emit('file_transfer_end', { transferId: id });
    setTransfer((current) => current?.id === id ? { ...current, state: 'processing', progress: 100 } : current);
  };

  const cancelTransfer = () => {
    if (!transfer?.id) return;
    cancelledRef.current = true;
    socketRef.current?.emit('file_transfer_cancel', { transferId: transfer.id });
    setTransfer((current) => ({ ...current, state: 'cancelled' }));
  };

  const canSend = sessionStatus === 'active' && selectedFile && (isPreview || socketRef.current?.connected) && !['sending', 'processing'].includes(transfer?.state);

  return (
    <SectionLayout active="files" eyebrow="Transferencia segura" title="Archivos" subtitle="Envía archivos al cliente dentro de una carpeta de descargas aislada.">
      <div className="files-grid">
        <section
          className={`file-drop ${sessionStatus !== 'active' ? 'is-disabled' : ''}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); chooseFile(event.dataTransfer.files?.[0]); }}
        >
          <span className="file-drop__icon"><Icon name="folder" size={25} /></span>
          <h2>{selectedFile ? selectedFile.name : 'Selecciona un archivo'}</h2>
          <p>{selectedFile ? formatBytes(selectedFile.size) : 'Arrastra un archivo o utiliza el selector. Tamaño máximo: 25 MB.'}</p>
          <label className="file-picker"><input type="file" onChange={(event) => chooseFile(event.target.files?.[0])} disabled={sessionStatus !== 'active'} />Elegir archivo</label>
          <button className="file-send" onClick={sendFile} disabled={!canSend}>Enviar al cliente</button>
          {sessionStatus !== 'active' && <div className="file-warning">Conecta un cliente para habilitar transferencias.</div>}
        </section>

        <section className="transfer-card">
          <header><h2>Transferencia actual</h2><span>Descargas\Remote Control Files</span></header>
          {!transfer ? <div className="transfer-empty">No hay una transferencia activa.</div> : (
            <div className="transfer-current">
              <div><strong>{transfer.name || selectedFile?.name || 'Archivo'}</strong><span>{transfer.state === 'complete' ? 'Completado' : transfer.state === 'error' ? transfer.error : transfer.state === 'processing' ? 'Guardando en el cliente…' : transfer.state === 'cancelled' ? 'Cancelado' : 'Enviando…'}</span></div>
              <b>{transfer.progress || 0}%</b>
              <div className="transfer-progress"><i style={{ width: `${transfer.progress || 0}%` }} /></div>
              {['sending', 'processing'].includes(transfer.state) && <button onClick={cancelTransfer}>Cancelar transferencia</button>}
            </div>
          )}
        </section>

        <section className="transfer-history">
          <header><h2>Historial de esta sesión</h2><span>Los archivos nunca se almacenan en el servidor.</span></header>
          {history.length === 0 ? <div className="transfer-empty">Las transferencias completadas aparecerán aquí.</div> : history.map((item, index) => (
            <div className="transfer-history__item" key={`${item.transferId}-${index}`}><Icon name={item.state === 'complete' ? 'shield' : 'activity'} size={16} /><span><strong>{item.name || item.transferId}</strong><small>{item.state === 'complete' ? 'Guardado en el cliente' : item.error || item.state}</small></span><time>{new Date(item.timestamp).toLocaleTimeString()}</time></div>
          ))}
        </section>
      </div>
    </SectionLayout>
  );
}
