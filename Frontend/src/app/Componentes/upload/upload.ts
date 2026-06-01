import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PhotoService, Album } from '../../services/photo.service';
import { MOODS } from '../homepage/homepage';

@Component({
  selector: 'app-upload',
  imports: [],
  templateUrl: './upload.html',
  styleUrl: './upload.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Upload {
  private readonly photoService = inject(PhotoService);
  private readonly router       = inject(Router);
  private readonly route        = inject(ActivatedRoute);

  readonly albums          = signal<Album[]>([]);
  readonly selectedAlbumId = signal<string | null>(null);
  readonly selectedFile    = signal<File | null>(null);
  readonly previewUrl      = signal<string | null>(null);
  readonly uploading       = signal(false);
  readonly done            = signal(false);

  // New metadata fields
  readonly photoTitle   = signal('');
  readonly photoCaption = signal('');
  readonly photoDate    = signal(new Date().toISOString().slice(0, 10));
  readonly photoPlace   = signal('');
  readonly photoLat     = signal<number | null>(null);
  readonly photoLng     = signal<number | null>(null);
  readonly locating     = signal(false);
  readonly locError     = signal('');
  readonly photoMood    = signal('enamorados');
  readonly photoWithWho = signal('Solos los dos');
  readonly photoRating  = signal(5);
  readonly photoTagsStr = signal('');
  readonly photoAuthor  = signal<'dani' | 'marce'>('dani');

  readonly moods     = Object.entries(MOODS).map(([id, m]) => ({ id, ...m }));
  readonly starsArray = [1, 2, 3, 4, 5];

  readonly canUpload = computed(() =>
    this.selectedFile() !== null && this.selectedAlbumId() !== null && !this.uploading()
  );

  constructor() {
    const albumIdParam = this.route.snapshot.queryParamMap.get('albumId');
    this.photoService.getAlbums().subscribe(albums => {
      this.albums.set(albums);
      if (albumIdParam && albums.some(a => a.id === albumIdParam)) {
        this.selectedAlbumId.set(albumIdParam);
      } else if (albums.length > 0 && !this.selectedAlbumId()) {
        this.selectedAlbumId.set(albums[0].id);
      }
    });
  }

  onFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const prev = this.previewUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.selectedFile.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
  }

  useMyLocation(): void {
    if (!navigator.geolocation) {
      this.locError.set('Tu navegador no soporta geolocalización');
      return;
    }
    this.locating.set(true);
    this.locError.set('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        this.photoLat.set(latitude);
        this.photoLng.set(longitude);
        // Reverse geocode with Nominatim (OpenStreetMap, gratis, sin API key)
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=es`
          );
          const data = await resp.json();
          const place = data.address?.city
            || data.address?.town
            || data.address?.village
            || data.address?.county
            || data.address?.country
            || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          this.photoPlace.set(place);
        } catch {
          this.photoPlace.set(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
        this.locating.set(false);
      },
      (err) => {
        this.locating.set(false);
        this.locError.set(
          err.code === 1 ? 'Permiso denegado — actívalo en tu navegador' : 'No se pudo obtener tu ubicación'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  selectAlbum(id: string): void { this.selectedAlbumId.set(id); }
  selectMood(id: string): void  { this.photoMood.set(id); }
  setRating(n: number): void    { this.photoRating.set(n); }
  selectAuthor(a: 'dani' | 'marce'): void { this.photoAuthor.set(a); }
  selectWithWho(w: string): void { this.photoWithWho.set(w); }

  doUpload(): void {
    const file = this.selectedFile();
    const albumId = this.selectedAlbumId();
    if (!file || !albumId) return;

    const tags = this.photoTagsStr()
      .split(',')
      .map(t => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    this.uploading.set(true);
    this.photoService.uploadPhoto(albumId, file, {
      title:   this.photoTitle().trim(),
      caption: this.photoCaption().trim(),
      date:    this.photoDate(),
      place:   { name: this.photoPlace().trim(), lat: this.photoLat(), lng: this.photoLng() },
      mood:    this.photoMood(),
      withWho: this.photoWithWho(),
      rating:  this.photoRating(),
      tags,
      author:  this.photoAuthor(),
    }).subscribe({
      next: () => {
        this.uploading.set(false);
        this.done.set(true);
        const returnAlbum = this.route.snapshot.queryParamMap.get('albumId') ?? this.selectedAlbumId();
        setTimeout(() => this.router.navigate(returnAlbum ? ['/albums', returnAlbum] : ['/']), 1400);
      },
      error: () => this.uploading.set(false),
    });
  }
}
