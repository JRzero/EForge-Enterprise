import {NativeInput} from '../../ui/native';
import {useEffect, useRef, useState} from 'react';
import {Button} from '../../ui/controls';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {useApi} from '../../app/context';
import {errorMessage} from '../../integration/errors';
import {cropGeometry, drawCrop, initialCrop} from './crop';

export function AvatarDialog({avatarUrl, onCancel, onSaved}: {avatarUrl?: string; onCancel: () => void; onSaved: () => Promise<void>}) {
  const api = useApi(); const [file, setFile] = useState<File | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null); const [crop, setCrop] = useState(initialCrop);
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null); const preview = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{x: number; y: number; startX: number; startY: number} | null>(null);
  useEffect(() => {
    const url = file ? URL.createObjectURL(file) : avatarUrl;
    if (!url) return;
    let active = true; const next = new Image(); setLoading(true); setImage(null);
    next.onload = () => {
      if (!active) return;
      if (next.naturalWidth > 4096 || next.naturalHeight > 4096 || next.naturalWidth * next.naturalHeight > 16_000_000) {
        setError('图片过大，请选择每边不超过 4096 像素的图片。'); setLoading(false); return;
      }
      setImage(next); setCrop(initialCrop); setLoading(false);
    };
    next.onerror = () => { if (active) { setError('图片无法读取，请重新选择。'); setLoading(false); } };
    next.src = url;
    return () => { active = false; next.onload = null; next.onerror = null; if (file) URL.revokeObjectURL(url); };
  }, [file, avatarUrl]);
  useEffect(() => {
    if (!image || !canvas.current || !preview.current) return;
    try { drawCrop(canvas.current, image, crop); drawCrop(preview.current, image, crop); }
    catch { setError('当前浏览器无法裁剪图片，请更换浏览器后重试。'); }
  }, [image, crop]);
  function choose(next?: File) {
    if (!next) return;
    if (!/\.(png|jpe?g|gif|bmp)$/i.test(next.name) || next.size === 0 || next.size > 10 * 1024 * 1024) {
      setError('请选择有效的 JPG、PNG、GIF 或 BMP 图片，大小不超过 10 MB。'); return;
    }
    setError(''); setFile(next);
  }
  async function save() {
    if (!canvas.current || !image || busy) return;
    setBusy(true); setError('');
    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.current!.toBlob(result => result ? resolve(result) : reject(new Error()), 'image/png'));
      await api.uploadMyAvatar(new File([blob], 'avatar.png', {type: 'image/png'})); await onSaved();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <ResourceDialog titleId="avatar-title" busy={busy} onCancel={onCancel}>
    <h2 id="avatar-title">修改头像</h2><p>选择图片后可拖动、缩放和旋转，预览将保存为 200 × 200 像素。</p>
    {error ? <p role="alert">{error}</p> : null}{loading ? <p role="status">正在读取图片…</p> : null}
    <label className="avatar-file">选择头像图片<NativeInput type="file" accept=".png,.jpg,.jpeg,.gif,.bmp" disabled={busy} onChange={event => choose(event.target.files?.[0])} /></label>
    <div className="avatar-crops"><canvas ref={canvas} aria-label="头像裁剪区域" role="img"
      onPointerDown={event => { if (!image || busy) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = {x: event.clientX, y: event.clientY, startX: crop.x, startY: crop.y}; }}
      onPointerMove={event => {
        if (!drag.current || !image || busy) return;
        const geometry = cropGeometry(image.naturalWidth, image.naturalHeight, crop);
        const ratio = 200 / event.currentTarget.getBoundingClientRect().width;
        const x = geometry.panX ? drag.current.startX + (event.clientX-drag.current.x)*ratio/geometry.panX*100 : 0;
        const y = geometry.panY ? drag.current.startY + (event.clientY-drag.current.y)*ratio/geometry.panY*100 : 0;
        setCrop(previous => ({...previous, x: Math.max(-100,Math.min(100,x)), y: Math.max(-100,Math.min(100,y))}));
      }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
      <div><p>头像预览</p><canvas ref={preview} aria-label="头像预览" role="img" className="avatar-round" /></div></div>
    <fieldset disabled={busy || !image} className="avatar-settings"><legend>裁剪设置</legend>
      <label>缩放<NativeInput type="range" min="1" max="3" step="0.1" value={crop.zoom} onChange={event => setCrop({...crop,zoom:Number(event.target.value)})} /></label>
      <label>水平位置<NativeInput type="range" min="-100" max="100" value={crop.x} onChange={event => setCrop({...crop,x:Number(event.target.value)})} /></label>
      <label>垂直位置<NativeInput type="range" min="-100" max="100" value={crop.y} onChange={event => setCrop({...crop,y:Number(event.target.value)})} /></label>
      <div className="post-row-actions"><Button label="向左旋转" onClick={() => setCrop({...crop,rotation:crop.rotation-90})} />
        <Button label="向右旋转" onClick={() => setCrop({...crop,rotation:crop.rotation+90})} /><Button label="重置裁剪" onClick={() => setCrop(initialCrop)} /></div>
    </fieldset><div className="post-row-actions"><Button label={busy ? '正在保存头像…' : '保存头像'} isDisabled={busy || !image || loading} onClick={() => { void save(); }} />
      <Button label="取消" variant="ghost" isDisabled={busy} onClick={onCancel} /></div>
  </ResourceDialog>;
}
