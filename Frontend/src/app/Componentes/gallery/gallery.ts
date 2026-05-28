import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PhotoService, Photo, Album } from '../../services/photo.service';

@Component({
  selector: 'app-gallery',
  imports: [],
  templateUrl: './gallery.html',
  styleUrl: './gallery.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Gallery {
  private readonly photoService = inject(PhotoService);

  readonly photos = signal<Photo[]>([]);
  readonly albums = signal<Album[]>([]);
  readonly filterAlbumId = signal<string | null>(null);
  readonly lightboxIndex = signal<number | null>(null);
  private touchStartX = 0;

  readonly filtered = computed(() => {
    const id = this.filterAlbumId();
    return id ? this.photos().filter(p => p.albumId === id) : this.photos();
  });

  readonly lightboxPhoto = computed(() => {
    const i = this.lightboxIndex();
    return i !== null ? this.filtered()[i] : null;
  });

  constructor() {
    this.photoService.getAllPhotos().subscribe(p => this.photos.set(p));
    this.photoService.getAlbums().subscribe(a => this.albums.set(a));
  }

  albumName(albumId: string): string {
    return this.albums().find(a => a.id === albumId)?.title ?? '';
  }

  setFilter(id: string | null): void { this.filterAlbumId.set(id); }
  open(index: number): void { this.lightboxIndex.set(index); }
  close(): void { this.lightboxIndex.set(null); }

  prev(): void {
    this.lightboxIndex.update(i => (i !== null && i > 0 ? i - 1 : i));
  }
  next(): void {
    const max = this.filtered().length - 1;
    this.lightboxIndex.update(i => (i !== null && i < max ? i + 1 : i));
  }

  onTouchStart(e: TouchEvent): void { this.touchStartX = e.touches[0].clientX; }
  onTouchEnd(e: TouchEvent): void {
    const delta = this.touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(delta) < 40) return;
    if (delta > 0) this.next(); else this.prev();
  }
}
