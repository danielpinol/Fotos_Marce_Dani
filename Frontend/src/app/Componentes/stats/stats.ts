import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { PhotoService, Album, Photo } from '../../services/photo.service';

const ANNIVERSARY = new Date('2026-02-10T00:00:00');

@Component({
  selector: 'app-stats',
  imports: [],
  templateUrl: './stats.html',
  styleUrl: './stats.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Stats implements OnDestroy {
  private readonly photoService = inject(PhotoService);
  private readonly now = signal(new Date());
  private readonly timer = setInterval(() => this.now.set(new Date()), 1_000);

  readonly albums = signal<Album[]>([]);
  readonly photos = signal<Photo[]>([]);

  readonly days = computed(() =>
    Math.max(0, Math.floor((this.now().getTime() - ANNIVERSARY.getTime()) / (1000 * 60 * 60 * 24)))
  );
  readonly weeks = computed(() => Math.floor(this.days() / 7));
  readonly months = computed(() => {
    const e = this.now();
    let m = (e.getFullYear() - ANNIVERSARY.getFullYear()) * 12 + (e.getMonth() - ANNIVERSARY.getMonth());
    if (e.getDate() < ANNIVERSARY.getDate()) m--;
    return Math.max(0, m);
  });
  readonly hours = computed(() =>
    Math.floor(((this.now().getTime() - ANNIVERSARY.getTime()) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  );
  readonly minutes = computed(() =>
    Math.floor(((this.now().getTime() - ANNIVERSARY.getTime()) % (1000 * 60 * 60)) / (1000 * 60))
  );
  readonly seconds = computed(() =>
    Math.floor(((this.now().getTime() - ANNIVERSARY.getTime()) % (1000 * 60)) / 1000)
  );
  readonly timeString = computed(() => {
    const h = String(this.hours()).padStart(2, '0');
    const m = String(this.minutes()).padStart(2, '0');
    const s = String(this.seconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  });

  readonly firstPhoto = computed(() => {
    const p = [...this.photos()].sort((a, b) => a.createdAt < b.createdAt ? -1 : 1);
    return p[0] ?? null;
  });

  readonly firstPhotoDate = computed(() => {
    const p = this.firstPhoto();
    if (!p) return null;
    return new Date(p.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
  });

  constructor() {
    this.photoService.getAllPhotos().subscribe(p => this.photos.set(p));
    this.photoService.getAlbums().subscribe(a => this.albums.set(a));
  }

  ngOnDestroy() { clearInterval(this.timer); }
}
