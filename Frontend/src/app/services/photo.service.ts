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

export interface Capsule {
  id: string;
  title: string;
  note: string;
  unlock: string;
  tone: number;
  by: 'dani' | 'marce';
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

  uploadPhoto(albumId: string, file: File, metadata: Partial<Omit<Photo, 'id' | 'url' | 'albumId' | 'createdAt' | 'reactions' | 'comments'>> = {}) {
    const cloudForm = new FormData();
    cloudForm.append('file', file);
    cloudForm.append('upload_preset', CLOUDINARY_PRESET);
    return this.http
      .post<{ secure_url: string }>(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
        cloudForm,
      )
      .pipe(
        switchMap(({ secure_url }) =>
          this.http.post<Photo>(`${API}/api/photos`, { albumId, url: secure_url, ...metadata }),
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

  getCapsules() {
    return this.http.get<Capsule[]>(`${API}/api/capsules`).pipe(catchError(() => of([] as Capsule[])));
  }

  createCapsule(data: Omit<Capsule, 'id' | 'createdAt'>) {
    return this.http.post<Capsule>(`${API}/api/capsules`, data);
  }

  deleteCapsule(id: string) {
    return this.http.delete(`${API}/api/capsules/${id}`);
  }

  getPrompts() {
    return this.http.get<Prompt[]>(`${API}/api/prompts`).pipe(catchError(() => of([] as Prompt[])));
  }

  seedPrompts() {
    return this.http.post<{ seeded: boolean }>(`${API}/api/prompts/seed`, {}).pipe(catchError(() => of({ seeded: false })));
  }
}
