require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { Album, Photo } = require('../Backend/models');

// ── DB connection (cached between warm invocations) ──────────
let dbConnected = false;
async function connectDB() {
  if (dbConnected) return;
  await mongoose.connect(process.env.MONGODB_URI);
  dbConnected = true;
}

// ── Cloudinary ───────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'nuestro-museo',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
    transformation: [{ width: 1200, crop: 'limit', quality: 'auto:good' }],
  },
});
const upload = multer({ storage });

// ── Express app ──────────────────────────────────────────────
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
app.post('/api/photos', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const url = req.file.path;
  const photo = await Photo.create({ albumId: req.body.albumId, url });
  const album = await Album.findById(req.body.albumId);
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
module.exports.config = { api: { bodyParser: false } };
