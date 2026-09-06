// Sube una foto ya comprimida al bucket y devuelve su URL.
//
// Si el bucket no esta configurado, o la subida falla, devuelve la propia imagen incrustada
// para que el panel siga funcionando exactamente como antes. Es lo que hace que desplegar
// esto sin haber creado todavia el bucket no rompa nada.
const ERRORES_DE_IMAGEN = new Set(['INVALID_IMAGE', 'UNSUPPORTED_IMAGE_TYPE', 'IMAGE_TOO_LARGE']);

export async function uploadImage(dataUrl, adminToken, prefix = 'productos') {
  if (!dataUrl || !dataUrl.startsWith('data:')) return { url: dataUrl, incrustada: true };
  try {
    const r = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ dataUrl, prefix }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data.url) return { url: data.url, incrustada: false };
    // Solo estos tres son culpa de la imagen y no tiene sentido reintentarlos: hay que
    // decirselo al usuario. Un 400 tambien puede ser NOT_SETUP, que no es culpa de la foto.
    if (ERRORES_DE_IMAGEN.has(data.error)) return { error: data.message || 'No se pudo procesar la imagen.' };
    // 503 sin bucket, 401 sesion vencida, o cualquier otro fallo: se incrusta y se sigue.
    return { url: dataUrl, incrustada: true };
  } catch {
    return { url: dataUrl, incrustada: true };
  }
}

// Las fotos viejas viven dentro del JSON del catalogo; las nuevas son URLs del bucket.
export const esIncrustada = (src) => typeof src === 'string' && src.startsWith('data:');
