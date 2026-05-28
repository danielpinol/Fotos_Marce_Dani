import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PhotoService, Photo, Album } from '../../services/photo.service';

interface PhotoGroup {
  label: string;
  photos: Photo[];
}

@Component({
  selector: 'app-timeline',
  imports: [],
  templateUrl: './timeline.html',
  styleUrl: './timeline.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Timeline {
  private readonly photoService = inject(PhotoService);

  readonly photos = signal<Photo[]>([]);
  readonly albums = signal<Album[]>([]);

  readonly groups = computed<PhotoGroup[]>(() => {
    const map = new Map<string, Photo[]>();
    for (const photo of this.photos()) {
      const d = new Date(photo.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(photo);
    }
    return [...map.entries()].map(([key, photos]) => {
      const [y, m] = key.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' });
      return { label: label.charAt(0).toUpperCase() + label.slice(1), photos };
    });
  });

  constructor() {
    this.photoService.getAllPhotos().subscribe(p => this.photos.set(p));
    this.photoService.getAlbums().subscribe(a => this.albums.set(a));
  }

  albumName(albumId: string): string {
    return this.albums().find(a => a.id === albumId)?.title ?? '';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }
}
