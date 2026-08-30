/**
 * Restaura la base de datos desde un respaldo hecho con backup.js.
 *
 * Uso:
 *   node restaurar-backup.js                      -> usa el respaldo mas reciente de Cloudinary
 *   node restaurar-backup.js --archivo ruta.json  -> usa una copia local
 *   node restaurar-backup.js --reemplazar         -> borra lo que haya antes de restaurar
 *
 * Por seguridad, si la base ya tiene datos se detiene y no toca nada, salvo que
 * le pases --reemplazar a proposito.
 */
require('dotenv').config();
const fs = require('fs/promises');
const mongoose = require('mongoose');
const { listarRespaldos } = require('./backup');

const COLECCIONES = ['albums', 'photos', 'movies', 'prompts'];

/**
 * Al pasar por JSON los ObjectId quedaron como texto y las fechas como ISO.
 * Hay que devolverlos a su tipo real, si no las relaciones entre album y fotos
 * se rompen (albumId de texto nunca hace match con el _id del album).
 */
const ES_OBJECT_ID = /^[0-9a-f]{24}$/;
const ES_FECHA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function rehidratar(valor, clave) {
  if (Array.isArray(valor)) return valor.map(v => rehidratar(v));

  if (valor && typeof valor === 'object') {
    const salida = {};
    for (const [k, v] of Object.entries(valor)) salida[k] = rehidratar(v, k);
    return salida;
  }

  if (typeof valor === 'string') {
    // Solo los campos que sabemos que son referencias, para no convertir por error
    // un caption que casualmente sea de 24 caracteres hexadecimales
    if ((clave === '_id' || clave === 'albumId') && ES_OBJECT_ID.test(valor)) {
      return new mongoose.Types.ObjectId(valor);
    }
    if (ES_FECHA_ISO.test(valor)) return new Date(valor);
  }

  return valor;
}

async function bajarRespaldoMasReciente() {
  const respaldos = await listarRespaldos();
  if (respaldos.length === 0) throw new Error('No hay respaldos en Cloudinary');

  const elegido = respaldos[0];
  console.log(`Usando el respaldo ${elegido.public_id} (${elegido.created_at})`);

  const res = await fetch(elegido.secure_url);
  if (!res.ok) throw new Error('No se pudo descargar el respaldo: ' + res.status);
  return res.json();
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Falta MONGODB_URI en el .env');

  const args = process.argv.slice(2);
  const reemplazar = args.includes('--reemplazar');
  const idxArchivo = args.indexOf('--archivo');

  const respaldo = idxArchivo !== -1
    ? JSON.parse(await fs.readFile(args[idxArchivo + 1], 'utf8'))
    : await bajarRespaldoMasReciente();

  console.log('Respaldo del', respaldo.creadoEn, '->', respaldo.conteos);

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;

  // Nos aseguramos de no pisar datos buenos sin querer
  if (!reemplazar) {
    for (const nombre of COLECCIONES) {
      const cuantos = await db.collection(nombre).countDocuments();
      if (cuantos > 0) {
        throw new Error(
          `La coleccion "${nombre}" ya tiene ${cuantos} documentos. ` +
          `Corre con --reemplazar si de verdad queres sobrescribir.`
        );
      }
    }
  }

  for (const nombre of COLECCIONES) {
    const documentos = (respaldo.datos[nombre] ?? []).map(d => rehidratar(d));
    if (reemplazar) await db.collection(nombre).deleteMany({});
    if (documentos.length > 0) await db.collection(nombre).insertMany(documentos);
    console.log(`  ${nombre}: ${documentos.length} restaurados`);
  }

  console.log('Restauracion terminada');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fallo la restauracion:', err.message);
  process.exit(1);
});
