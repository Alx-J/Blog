import { useState, useRef, useCallback } from 'react';

const ALLOWED = /\.(png|jpe?g|gif|webp|svg)$/i;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export default function ImageDropZone({ csrfToken, onSuccess, onError }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const inputRef = useRef(null);

  const upload = useCallback(async (file) => {
    if (!ALLOWED.test(file.name)) { onError(`"${file.name}" is not a supported image format.`); return; }
    if (file.size > MAX_SIZE) { onError(`"${file.name}" is too large — max 5MB.`); return; }

    setUploading(true);
    setProgress(`Reading ${file.name}…`);
    try {
      // Read as base64
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      setProgress(`Uploading ${file.name} to GitHub…`);
      const res = await fetch('/api/admin/images/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ filename: file.name, base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      onSuccess(file.name, `/images/${file.name}`);
    } catch (err) {
      onError(err.message);
    } finally {
      setUploading(false);
      setProgress('');
    }
  }, [csrfToken, onSuccess, onError]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragging(false);
    const files = [...e.dataTransfer.files].filter(f => ALLOWED.test(f.name));
    if (!files.length) { onError('No supported image files found.'); return; }
    for (const f of files) await upload(f);
  }, [upload, onError]);

  return (
    <div
      className={`drop-zone ${dragging ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
      style={{ minHeight: '140px' }}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <div className="dz-corner tl" /><div className="dz-corner tr" />
      <div className="dz-corner bl" /><div className="dz-corner br" />
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
        onChange={async e => { for (const f of e.target.files) await upload(f); e.target.value = ''; }} />

      {uploading ? (
        <><div className="spinner" /><p className="dz-title">Uploading…</p><p className="dz-sub">{progress}</p></>
      ) : (
        <>
          <div className="dz-icon">🖼️</div>
          <p className="dz-title">Drop Images Here</p>
          <p className="dz-sub"><span>PNG · JPG · GIF · WebP · SVG</span> · max 5MB</p>
          <p className="dz-sub">Upload first → use <span>/images/filename.png</span> in markdown</p>
          <button className="dz-browse" onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}>
            Browse Images
          </button>
        </>
      )}
    </div>
  );
}
