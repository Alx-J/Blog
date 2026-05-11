import { useState, useRef, useCallback } from 'react';

export default function DropZone({ type = 'post', csrfToken, onSuccess, onError, label, icon }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const inputRef = useRef(null);

  const upload = useCallback(async (file) => {
    if (!file.name.endsWith('.md')) { onError('Only .md files allowed.'); return; }
    if (file.size > 500_000) { onError('File too large — max 500KB.'); return; }

    setUploading(true);
    setProgress(`Reading ${file.name}…`);
    try {
      const text = await file.text();
      setProgress(`Uploading to GitHub…`);
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ filename: file.name, content: text, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onSuccess(`"${file.name}" uploaded successfully.`);
    } catch (err) {
      onError(err.message);
    } finally {
      setUploading(false);
      setProgress('');
    }
  }, [csrfToken, type, onSuccess, onError]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragging(false);
    const files = [...e.dataTransfer.files].filter(f => f.name.endsWith('.md'));
    if (!files.length) { onError('No .md files found.'); return; }
    for (const f of files) await upload(f);
  }, [upload, onError]);

  return (
    <div
      className={`drop-zone ${dragging ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <div className="dz-corner tl" /><div className="dz-corner tr" />
      <div className="dz-corner bl" /><div className="dz-corner br" />
      <input ref={inputRef} type="file" accept=".md" multiple style={{ display: 'none' }}
        onChange={async e => { for (const f of e.target.files) await upload(f); e.target.value = ''; }} />

      {uploading ? (
        <><div className="spinner" /><p className="dz-title">Uploading…</p><p className="dz-sub">{progress}</p></>
      ) : (
        <>
          <div className="dz-icon">{icon || '📝'}</div>
          <p className="dz-title">{label || 'Drop .md file'}</p>
          <p className="dz-sub">Drag &amp; drop or <span>click to browse</span></p>
          <p className="dz-sub">Obsidian <span>frontmatter</span> · <span>![[images]]</span> supported</p>
          <button className="dz-browse" onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}>
            Browse
          </button>
        </>
      )}
    </div>
  );
}
