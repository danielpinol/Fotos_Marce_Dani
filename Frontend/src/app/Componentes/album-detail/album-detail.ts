import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PhotoService, Album, Photo } from '../../services/photo.service';

@Component({
  selector: 'app-album-detail',
  imports: [RouterLink],
  templateUrl: './album-detail.html',
  styleUrl: './album-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlbumDetail {
  private readonly photoService = inject(PhotoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly album = signal<Album | null>(null);
  readonly photos = signal<Photo[]>([]);
  readonly lightboxIndex = signal<number | null>(null);
  readonly editingCaption = signal('');
  readonly saving = signal(false);
  private touchStartX = 0;

  readonly lightboxPhoto = computed(() => {
    const i = this.lightboxIndex();
    return i !== null ? this.photos()[i] ?? null : null;
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.photoService.getAlbums().subscribe(albums => {
      this.album.set(albums.find(a => a.id === id) ?? null);
    });
    this.photoService.getAlbumPhotos(id).subscribe(photos => this.photos.set(photos));

    effect(() => {
      const photo = this.lightboxPhoto();
      this.editingCaption.set(photo?.caption ?? '');
    });
  }

  open(i: number): void { this.lightboxIndex.set(i); }
  close(): void { this.lightboxIndex.set(null); }
  prev(): void { this.lightboxIndex.update(i => (i !== null && i > 0 ? i - 1 : i)); }
  next(): void {
    const max = this.photos().length - 1;
    this.lightboxIndex.update(i => (i !== null && i < max ? i + 1 : i));
  }

  onTouchStart(e: TouchEvent): void { this.touchStartX = e.touches[0].clientX; }
  onTouchEnd(e: TouchEvent): void {
    const delta = this.touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(delta) < 40) return;
    if (delta > 0) this.next(); else this.prev();
  }

  saveCaption(): void {
    const photo = this.lightboxPhoto();
    if (!photo) return;
    const caption = this.editingCaption().trim();
    this.saving.set(true);
    this.photoService.updateCaption(photo.id, caption).subscribe(updated => {
      this.photos.update(list => list.map(p => p.id === updated.id ? updated : p));
      this.saving.set(false);
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
