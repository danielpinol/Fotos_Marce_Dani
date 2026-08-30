import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

export interface Movie {
  id: string;
  title: string;
  notes: string;
  addedBy: 'dani' | 'marce';
  watched: boolean;
  watchedAt: string | null;
  rating: number | null;
  createdAt: string;
}

const API = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? '' : 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class MovieService {
  private readonly http = inject(HttpClient);

  getMovies() {
    return this.http.get<Movie[]>(`${API}/api/movies`).pipe(catchError(() => of([] as Movie[])));
  }

  addMovie(title: string, notes: string, addedBy: 'dani' | 'marce') {
    return this.http.post<Movie>(`${API}/api/movies`, { title, notes, addedBy });
  }

  /** Sirve para marcarla como vista, calificarla o cambiarle la nota. */
  updateMovie(id: string, cambios: Partial<Pick<Movie, 'title' | 'notes' | 'watched' | 'rating'>>) {
    return this.http.patch<Movie>(`${API}/api/movies/${id}`, cambios);
  }

  deleteMovie(id: string) {
    return this.http.delete(`${API}/api/movies/${id}`);
  }
}
