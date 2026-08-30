/**
 * Respaldo de la base de datos hacia Cloudinary.
 *
 * La idea es simple: Cloudinary ya sobrevivio a que se borrara el cluster de
 * Mongo, asi que es el lugar mas seguro que tenemos para dejar una copia. Este
 * script vuelca albums, photos y prompts a un JSON y lo sube como archivo raw.
 * Si Mongo se vuelve a perder, restaurar-backup.js lo devuelve todo tal cual.
 *
 * Uso como CLI:
 *   node backup.js            -> crea un respaldo nuevo
 *   node backup.js --lista    -> muestra los respaldos que hay en Cloudinary
 *
 * Tambien se usa como modulo desde server.js para el respaldo automatico.
 */
require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');

const CLOUD  = process.env.CLOUDINARY_CLOUD_NAME;
const KEY    = process.env.CLOUDINARY_API_KEY;
const SECRET = process.env.CLOUDINARY_API_SECRET;

// Cuantos respaldos guardamos en Cloudinary antes de borrar los mas viejos
const MAX_RESPALDOS = 30;

function auth() {
  return 'Basic ' + Buffer.from(KEY + ':' + SECRET).toString('base64');
}

/**
 * El nombre del cloud (dtofbkdzb) esta a la vista en el codigo del frontend,
 * asi que una carpeta llamada "backups" seria adivinable por cualquiera y los
 * respaldos traen captions y comentarios nuestros. Le metemos un sufijo
 * derivado del api_secret: es siempre el mismo (para poder restaurar) pero no
 * hay forma de calcularlo sin el secret.
 */
function carpetaRespaldos() {
  const sal = crypto.createHash('sha256').update(SECRET + '::backups').digest('hex').slice(0, 16);
  return 'backups-' + sal;
}

// Cloudinary firma con sha1 de los parametros ordenados alfabeticamente + el secret
function firmar(params) {
  const cadena = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha1').update(cadena + SECRET).digest('hex');
}

function revisarCredenciales() {
  if (!CLOUD || !KEY || !SECRET) {
    throw new Error('Faltan las credenciales de Cloudinary en el .env');
  }
}

// ── Lectura de la base ───────────────────────────────────────

/**
 * Se lee con el driver crudo en vez de los modelos de mongoose a proposito:
 * asi los documentos salen exactamente como estan guardados, incluidos los _id
 * y cualquier campo que el schema todavia no contemple.
 */
async function volcarColecciones() {
  const db = mongoose.connection.db;
  const datos = {};
  for (const nombre of ['albums', 'photos', 'prompts']) {
    datos[nombre] = await db.collection(nombre).find({}).toArray();
  }
  return datos;
}

// ── Cloudinary ───────────────────────────────────────────────

async function subirRespaldo(nombreArchivo, contenido) {
  const publicId = `${carpetaRespaldos()}/${nombreArchivo}`;
  const timestamp = Math.floor(Date.now() / 1000);

  const params = { invalidate: 'true', overwrite: 'true', public_id: publicId, timestamp };
  const form = new FormData();
  form.append('file', 'data:application/json;base64,' + Buffer.from(contenido).toString('base64'));
  form.append('public_id', publicId);
  form.append('timestamp', String(timestamp));
  form.append('api_key', KEY);
  form.append('overwrite', 'true');
  form.append('invalidate', 'true');
  form.append('signature', firmar(params));

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/raw/upload`, {
    method: 'POST', body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Cloudinary rechazo el respaldo: ' + (data.error?.message ?? res.status));
  return data.secure_url;
}

/** Devuelve los respaldos que hay en Cloudinary, del mas nuevo al mas viejo. */
async function listarRespaldos() {
  revisarCredenciales();
  const respaldos = [];
  let cursor = null;

  do {
    let url = `https://api.cloudinary.com/v1_1/${CLOUD}/resources/raw`
            + `?type=upload&prefix=${carpetaRespaldos()}&max_results=100`;
    if (cursor) url += `&next_cursor=${cursor}`;

    const res = await fetch(url, { headers: { Authorization: auth() } });
    const data = await res.json();
    if (!res.ok) throw new Error('No se pudo listar: ' + (data.error?.message ?? res.status));

    respaldos.push(...data.resources);
    cursor = data.next_cursor;
  } while (cursor);

  return respaldos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/** Borra los respaldos que pasan de MAX_RESPALDOS para no llenar la cuenta. */
async function limpiarViejos() {
  const respaldos = await listarRespaldos();
  const sobrantes = respaldos.slice(MAX_RESPALDOS);
  if (sobrantes.length === 0) return 0;

  const query = sobrantes.map(r => 'public_ids[]=' + encodeURIComponent(r.public_id)).join('&');
  await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/resources/raw/upload?${query}`, {
    method: 'DELETE', headers: { Authorization: auth() },
  });
  return sobrantes.length;
}

// ── Respaldo completo ────────────────────────────────────────

/**
 * Crea el respaldo. Asume que ya hay conexion a mongo abierta.
 * guardarLocal solo aplica cuando se corre desde la compu; en Vercel el disco
 * es de solo lectura, por eso viene apagado por defecto.
 */
async function crearBackup({ guardarLocal = false } = {}) {
  revisarCredenciales();

  const datos = await volcarColecciones();
  const respaldo = {
    creadoEn: new Date().toISOString(),
    base: mongoose.connection.name,
    conteos: Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, v.length])),
    datos,
  };
  const contenido = JSON.stringify(respaldo);

  // Un archivo por dia: si corre varias veces el mismo dia se sobrescribe,
  // que es justo lo que queremos para no llenar Cloudinary de copias iguales.
  const dia = new Date().toISOString().slice(0, 10);
  const nombreArchivo = `nuestro-museo-${dia}.json`;

  const url = await subirRespaldo(nombreArchivo, contenido);

  if (guardarLocal) {
    const carpeta = path.join(__dirname, 'backups');
    await fs.mkdir(carpeta, { recursive: true });
    await fs.writeFile(path.join(carpeta, nombreArchivo), contenido);
  }

  const borrados = await limpiarViejos();

  return { url, conteos: respaldo.conteos, archivo: nombreArchivo, borrados };
}

module.exports = { crearBackup, listarRespaldos, carpetaRespaldos };

// ── CLI ──────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    revisarCredenciales();

    if (process.argv.includes('--lista')) {
      const respaldos = await listarRespaldos();
      if (respaldos.length === 0) return console.log('Todavia no hay respaldos');
      console.log(`${respaldos.length} respaldos en Cloudinary:`);
      for (const r of respaldos) {
        const kb = (r.bytes / 1024).toFixed(1);
        console.log(`  ${r.created_at}  ${kb} KB  ${r.public_id}`);
      }
      return;
    }

    if (!process.env.MONGODB_URI) throw new Error('Falta MONGODB_URI en el .env');
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

    const r = await crearBackup({ guardarLocal: true });
    console.log('Respaldo listo:', r.archivo);
    console.log('Contenido:', r.conteos);
    console.log('Copia local en Backend/backups/');
    if (r.borrados) console.log(`Se borraron ${r.borrados} respaldos viejos`);

    await mongoose.disconnect();
  })().catch(err => {
    console.error('Fallo el respaldo:', err.message);
    process.exit(1);
  });
}
