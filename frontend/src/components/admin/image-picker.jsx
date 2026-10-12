import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { prepareGalleryImage } from '@/lib/gallery-image';

export function ImagePicker({ value, onChange, onBusyChange, disabled }) {
  const id = useId();
  const input = useRef(null);
  const version = useRef(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { version.current += 1; }, []);
  async function selectFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const current = ++version.current;
    setBusy(true);
    onBusyChange(true);
    try {
      const data = await prepareGalleryImage(file);
      if (version.current === current) onChange(data);
    } catch (error) {
      if (version.current === current) toast.error(error.message || 'Rasmni ochib bo‘lmadi.');
    } finally {
      if (version.current === current) {
        setBusy(false);
        onBusyChange(false);
      }
    }
  }
  return <div className="grid gap-2">
    <Label htmlFor={id}>Rasm</Label>
    <input id={id} ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy || disabled} onChange={selectFile} />
    {value ? <img src={value} alt="Tanlangan rasm" className="h-36 w-full rounded-md border border-input object-contain" /> : null}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={busy || disabled} onClick={() => input.current?.click()}>
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        {busy ? 'Tayyorlanmoqda…' : 'Galereyadan tanlash'}
      </Button>
      {value ? <Button type="button" variant="ghost" size="icon" title="Rasmni olib tashlash" aria-label="Rasmni olib tashlash" disabled={busy || disabled} onClick={() => onChange('')}><Trash2 className="size-4" /></Button> : null}
    </div>
    <Input aria-label="Rasm URL (ixtiyoriy)" type="url" value={value?.startsWith('data:') ? '' : value || ''} placeholder="https://..." disabled={busy || disabled} onChange={event => onChange(event.target.value)} />
  </div>;
}
