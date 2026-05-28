const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(__dirname, 'db.json');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { albums: [], photos: [] }; }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.use('/uploads', express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ── Albums ───────────────────────────────────────────────
app.get('/api/albums', (req, res) => {
  res.json(readDB().albums);
});

app.post('/api/albums', (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const db = readDB();
  const album = {
    id: String(Date.now()),
    title,
    description: description || '',
    photoCount: 0,
    createdAt: new Date().toISOString(),
    covers: [],
  };
  db.albums.push(album);
  writeDB(db);
  res.json(album);
});

app.delete('/api/albums/:id', (req, res) => {
  const db = readDB();
  db.albums = db.albums.filter(a => String(a.id) !== req.params.id);
  db.photos = db.photos.filter(p => String(p.albumId) !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

// ── Photos ───────────────────────────────────────────────
app.post('/api/photos', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const db = readDB();
  const albumId = req.body.albumId;
  const photo = {
    id: String(Date.now()),
    albumId,
    url: `/uploads/${req.file.filename}`,
    createdAt: new Date().toISOString(),
  };
  db.photos.push(photo);
  const album = db.albums.find(a => a.id === albumId);
  if (album) {
    album.photoCount++;
    if (album.covers.length < 4) album.covers.push(photo.url);
  }
  writeDB(db);
  res.json(photo);
});

app.get('/api/photos/recent', (req, res) => {
  const db = readDB();
  res.json([...db.photos].reverse().slice(0, 12));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend corriendo en puerto ${PORT}`));
