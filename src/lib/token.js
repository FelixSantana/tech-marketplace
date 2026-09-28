// El token de admin lleva su fecha de caducidad escrita dentro, en claro: es
// `<cuerpo en base64url>.<firma>`, y el cuerpo es un JSON con { email, exp }.
//
// Leerla en el navegador NO es validar el token —eso solo lo puede hacer el
// servidor, que es quien tiene el secreto de la firma— pero sirve para no
// arrastrar una sesion que ya sabemos muerta. Sin esto, el panel abria con un
// token vencido y se comportaba con normalidad hasta que alguna accion fallaba:
// el dueño creia tener sesion, y el boton de copiar el token entregaba uno que
// el servidor ya rechazaba.
export function datosDelToken(token) {
  const t = String(token || '');
  const corte = t.indexOf('.');
  if (corte <= 0) return null;
  try {
    const cuerpo = t.slice(0, corte).replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(cuerpo));
    return json && typeof json === 'object' ? json : null;
  } catch { return null; }
}

// Vencido solo cuando podemos demostrarlo. Un token que no se deja leer se deja
// pasar y que decida el servidor: mas vale una llamada rechazada que echar a
// alguien de su propio panel por un formato que no supimos interpretar.
export function tokenVencido(token, ahora = Date.now()) {
  const datos = datosDelToken(token);
  const exp = datos && Number(datos.exp);
  return Number.isFinite(exp) && exp <= ahora;
}

// Cuanto le queda, para avisar antes de que se caiga a mitad de un trabajo.
export function diasQueLeQuedan(token, ahora = Date.now()) {
  const datos = datosDelToken(token);
  const exp = datos && Number(datos.exp);
  if (!Number.isFinite(exp)) return null;
  return Math.max(0, Math.ceil((exp - ahora) / 86400000));
}
