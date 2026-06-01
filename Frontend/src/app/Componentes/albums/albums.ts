import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PhotoService, Album } from '../../services/photo.service';

@Component({
  selector: 'app-albums',
  imports: [],
  templateUrl: './albums.html',
  styleUrl: './albums.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Albums {
  private readonly photoService = inject(PhotoService);
  private readonly router = inject(Router);

  readonly albums         = signal<Album[]>([]);
  readonly showForm       = signal(false);
  readonly newTitle       = signal('');
  readonly newDescription = signal('');
  readonly albumToDelete  = signal<Album | null>(null);

  constructor() {
    this.photoService.getAlbums().subscribe(albums => this.albums.set(albums));
  }

  openAlbum(id: string): void { this.router.navigate(['/albums', id]); }

  openForm(): void {
    this.newTitle.set('');
    this.newDescription.set('');
    this.showForm.set(true);
  }
  closeForm(): void { this.showForm.set(false); }

  confirmDelete(album: Album, e: Event): void {
    e.stopPropagation();
    this.albumToDelete.set(album);
  }
  cancelDelete(): void { this.albumToDelete.set(null); }

  deleteAlbum(): void {
    const target = this.albumToDelete();
    if (!target) return;
    this.photoService.deleteAlbum(target.id).subscribe({
      next: () => {
        this.albums.update(list => list.filter(a => a.id !== target.id));
        this.albumToDelete.set(null);
      },
      error: (err) => {
        console.error('Error al eliminar álbum:', err);
      },
    });
  }

  createAlbum(): void {
    const title = this.newTitle().trim();
    if (!title) return;
    this.photoService.createAlbum(title, this.newDescription().trim()).subscribe(album => {
      this.albums.update(list => [...list, album]);
      this.showForm.set(false);
    });
  }

  gradientForIndex(i: number): string {
    const hues = [340, 25, 200, 280, 160, 50, 320, 100];
    const h = hues[i % hues.length];
    return `linear-gradient(150deg, hsl(${h},30%,42%) 0%, hsl(${h + 30},25%,28%) 100%)`;
  }
}
