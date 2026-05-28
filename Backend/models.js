const mongoose = require('mongoose');

const albumSchema = new mongoose.Schema({
  title:       String,
  description: { type: String, default: '' },
  photoCount:  { type: Number, default: 0 },
  covers:      [String],
  createdAt:   { type: Date, default: Date.now },
});

const photoSchema = new mongoose.Schema({
  albumId:   mongoose.Schema.Types.ObjectId,
  url:       String,
  createdAt: { type: Date, default: Date.now },
});

const Album = mongoose.models.Album || mongoose.model('Album', albumSchema);
const Photo = mongoose.models.Photo || mongoose.model('Photo', photoSchema);

module.exports = { Album, Photo };
