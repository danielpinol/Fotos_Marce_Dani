require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
const { Album, Photo, Capsule, Prompt } = require('./models');

mongoose.connect(process.env.MONGODB_URI);

const app = express();
app.use(cors());
app.use(express.json());

// Wrap async handlers so any thrown error goes to the global error handler
const aw = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

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

function fmtCapsule(doc) {
  const o = doc.toObject();
  return {
    id: o._id.toString(), title: o.title, note: o.note,
    unlock: o.unlock, tone: o.tone, by: o.by, createdAt: o.createdAt.toISOString(),
  };
}

function fmtPrompt(doc) {
  const o = doc.toObject();
  return { id: o._id.toString(), text: o.text, period: o.period, active: o.active };
}

// ── Albums ───────────────────────────────────────────────────
app.get('/api/albums', aw(async (req, res) => {
  const albums = await Album.find().sort({ createdAt: 1 });
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
app.post('/api/photos', aw(async (req, res) => {
  const { albumId, url, title, caption, date, place, mood, withWho, rating, tags, author } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  const photo = await Photo.create({
    albumId, url,
    title:   title   ?? '',
    caption: caption ?? '',
    date:    date    ?? new Date().toISOString().slice(0, 10),
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
  const photos = await Photo.find({ albumId: req.params.id }).sort({ createdAt: 1 });
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

// ── Capsules ─────────────────────────────────────────────────
app.get('/api/capsules', aw(async (req, res) => {
  const capsules = await Capsule.find().sort({ createdAt: 1 });
  res.json(capsules.map(fmtCapsule));
}));

app.post('/api/capsules', aw(async (req, res) => {
  const { title, note, unlock, tone, by } = req.body;
  const capsule = await Capsule.create({ title, note, unlock, tone: tone ?? 0, by });
  res.json(fmtCapsule(capsule));
}));

app.delete('/api/capsules/:id', aw(async (req, res) => {
  await Capsule.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

// ── Prompts ──────────────────────────────────────────────────
app.get('/api/prompts', aw(async (req, res) => {
  const prompts = await Prompt.find({ active: true }).sort({ createdAt: -1 });
  res.json(prompts.map(fmtPrompt));
}));

app.post('/api/prompts/seed', aw(async (req, res) => {
  const count = await Prompt.countDocuments();
  if (count > 0) return res.json({ seeded: false });
  await Prompt.insertMany([
    { text: 'Una foto de algo que hoy te recordó a mí',        period: 'daily'  },
    { text: 'Tu momento favorito de hoy, sin pensarlo mucho',  period: 'daily'  },
    { text: 'Una foto de algo rojo 🍎',                        period: 'daily'  },
    { text: 'Una espontánea de ustedes dos, ya',               period: 'weekly' },
    { text: 'El cielo, justo ahora, desde donde estás',        period: 'daily'  },
    { text: 'Algo que te hizo reír esta semana',               period: 'weekly' },
    { text: 'Un detalle bonito que notaste hoy',               period: 'daily'  },
    { text: 'Una foto de tu lugar favorito juntos',            period: 'weekly' },
  ]);
  res.json({ seeded: true });
}));

// Global error handler — catches any error thrown in aw() wrapped routes
app.use((err, req, res, _next) => {
  console.error(`[${req.method} ${req.path}]`, err.message ?? err);
  res.status(500).json({ error: err.message ?? 'server error' });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Backend corriendo en puerto ${PORT}`));
}

module.exports = app;
