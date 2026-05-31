import { Routes } from '@angular/router';

export const routes: Routes = [
    {path: '', loadComponent: () => import('./Componentes/homepage/homepage').then(m => m.Homepage)},
    {path: 'login', loadComponent: () => import('./Componentes/login/login').then(m => m.Login)},
    {path: 'albums', loadComponent: () => import('./Componentes/albums/albums').then(m => m.Albums)},
    {path: 'albums/:id', loadComponent: () => import('./Componentes/album-detail/album-detail').then(m => m.AlbumDetail)},
    {path: 'gallery', loadComponent: () => import('./Componentes/gallery/gallery').then(m => m.Gallery)},
    {path: 'timeline', loadComponent: () => import('./Componentes/timeline/timeline').then(m => m.Timeline)},
    {path: 'stats', loadComponent: () => import('./Componentes/stats/stats').then(m => m.Stats)},
    {path: 'upload', loadComponent: () => import('./Componentes/upload/upload').then(m => m.Upload)},
    {path: '**', redirectTo: '' }
];