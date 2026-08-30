require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');
const { Album, Photo, Movie, Prompt } = require('./models');
const { crearBackup } = require('./backup');

mongoose.connect(process.env.MONGODB_URI);

const app = express();
app.use(cors());
app.use(express.json());

const aw = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

// ── Auth ─────────────────────────────────────────────────────
// Endpoint temporal de diagnóstico — borrar después
app.get('/api/ping', (req, res) => {
  res.json({
    dani_set:  !!process.env.DANI_PASS,
    marche_set: !!process.env.MARCHE_PASS,
    jwt_set:   !!process.env.JWT_SECRET,
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = {
    dani:   (process.env.DANI_PASS   || '').trim(),
    marche: (process.env.MARCHE_PASS || '').trim(),
  };
  if (!users[username]) {
    return res.status(401).json({ error: 'Usuario no encontrado' });
  }
  if (password.trim() !== users[username]) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, username });
});

// ── Respaldo automatico ──────────────────────────────────────
// Lo dispara el cron de Vercel una vez al dia. Se declara antes del middleware
// de sesion porque el cron no tiene login: se identifica con CRON_SECRET.
app.get('/api/backup', aw(async (req, res) => {
  const secreto = process.env.CRON_SECRET;
  const enviado = (req.headers.authorization ?? '').replace('Bearer ', '').trim();
  if (!secreto || enviado !== secreto) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  // En Vercel el disco es de solo lectura, por eso el respaldo solo va a Cloudinary
  const resultado = await crearBackup();
  console.log('Respaldo automatico listo:', resultado.archivo, resultado.conteos);
  res.json({ ok: true, ...resultado });
}));

// Middleware: protege todas las rutas /api/* excepto /api/login
app.use('/api', (req, res, next) => {
  if (req.path === '/login') return next();
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
  try {
    jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Sesión expirada, vuelve a iniciar sesión' });
  }
});

function fmtAlbum(doc) {
  const o = doc.toObject();
  return {
    id: o._id.toString(), title: o.title, description: o.description,
    photoCount: o.photoCount, covers: o.covers, createdAt: o.createdAt.toISOString(),
  };
}

function fmtPhoto(doc) {
  const o = doc.toObject();
  return {
    id: o._id.toString(),
    albumId:   o.albumId?.toString(),
    url:       o.url,
    title:     o.title ?? '',
    caption:   o.caption ?? '',
    date:      o.date ?? '',
    place:     o.place ?? { name: '', lat: null, lng: null },
    mood:      o.mood ?? 'enamorados',
    withWho:   o.withWho ?? 'Solos los dos',
    rating:    o.rating ?? 5,
    tags:      o.tags ?? [],
    author:    o.author ?? 'dani',
    reactions: (o.reactions ?? []).map(r => ({ by: r.by, emoji: r.emoji })),
    comments:  (o.comments ?? []).map(c => ({ by: c.by, text: c.text, at: c.at.toISOString() })),
    createdAt: o.createdAt.toISOString(),
  };
}

function fmtPrompt(doc) {
  const o = doc.toObject();
  return { id: o._id.toString(), text: o.text, period: o.period, active: o.active };
}

// ── Albums ───────────────────────────────────────────────────
// Los albums se ordenan por movimiento: el que recibio una foto mas
// recientemente sale de primero (arriba a la izquierda en la pantalla)
app.get('/api/albums', aw(async (req, res) => {
  const albums = await Album.find();

  // Fecha de la ultima foto subida a cada album, en una sola consulta
  const ultimas = await Photo.aggregate([
    { $group: { _id: '$albumId', ultima: { $max: '$createdAt' } } },
  ]);
  const ultimaPorAlbum = new Map(ultimas.map(u => [String(u._id), u.ultima]));

  // Un album sin fotos todavia no tiene movimiento, asi que vale su fecha de
  // creacion; de lo contrario los recien creados quedarian hasta el final
  const movimiento = a => ultimaPorAlbum.get(String(a._id)) ?? a.createdAt;
  albums.sort((a, b) => movimiento(b) - movimiento(a));

  res.json(albums.map(fmtAlbum));
}));

app.post('/api/albums', aw(async (req, res) => {
  const { title, description, covers } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const album = await Album.create({ title, description, covers: Array.isArray(covers) ? covers : [] });
  res.json(fmtAlbum(album));
}));

app.delete('/api/albums/:id', aw(async (req, res) => {
  await Album.findByIdAndDelete(req.params.id);
  await Photo.deleteMany({ albumId: req.params.id });
  res.json({ ok: true });
}));

