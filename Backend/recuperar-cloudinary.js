/**
 * Recupera las fotos desde Cloudinary hacia la base de datos.
 *
 * Cloudinary fue lo unico que sobrevivio al borrado del cluster viejo, asi que
 * de cada foto solo se puede rescatar la imagen y su fecha de subida. Todo lo
 * demas (titulos, captions, lugares, ratings, comentarios) se perdio.
 *
 * Las fotos se reparten en un album por mes.
 *
 * Uso:
 *   1. Tener el MONGODB_URI del cluster en Backend/.env
 *   2. node recuperar-cloudinary.js
 *
 * Es idempotente: si una url ya existe en la base, no la vuelve a insertar.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { Album, Photo } = require('./models');

const CLOUD  = process.env.CLOUDINARY_CLOUD_NAME;
const KEY    = process.env.CLOUDINARY_API_KEY;
const SECRET = process.env.CLOUDINARY_API_SECRET;

const AUTH = 'Basic ' + Buffer.from(KEY + ':' + SECRET).toString('base64');

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Trae todas las imagenes de Cloudinary paginando de 500 en 500
async function traerImagenes() {
  const imagenes = [];
  let cursor = null;

  do {
    let url = `https://api.cloudinary.com/v1_1/${CLOUD}/resources/image?type=upload&max_results=500`;
    if (cursor) url += `&next_cursor=${cursor}`;

    const res = await fetch(url, { headers: { Authorization: AUTH } });
    if (!res.ok) throw new Error(`Cloudinary respondio ${res.status}: ${await res.text()}`);

    const data = await res.json();
    imagenes.push(...data.resources);
    cursor = data.next_cursor;
  } while (cursor);

  // Por si quedara algun archivo de demostracion de Cloudinary
  return imagenes.filter(img => !img.public_id.startsWith('samples/'));
}

// La fecha va como texto "YYYY-MM-DD" porque asi la guarda el resto de la app
function fechaCorta(iso) {
  return new Date(iso).toLocaleDateString('sv', { timeZone: 'America/Guatemala' });
}

// "2026-06" -> "Junio 2026"
function nombreDelMes(clave) {
  const [anio, mes] = clave.split('-');
  return `${MESES[Number(mes) - 1]} ${anio}`;
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Falta MONGODB_URI en el .env');

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  console.log('Conectado a la base:', mongoose.connection.name);

  const imagenes = await traerImagenes();
  console.log(`Cloudinary tiene ${imagenes.length} fotos`);

  // Agrupamos por mes segun la fecha de subida
  const porMes = {};
  for (const img of imagenes) {
    const clave = fechaCorta(img.created_at).slice(0, 7);
    (porMes[clave] ??= []).push(img);
  }

  // Las urls que ya estan en la base, para no duplicar si corro el script dos veces
  const yaExisten = new Set((await Photo.find({}, 'url')).map(p => p.url));

  let totalNuevas = 0;

  // De mes mas viejo a mas nuevo, asi los albums quedan en orden en la app
  for (const clave of Object.keys(porMes).sort()) {
    const titulo = nombreDelMes(clave);
    const fotosDelMes = porMes[clave].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    let album = await Album.findOne({ title: titulo });
    if (!album) {
      album = await Album.create({
        title: titulo,
        description: 'Fotos recuperadas de Cloudinary',
        covers: [],
        photoCount: 0,
        // El album se fecha con la primera foto del mes, no con el dia de hoy
        createdAt: new Date(porMes[clave][porMes[clave].length - 1].created_at),
      });
    }

    const nuevas = fotosDelMes
      .filter(img => !yaExisten.has(img.secure_url))
      .map(img => ({
        albumId: album._id,
        url:     img.secure_url,
        title:   '',
        caption: '',
        date:    fechaCorta(img.created_at),
        place:   { name: '', lat: null, lng: null },
        mood:    'enamorados',
        withWho: 'Solos los dos',
        rating:  5,
        tags:    [],
        author:  'dani',
        // Respetamos la fecha real de subida para que el orden quede como antes
        createdAt: new Date(img.created_at),
      }));

    if (nuevas.length > 0) await Photo.insertMany(nuevas);
    totalNuevas += nuevas.length;

    // Portadas: las 4 mas recientes del album
    const recientes = await Photo.find({ albumId: album._id }).sort({ createdAt: -1 }).limit(4);
    album.photoCount = await Photo.countDocuments({ albumId: album._id });
    album.covers = recientes.map(p => p.url);
    await album.save();

    console.log(`  ${titulo}: ${nuevas.length} importadas (${album.photoCount} en total)`);
  }

  console.log(totalNuevas === 0
    ? 'No habia fotos nuevas que importar, todo al dia'
    : `Listo: ${totalNuevas} fotos importadas en ${Object.keys(porMes).length} albums`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fallo la recuperacion:', err.message);
  process.exit(1);
});
