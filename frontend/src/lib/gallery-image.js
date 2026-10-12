// Keep the full JSON request below Express's unchanged default 100 KB limit.
export const MAX_IMAGE_LENGTH = 60000;
export async function prepareGalleryImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('JPG, PNG yoki WebP rasm tanlang. HEIC rasmini JPG ga aylantiring.');
  }
  if (file.size > 20 * 1024 * 1024) throw new Error('Rasm 20 MB dan kichik bo‘lishi kerak.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Rasmni tayyorlab bo‘lmadi.');
    for (const edge of [1024, 800, 640, 480, 320]) {
      const ratio = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      ctx.fillStyle = '#ffffff'; // JPEG transparency flattening, not UI styling.
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.65, 0.48, 0.32]) {
        const data = canvas.toDataURL('image/jpeg', quality);
        if (data.startsWith('data:image/jpeg;base64,') && data.length <= MAX_IMAGE_LENGTH) return data;
      }
    }
    throw new Error('Rasm juda katta. Boshqa rasm tanlang.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