// ── Photos ───────────────────────────────────────────────────
app.delete('/api/photos/:id', aw(async (req, res) => {
  await Photo.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));


app.post('/api/photos', aw(async (req, res) => {
  const { albumId, url, title, caption, date, place, mood, withWho, rating, tags, author } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  const photo = await Photo.create({
    albumId, url,
    title:   title   ?? '',
    caption: caption ?? '',
    date:    date    ?? new Date().toLocaleDateString('sv', { timeZone: 'America/Guatemala' }),
    place:   place   ?? { name: '', lat: null, lng: null },
    mood:    mood    ?? 'enamorados',
    withWho: withWho ?? 'Solos los dos',
    rating:  rating  ?? 5,
    tags:    tags    ?? [],
    author:  author  ?? 'dani',
  });
  const album = await Album.findById(albumId);
  if (album) {
    album.photoCount++;
    if (album.covers.length < 4) album.covers.push(url);
    await album.save();
  }
  res.json(fmtPhoto(photo));
}));

app.get('/api/albums/:id/photos', aw(async (req, res) => {
  const photos = await Photo.find({ albumId: req.params.id }).sort({ date: -1, createdAt: -1 });
  res.json(photos.map(fmtPhoto));
}));

app.patch('/api/photos/:id/caption', aw(async (req, res) => {
  const photo = await Photo.findByIdAndUpdate(
    req.params.id, { caption: req.body.caption ?? '' }, { new: true }
  );
  if (!photo) return res.status(404).json({ error: 'not found' });
  res.json(fmtPhoto(photo));
}));

app.patch('/api/photos/:id', aw(async (req, res) => {
  const { title, caption, mood, rating, tags, place, withWho } = req.body;
  const update = {};
  if (title   !== undefined) update.title   = title;
  if (caption !== undefined) update.caption = caption;
  if (mood    !== undefined) update.mood    = mood;
  if (rating  !== undefined) update.rating  = rating;
  if (tags    !== undefined) update.tags    = tags;
  if (place   !== undefined) update.place   = place;
  if (withWho !== undefined) update.withWho = withWho;
  const photo = await Photo.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!photo) return res.status(404).json({ error: 'not found' });
  res.json(fmtPhoto(photo));
}));

app.post('/api/photos/:id/react', aw(async (req, res) => {
  const { by, emoji } = req.body;
  const photo = await Photo.findById(req.params.id);
  if (!photo) return res.status(404).json({ error: 'not found' });
  photo.reactions = photo.reactions.filter(r => r.by !== by);
  if (emoji) photo.reactions.push({ by, emoji });
  await photo.save();
  res.json(fmtPhoto(photo));
}));

app.post('/api/photos/:id/comment', aw(async (req, res) => {
  const { by, text } = req.body;
  const photo = await Photo.findById(req.params.id);
  if (!photo) return res.status(404).json({ error: 'not found' });
  photo.comments.push({ by, text, at: new Date() });
  await photo.save();
  res.json(fmtPhoto(photo));
}));

app.get('/api/photos', aw(async (req, res) => {
  const photos = await Photo.find().sort({ createdAt: -1 });
  res.json(photos.map(fmtPhoto));
}));

app.get('/api/photos/recent', aw(async (req, res) => {
  const photos = await Photo.find().sort({ createdAt: -1 }).limit(12);
  res.json(photos.map(fmtPhoto));
}));


// ── Pelis ────────────────────────────────────────────────────
function fmtMovie(doc) {
  const o = doc.toObject();
  return {
    id:        o._id.toString(),
    title:     o.title,
    notes:     o.notes ?? '',
    addedBy:   o.addedBy ?? 'dani',
    watched:   !!o.watched,
    watchedAt: o.watchedAt ? o.watchedAt.toISOString() : null,
    rating:    o.rating ?? null,
    createdAt: o.createdAt.toISOString(),
  };
}

app.get('/api/movies', aw(async (req, res) => {
  const movies = await Movie.find().sort({ createdAt: -1 });
  res.json(movies.map(fmtMovie));
}));

app.post('/api/movies', aw(async (req, res) => {
  const { title, notes, addedBy } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title required' });
  const movie = await Movie.create({
    title:   title.trim(),
    notes:   notes?.trim() ?? '',
    addedBy: addedBy ?? 'dani',
  });
  res.json(fmtMovie(movie));
}));

app.patch('/api/movies/:id', aw(async (req, res) => {
  const { title, notes, watched, rating } = req.body;
  const update = {};
  if (title  !== undefined) update.title  = title.trim();
  if (notes  !== undefined) update.notes  = notes;
  if (rating !== undefined) update.rating = rating;
  // Marcarla como vista deja constancia de cuando la vimos; desmarcarla la borra
  if (watched !== undefined) {
    update.watched   = !!watched;
    update.watchedAt = watched ? new Date() : null;
    if (!watched) update.rating = null;
  }
  const movie = await Movie.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!movie) return res.status(404).json({ error: 'not found' });
  res.json(fmtMovie(movie));
}));

app.delete('/api/movies/:id', aw(async (req, res) => {
  await Movie.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

// ── Prompts ──────────────────────────────────────────────────
app.get('/api/prompts', aw(async (req, res) => {
  const prompts = await Prompt.find({ active: true }).sort({ createdAt: -1 });
  res.json(prompts.map(fmtPrompt));
}));


// Global error handler — catches any error thrown in aw() wrapped routes
app.use((err, req, res, _next) => {
  console.error(`[${req.method} ${req.path}]`, err.message ?? err);
  res.status(500).json({ error: err.message ?? 'server error' });
});

async function seedPrompts() {
  await Prompt.deleteMany({});
  await Prompt.insertMany([
    { text: 'Una foto de algo que hoy te recordó a mí',        period: 'daily',  active: true },
    { text: 'Tu momento favorito de hoy',                      period: 'daily',  active: true },
    { text: 'Una foto de mi bb',                               period: 'daily',  active: true },
    { text: 'Una foto de nosotros dos',                        period: 'weekly', active: true },
    { text: 'El cielo, ahorita estes donde estes',             period: 'daily',  active: true },
    { text: 'Algo que te hizo reír esta semana',               period: 'weekly', active: true },
    { text: 'Un detalle bonito que viste hoy',                 period: 'daily',  active: true },
    { text: 'Una foto de tu lugar favorito juntos',            period: 'weekly', active: true },
  ]);
  console.log('Prompts actualizados');
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, async () => {
    console.log(`Backend corriendo en puerto ${PORT}`);
    await seedPrompts();
  });
}

module.exports = app;
