import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, catchError, of } from 'rxjs';

export interface Album {
  id: number;
  title: string;
  description: string;
  photoCount: number;
  createdAt: string;
  covers: string[];
}

export interface Photo {
  id: number;
  albumId: number;
  url: string;
  createdAt: string;
}

const API = 'http://localhost:3000';

function withBaseUrl(path: string): string {
  return path.startsWith('http') ? path : `${API}${path}`;
}

@Injectable({ providedIn: 'root' })
export class PhotoService {
  private readonly http = inject(HttpClient);

  getAlbums() {
    return this.http.get<Album[]>(`${API}/api/albums`).pipe(
      map(albums => albums.map(a => ({
        ...a,
        covers: a.covers.map(withBaseUrl),
      }))),
      catchError(() => of([] as Album[])),
    );
  }

  createAlbum(title: string, description: string) {
    return this.http.post<Album>(`${API}/api/albums`, { title, description });
  }

  deleteAlbum(id: number) {
    return this.http.delete(`${API}/api/albums/${id}`);
  }

  uploadPhoto(albumId: number, file: File) {
    const form = new FormData();
    form.append('photo', file);
    form.append('albumId', String(albumId));
    return this.http.post<Photo>(`${API}/api/photos`, form);
  }

  getRecentPhotos() {
    return this.http.get<Photo[]>(`${API}/api/photos/recent`).pipe(
      map(photos => photos.map(p => ({ ...p, url: withBaseUrl(p.url) }))),
      catchError(() => of([] as Photo[])),
    );
  }
}
