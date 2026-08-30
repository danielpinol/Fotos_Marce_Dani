import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { of, switchMap } from 'rxjs';
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

  readonly albums          = signal<Album[]>([]);
  readonly showForm        = signal(false);
  readonly newTitle        = signal('');
  readonly newDescription  = signal('');
  readonly albumToDelete   = signal<Album | null>(null);
  readonly deleting        = signal(false);
  readonly deleteError     = signal(false);
  readonly coverFile       = signal<File | null>(null);
  readonly coverPreviewUrl = signal<string | null>(null);
  readonly isCreating      = signal(false);

  constructor() {
    this.photoService.getAlbums().subscribe(albums => this.albums.set(albums));
  }

  openAlbum(id: string): void { this.router.navigate(['/albums', id]); }

  openForm(): void {
    this.newTitle.set('');
    this.newDescription.set('');
    this.coverFile.set(null);
    const prev = this.coverPreviewUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.coverPreviewUrl.set(null);
    this.showForm.set(true);
  }
  closeForm(): void { this.showForm.set(false); }

  onCoverChange(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const prev = this.coverPreviewUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.coverFile.set(file);
    this.coverPreviewUrl.set(URL.createObjectURL(file));
  }

  confirmDelete(album: Album, e: Event): void {
    e.stopPropagation();
    this.deleteError.set(false);
    this.albumToDelete.set(album);
  }
  cancelDelete(): void {
    if (this.deleting()) return;
    this.albumToDelete.set(null);
    this.deleteError.set(false);
  }

  deleteAlbum(): void {
    const target = this.albumToDelete();
    if (!target || this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set(false);
    this.photoService.deleteAlbum(target.id).subscribe({
      next: () => {
        this.albums.update(list => list.filter(a => a.id !== target.id));
        this.albumToDelete.set(null);
        this.deleting.set(false);
      },
      error: () => {
        this.deleting.set(false);
        this.deleteError.set(true);
      },
    });
  }

  createAlbum(): void {
    const title = this.newTitle().trim();
    if (!title || this.isCreating()) return;
    this.isCreating.set(true);
    const description = this.newDescription().trim();
    const file = this.coverFile();
    const cover$ = file ? this.photoService.uploadToCloudinary(file) : of('');
    cover$.pipe(
      switchMap(url => this.photoService.createAlbum(title, description, url ? [url] : []))
    ).subscribe({
      next: album => {
        // Al frente, para respetar el orden por movimiento que manda la API
        this.albums.update(list => [album, ...list]);
        this.showForm.set(false);
        this.isCreating.set(false);
      },
      error: () => this.isCreating.set(false),
    });
  }

  gradientForIndex(i: number): string {
    const hues = [340, 25, 200, 280, 160, 50, 320, 100];
    const h = hues[i % hues.length];
    return `linear-gradient(150deg, hsl(${h},30%,42%) 0%, hsl(${h + 30},25%,28%) 100%)`;
  }
}
