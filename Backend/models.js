const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  by:    { type: String, enum: ['dani', 'marce'] },
  emoji: String,
}, { _id: false });

const commentSchema = new mongoose.Schema({
  by:   { type: String, enum: ['dani', 'marce'] },
  text: String,
  at:   { type: Date, default: Date.now },
}, { _id: false });

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
  title:     { type: String, default: '' },
  caption:   { type: String, default: '' },
  date:      { type: String, default: '' },
  place:     {
    name: { type: String, default: '' },
    lat:  { type: Number, default: null },
    lng:  { type: Number, default: null },
  },
  mood:      { type: String, default: 'enamorados' },
  withWho:   { type: String, default: 'Solos los dos' },
  rating:    { type: Number, default: 5 },
  tags:      [String],
  author:    { type: String, enum: ['dani', 'marce'], default: 'dani' },
  reactions: [reactionSchema],
  comments:  [commentSchema],
  createdAt: { type: Date, default: Date.now },
});

// Lista de pelis que queremos ver juntos. Cuando una se marca como vista
// pasa a la otra lista, con la fecha en que la vimos.
const movieSchema = new mongoose.Schema({
  title:     String,
  notes:     { type: String, default: '' },
  addedBy:   { type: String, enum: ['dani', 'marce'], default: 'dani' },
  watched:   { type: Boolean, default: false },
  watchedAt: { type: Date, default: null },
  rating:    { type: Number, default: null },
  createdAt: { type: Date, default: Date.now },
});

const promptSchema = new mongoose.Schema({
  text:      String,
  period:    { type: String, enum: ['daily', 'weekly'], default: 'daily' },
  active:    { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const Album  = mongoose.models.Album  || mongoose.model('Album',  albumSchema);
const Photo  = mongoose.models.Photo  || mongoose.model('Photo',  photoSchema);
const Movie  = mongoose.models.Movie  || mongoose.model('Movie',  movieSchema);
const Prompt = mongoose.models.Prompt || mongoose.model('Prompt', promptSchema);

module.exports = { Album, Photo, Movie, Prompt };
