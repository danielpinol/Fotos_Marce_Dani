import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';

const API = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? '' : 'http://localhost:3000';

const TOKEN_KEY = 'nm-token';
const USER_KEY  = 'nm-user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);

  readonly currentUser = signal<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem(USER_KEY) : null
  );

  get token(): string | null {
    return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  }

  get isLoggedIn(): boolean { return !!this.token; }

  login(username: string, password: string) {
    return this.http.post<{ token: string; username: string }>(
      `${API}/api/login`, { username, password }
    ).pipe(tap(({ token, username: u }) => {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, u);
      this.currentUser.set(u);
    }));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }
}
