import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of, switchMap } from 'rxjs';

export interface Album {
  id: string;
  title: string;
  description: string;
  photoCount: number;
  createdAt: string;
  covers: string[];
}

export interface Reaction {
  by: 'dani' | 'marce';
  emoji: string;
}

export interface Comment {
  by: 'dani' | 'marce';
  text: string;
  at: string;
}

export interface Place {
  name: string;
  lat: number | null;
  lng: number | null;
}

export interface Photo {
  id: string;
  albumId: string;
  url: string;
  resourceType: 'image' | 'video';
  title: string;
  caption: string;
  date: string;
  place: Place;
  mood: string;
  withWho: string;
  rating: number;
  tags: string[];
  author: 'dani' | 'marce';
  reactions: Reaction[];
  comments: Comment[];
  createdAt: string;
}

export interface Prompt {
  id: string;
  text: string;
  period: 'daily' | 'weekly';
  active: boolean;
}

const API = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? '' : 'http://localhost:3000';

const CLOUDINARY_CLOUD  = 'dtofbkdzb';
const CLOUDINARY_PRESET = 'nuestro_museo';

// El thumbnail de un video en Cloudinary es la misma URL con la extensión
// cambiada a .jpg — no hace falta subir ni procesar nada aparte. Se usa en
// toda vista de miniatura (grids, portadas, recap) para no intentar
// dibujar un video adentro de un <img>.
export function toThumbnailUrl(photo: Pick<Photo, 'url' | 'resourceType'>): string {
  return photo.resourceType === 'video' ? photo.url.replace(/\.[a-zA-Z0-9]+$/, '.jpg') : photo.url;
}

// Para la vista real de un recuerdo (no el thumbnail): sin este parámetro,
// Cloudinary entrega el archivo con la calidad que decida la cuenta — si
// tiene activada la optimización automática de ancho de banda (común en el
// plan gratis), eso baja la resolución sin avisar, tanto en foto como en
// video. q_auto:best fuerza la mejor calidad que el formato permita,
// calculada por Cloudinary — no es el archivo crudo, pero es la más alta
// que sirve sin disparar el peso de forma desproporcionada.
export function toPlaybackUrl(photo: { url: string }): string {
  return photo.url.replace('/upload/', '/upload/q_auto:best/');
}

// Para las fotos "vitrina" que siguen siendo <img> aunque el recuerdo sea
// video — la pieza destacada de Home, el recap de Nosotros — y por eso
// nunca pueden terminar apuntando al archivo de video. Primero resuelve
// al thumbnail (si es video, el .jpg que genera Cloudinary solo) y recién
// después le pide la mejor calidad a ese resultado, para que tampoco el
// fotograma salga comprimido de más.
export function toHqThumbnailUrl(photo: Pick<Photo, 'url' | 'resourceType'>): string {
  return toPlaybackUrl({ url: toThumbnailUrl(photo) });
}

@Injectable({ providedIn: 'root' })
export class PhotoService {
  private readonly http = inject(HttpClient);

  getAlbums() {
    return this.http.get<Album[]>(`${API}/api/albums`).pipe(catchError(() => of([] as Album[])));
  }

  createAlbum(title: string, description: string, covers: string[] = []) {
    return this.http.post<Album>(`${API}/api/albums`, { title, description, covers });
  }

  uploadToCloudinary(file: File) {
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', CLOUDINARY_PRESET);
    return this.http
      .post<{ secure_url: string }>(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, form)
      .pipe(map(r => r.secure_url));
  }

  deleteAlbum(id: string) {
    return this.http.delete(`${API}/api/albums/${id}`);
  }

  deletePhoto(id: string) {
    return this.http.delete(`${API}/api/photos/${id}`);
  }

  uploadPhoto(albumId: string, file: File, metadata: Partial<Omit<Photo, 'id' | 'url' | 'resourceType' | 'albumId' | 'createdAt' | 'reactions' | 'comments'>> = {}) {
    const cloudForm = new FormData();
    cloudForm.append('file', file);
    cloudForm.append('upload_preset', CLOUDINARY_PRESET);
    return this.http
      .post<{ secure_url: string; resource_type: string }>(
        // /auto/upload deja que Cloudinary detecte solo si es imagen o
        // video — mismo preset unsigned, mismo flujo de dos pasos.
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`,
        cloudForm,
      )
      .pipe(
        switchMap(({ secure_url, resource_type }) =>
          this.http.post<Photo>(`${API}/api/photos`, {
            albumId,
            url: secure_url,
            resourceType: resource_type === 'video' ? 'video' : 'image',
            ...metadata,
          }),
        ),
      );
  }

  getAlbumPhotos(albumId: string) {
    return this.http.get<Photo[]>(`${API}/api/albums/${albumId}/photos`).pipe(
      catchError(() => of([] as Photo[])),
    );
  }

  updateCaption(photoId: string, caption: string) {
    return this.http.patch<Photo>(`${API}/api/photos/${photoId}/caption`, { caption });
  }

  updatePhoto(photoId: string, data: Partial<Pick<Photo, 'title' | 'caption' | 'mood' | 'rating' | 'tags' | 'place' | 'withWho'>>) {
    return this.http.patch<Photo>(`${API}/api/photos/${photoId}`, data);
  }

  addReaction(photoId: string, by: string, emoji: string | null) {
    return this.http.post<Photo>(`${API}/api/photos/${photoId}/react`, { by, emoji });
  }

  addComment(photoId: string, by: string, text: string) {
    return this.http.post<Photo>(`${API}/api/photos/${photoId}/comment`, { by, text });
  }

  getAllPhotos() {
    return this.http.get<Photo[]>(`${API}/api/photos`).pipe(catchError(() => of([] as Photo[])));
  }

  getRecentPhotos() {
    return this.http.get<Photo[]>(`${API}/api/photos/recent`).pipe(
      map(photos => photos.map(p => ({ ...p }))),
      catchError(() => of([] as Photo[])),
    );
  }

  getPrompts() {
    return this.http.get<Prompt[]>(`${API}/api/prompts`).pipe(catchError(() => of([] as Prompt[])));
  }

  seedPrompts() {
    return this.http.post<{ seeded: boolean }>(`${API}/api/prompts/seed`, {}).pipe(catchError(() => of({ seeded: false })));
  }
}
