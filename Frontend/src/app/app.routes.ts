import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./Componentes/login/login').then(m => m.Login) },
  { path: '',           canActivate: [authGuard], loadComponent: () => import('./Componentes/homepage/homepage').then(m => m.Homepage) },
  { path: 'albums',     canActivate: [authGuard], loadComponent: () => import('./Componentes/albums/albums').then(m => m.Albums) },
  { path: 'albums/:id', canActivate: [authGuard], loadComponent: () => import('./Componentes/album-detail/album-detail').then(m => m.AlbumDetail) },
  { path: 'gallery',    canActivate: [authGuard], loadComponent: () => import('./Componentes/gallery/gallery').then(m => m.Gallery) },
  { path: 'timeline',   canActivate: [authGuard], loadComponent: () => import('./Componentes/timeline/timeline').then(m => m.Timeline) },
  { path: 'stats',      canActivate: [authGuard], loadComponent: () => import('./Componentes/stats/stats').then(m => m.Stats) },
  { path: 'nosotros',   canActivate: [authGuard], loadComponent: () => import('./Componentes/nosotros/nosotros').then(m => m.Nosotros) },
  { path: 'upload',     canActivate: [authGuard], loadComponent: () => import('./Componentes/upload/upload').then(m => m.Upload) },
  { path: '**',         redirectTo: '' },
];
