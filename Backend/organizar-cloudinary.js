/**
 * Ordena la cuenta de Cloudinary antes de importar las fotos a la base.
 *
 * Hace dos cosas:
 *   1. Borra el contenido de demostracion que Cloudinary crea solo (samples/),
 *      que no es nuestro y ocupa cuota.
 *   2. Mueve nuestras fotos a la carpeta DACE/ y les pone nombre por fecha,
 *      para que se puedan ojear en orden desde el panel de Cloudinary.
 *
 * Se corre ANTES de recuperar-cloudinary.js, porque renombrar cambia la URL
 * de cada foto y si la base ya las tuviera guardadas quedarian rotas.
 *
 * Uso:
 *   node organizar-cloudinary.js --simular   -> muestra que haria, sin tocar nada
 *   node organizar-cloudinary.js             -> lo hace de verdad
 */
require('dotenv').config();
const crypto = require('crypto');

const CLOUD  = process.env.CLOUDINARY_CLOUD_NAME;
const KEY    = process.env.CLOUDINARY_API_KEY;
const SECRET = process.env.CLOUDINARY_API_SECRET;

const CARPETA = 'DACE';
const SIMULAR = process.argv.includes('--simular');

const AUTH = 'Basic ' + Buffer.from(KEY + ':' + SECRET).toString('base64');

function firmar(params) {
  const cadena = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha1').update(cadena + SECRET).digest('hex');
}

async function listar(tipoRecurso) {
  const todas = [];
  let cursor = null;
  do {
    let url = `https://api.cloudinary.com/v1_1/${CLOUD}/resources/${tipoRecurso}`
            + `?type=upload&max_results=500` + (cursor ? `&next_cursor=${cursor}` : '');
    const res = await fetch(url, { headers: { Authorization: AUTH } });
    const data = await res.json();
    if (!res.ok) throw new Error('No se pudo listar: ' + (data.error?.message ?? res.status));
    todas.push(...(data.resources ?? []));
    cursor = data.next_cursor;
  } while (cursor);
  return todas;
}

async function borrar(tipoRecurso, publicIds) {
  // La API acepta 100 por llamada
  for (let i = 0; i < publicIds.length; i += 100) {
    const lote = publicIds.slice(i, i + 100);
    const query = lote.map(id => 'public_ids[]=' + encodeURIComponent(id)).join('&');
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD}/resources/${tipoRecurso}/upload?${query}`,
      { method: 'DELETE', headers: { Authorization: AUTH } }
    );
    if (!res.ok) throw new Error('Fallo al borrar: ' + res.status);
  }
}

async function renombrar(desde, hacia) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { from_public_id: desde, timestamp, to_public_id: hacia };

  const form = new FormData();
  form.append('from_public_id', desde);
  form.append('to_public_id', hacia);
  form.append('timestamp', String(timestamp));
  form.append('api_key', KEY);
  form.append('signature', firmar(params));

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/rename`, {
    method: 'POST', body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`No se pudo renombrar ${desde}: ${data.error?.message ?? res.status}`);
  return data.secure_url;
}

// Las fotos se guardan con la fecha de Guatemala, que es como las ve el usuario
function fechaCorta(iso) {
  return new Date(iso).toLocaleDateString('sv', { timeZone: 'America/Guatemala' });
}

async function main() {
  if (!CLOUD || !KEY || !SECRET) throw new Error('Faltan las credenciales de Cloudinary en el .env');
  if (SIMULAR) console.log('=== MODO SIMULACION: no se va a modificar nada ===\n');

  const imagenes = await listar('image');
  const videos   = await listar('video');

  const demos    = [...imagenes, ...videos].filter(r => r.public_id.startsWith('samples/'));
  const mias     = imagenes.filter(r => !r.public_id.startsWith('samples/'));

  const pesoDemos = demos.reduce((suma, r) => suma + r.bytes, 0);
  console.log(`Contenido de demostracion: ${demos.length} archivos (${(pesoDemos / 1048576).toFixed(1)} MB)`);
  console.log(`Fotos tuyas: ${mias.length}\n`);

  // ── 1. Borrar los demos ────────────────────────────────────
  if (demos.length > 0) {
    if (SIMULAR) {
      console.log(`Se borrarian ${demos.length} archivos de demostracion`);
    } else {
      await borrar('image', demos.filter(r => r.resource_type === 'image').map(r => r.public_id));
      await borrar('video', demos.filter(r => r.resource_type === 'video').map(r => r.public_id));
      console.log(`Borrados ${demos.length} archivos de demostracion`);
    }
  }

  // ── 2. Mover las fotos a DACE/ con nombre por fecha ────────
  // Las ordenamos de la mas vieja a la mas nueva para que el numero
  // correlativo dentro de cada dia siga el orden en que se tomaron
  mias.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const contadorPorDia = {};
  let movidas = 0, yaEstaban = 0;

  for (const foto of mias) {
    if (foto.public_id.startsWith(CARPETA + '/')) { yaEstaban++; continue; }

    const dia = fechaCorta(foto.created_at);
    contadorPorDia[dia] = (contadorPorDia[dia] ?? 0) + 1;
    const numero = String(contadorPorDia[dia]).padStart(2, '0');
    const nuevoNombre = `${CARPETA}/${dia}_${numero}`;

    if (SIMULAR) {
      console.log(`  ${foto.public_id}  ->  ${nuevoNombre}`);
    } else {
      await renombrar(foto.public_id, nuevoNombre);
    }
    movidas++;
  }

  console.log(SIMULAR
    ? `\nSe moverian ${movidas} fotos a ${CARPETA}/`
    : `\nMovidas ${movidas} fotos a ${CARPETA}/`);
  if (yaEstaban) console.log(`${yaEstaban} ya estaban en la carpeta, no se tocaron`);

  if (!SIMULAR) console.log('\nListo. Ahora corre: node recuperar-cloudinary.js');
}

main().catch(err => {
  console.error('Fallo la organizacion:', err.message);
  process.exit(1);
});
