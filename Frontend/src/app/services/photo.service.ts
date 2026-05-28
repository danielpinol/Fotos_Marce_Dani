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

export interface Photo {
  id: string;
  albumId: string;
  url: string;
  createdAt: string;
}

const API = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? ''
  : 'http://localhost:3000';

const CLOUDINARY_CLOUD = 'dtofbkdzb';
const CLOUDINARY_PRESET = 'nuestro_museo';

@Injectable({ providedIn: 'root' })
export class PhotoService {
  private readonly http = inject(HttpClient);

  getAlbums() {
    return this.http.get<Album[]>(`${API}/api/albums`).pipe(
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
    // 1. Subir archivo directo a Cloudinary desde el celular
    const cloudForm = new FormData();
    cloudForm.append('file', file);
    cloudForm.append('upload_preset', CLOUDINARY_PRESET);

    return this.http
      .post<{ secure_url: string }>(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
        cloudForm,
      )
      .pipe(
        // 2. Guardar solo la URL en MongoDB via backend
        switchMap(({ secure_url }) =>
          this.http.post<Photo>(`${API}/api/photos`, { albumId, url: secure_url }),
        ),
      );
  }

  getAllPhotos() {
    return this.http.get<Photo[]>(`${API}/api/photos`).pipe(
      catchError(() => of([] as Photo[])),
    );
  }

  getRecentPhotos() {
    return this.http.get<Photo[]>(`${API}/api/photos/recent`).pipe(
      map(photos => photos.map(p => ({ ...p }))),
      catchError(() => of([] as Photo[])),
    );
  }
}
