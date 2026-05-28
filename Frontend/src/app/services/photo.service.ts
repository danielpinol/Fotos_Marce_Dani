import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';

export interface Album {
  id: string;
  title: string;
  description: string;
  photoCount: number;
  createdAt: string;
  covers: string[];
}

export interface Photo {
  id: string;
  albumId: string;
  url: string;
  createdAt: string;
}

// En Vercel las rutas son relativas al mismo dominio.
// En localhost apunta al backend local.
const API = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? ''
  : 'http://localhost:3000';

// Cloudinary URLs ya son absolutas; URLs locales (/uploads/...) necesitan el prefijo.
function absUrl(path: string): string {
  return path.startsWith('http') ? path : `${API}${path}`;
}

@Injectable({ providedIn: 'root' })
export class PhotoService {
  private readonly http = inject(HttpClient);

  getAlbums() {
    return this.http.get<Album[]>(`${API}/api/albums`).pipe(
      map(albums => albums.map(a => ({ ...a, covers: a.covers.map(absUrl) }))),
      catchError(() => of([] as Album[])),
    );
  }

  createAlbum(title: string, description: string) {
    return this.http.post<Album>(`${API}/api/albums`, { title, description });
  }

  deleteAlbum(id: string) {
    return this.http.delete(`${API}/api/albums/${id}`);
  }

  uploadPhoto(albumId: string, file: File) {
    const form = new FormData();
    form.append('photo', file);
    form.append('albumId', albumId);
    return this.http.post<Photo>(`${API}/api/photos`, form);
  }

  getRecentPhotos() {
    return this.http.get<Photo[]>(`${API}/api/photos/recent`).pipe(
      map(photos => photos.map(p => ({ ...p, url: absUrl(p.url) }))),
      catchError(() => of([] as Photo[])),
    );
  }
}
