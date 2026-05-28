require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Album, Photo } = require('../Backend/models');

let dbConnected = false;
async function connectDB() {
  if (dbConnected) return;
  await mongoose.connect(process.env.MONGODB_URI);
  dbConnected = true;
}

const app = express();
app.use(cors());
app.use(express.json());

app.use(async (req, res, next) => {
  try { await connectDB(); next(); }
  catch (e) { res.status(500).json({ error: 'db connection failed' }); }
});

function fmtAlbum(doc) {
  const o = doc.toObject();
  return { id: o._id.toString(), title: o.title, description: o.description,
           photoCount: o.photoCount, covers: o.covers, createdAt: o.createdAt.toISOString() };
}
function fmtPhoto(doc) {
  const o = doc.toObject();
  return { id: o._id.toString(), albumId: o.albumId?.toString(),
           url: o.url, createdAt: o.createdAt.toISOString() };
}

// ── Albums ───────────────────────────────────────────────────
app.get('/api/albums', async (req, res) => {
  const albums = await Album.find().sort({ createdAt: 1 });
  res.json(albums.map(fmtAlbum));
});

app.post('/api/albums', async (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const album = await Album.create({ title, description });
  res.json(fmtAlbum(album));
});

app.delete('/api/albums/:id', async (req, res) => {
  await Album.findByIdAndDelete(req.params.id);
  await Photo.deleteMany({ albumId: req.params.id });
  res.json({ ok: true });
});

// ── Photos ───────────────────────────────────────────────────
// La foto ya fue subida a Cloudinary desde el frontend; aquí solo guardamos la URL.
app.post('/api/photos', async (req, res) => {
  const { albumId, url } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  const photo = await Photo.create({ albumId, url });
  const album = await Album.findById(albumId);
  if (album) {
    album.photoCount++;
    if (album.covers.length < 4) album.covers.push(url);
    await album.save();
  }
  res.json(fmtPhoto(photo));
});

app.get('/api/photos/recent', async (req, res) => {
  const photos = await Photo.find().sort({ createdAt: -1 }).limit(12);
  res.json(photos.map(fmtPhoto));
});

module.exports = app;
