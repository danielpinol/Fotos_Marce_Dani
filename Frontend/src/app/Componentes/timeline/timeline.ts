import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PhotoService, Photo, Album } from '../../services/photo.service';
import { MOODS } from '../homepage/homepage';

interface PhotoGroup {
  month: string;
  year: number;
  monthLabel: string;
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
    const sorted = [...this.photos()].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const map = new Map<string, Photo[]>();
    for (const photo of sorted) {
      const d = new Date(photo.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(photo);
    }
    return [...map.entries()].map(([key, photos]) => {
      const [y, m] = key.split('-').map(Number);
      const d = new Date(y, m - 1, 1);
      return {
        month: d.toLocaleDateString('es', { month: 'long' }),
        year: y,
        monthLabel: d.toLocaleDateString('es', { month: 'long', year: 'numeric' }),
        photos,
      };
    });
  });

  constructor() {
    this.photoService.getAllPhotos().subscribe(p => this.photos.set(p));
    this.photoService.getAlbums().subscribe(a => this.albums.set(a));
  }

  albumName(albumId: string): string {
    return this.albums().find(a => a.id === albumId)?.title ?? '';
  }

  moodOf(id: string) { return MOODS[id] ?? MOODS['enamorados']; }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }

  photoLabel(photo: Photo): string {
    return photo.title || photo.caption || this.albumName(photo.albumId) || 'Recuerdo';
  }

  isLast(groups: PhotoGroup[], gi: number, photos: Photo[], pi: number): boolean {
    return gi === groups.length - 1 && pi === photos.length - 1;
  }
}
