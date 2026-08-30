/**
 * Junta todas las fotos en un solo album.
 *
 * Se uso para meter en "Dates" las fotos que se recuperaron de Cloudinary,
 * que habian quedado repartidas en un album por mes.
 *
 * Uso:
 *   node consolidar-album.js "Dates" --simular   -> muestra que haria
 *   node consolidar-album.js "Dates"             -> lo hace
 *
 * Los albums que quedan vacios por la mudanza se borran, porque ya no
 * sirven de nada. Un album que ya estaba vacio antes no se toca.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { Album, Photo } = require('./models');

const args = process.argv.slice(2);
const SIMULAR = args.includes('--simular');
const DESTINO = args.find(a => !a.startsWith('--'));

async function main() {
  if (!DESTINO) throw new Error('Deci a que album mover las fotos, por ejemplo: node consolidar-album.js "Dates"');
  if (!process.env.MONGODB_URI) throw new Error('Falta MONGODB_URI en el .env');

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  if (SIMULAR) console.log('=== MODO SIMULACION: no se modifica nada ===\n');

  const destino = await Album.findOne({ title: DESTINO });
  if (!destino) throw new Error(`No existe ningun album llamado "${DESTINO}"`);

  const fotos = await Photo.find();
  const aMover = fotos.filter(f => String(f.albumId) !== String(destino._id));

  console.log(`Album destino: "${destino.title}" (tiene ${fotos.length - aMover.length} fotos)`);
  console.log(`Fotos a mover: ${aMover.length}\n`);

  // Guardamos de que albums venian, para saber cuales quedan vacios despues
  const albumsOrigen = [...new Set(aMover.map(f => String(f.albumId)))];

  if (aMover.length > 0) {
    if (SIMULAR) {
      for (const id of albumsOrigen) {
        const a = await Album.findById(id);
        const cuantas = aMover.filter(f => String(f.albumId) === id).length;
        console.log(`  "${a?.title ?? id}": se moverian ${cuantas} fotos`);
      }
    } else {
      await Photo.updateMany(
        { _id: { $in: aMover.map(f => f._id) } },
        { $set: { albumId: destino._id } }
      );
      console.log(`Movidas ${aMover.length} fotos a "${destino.title}"`);
    }
  }

  // Los albums de origen quedan sin fotos: ya no tienen razon de existir
  for (const id of albumsOrigen) {
    const album = await Album.findById(id);
    if (!album) continue;
    const quedan = SIMULAR ? 0 : await Photo.countDocuments({ albumId: id });
    if (quedan === 0) {
      if (SIMULAR) console.log(`  se borraria el album vacio "${album.title}"`);
      else { await Album.findByIdAndDelete(id); console.log(`Borrado el album vacio "${album.title}"`); }
    }
  }

  if (!SIMULAR) {
    // Portada y contador del destino: las 4 fotos mas recientes
    const total = await Photo.countDocuments({ albumId: destino._id });
    const recientes = await Photo.find({ albumId: destino._id })
      .sort({ date: -1, createdAt: -1 }).limit(4);
    destino.photoCount = total;
    destino.covers = recientes.map(p => p.url);
    await destino.save();
    console.log(`\n"${destino.title}" quedo con ${total} fotos y ${destino.covers.length} portadas`);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fallo la consolidacion:', err.message);
  process.exit(1);
});
