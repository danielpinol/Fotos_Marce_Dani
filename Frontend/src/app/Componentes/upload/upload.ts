import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { PhotoService, Album } from '../../services/photo.service';

@Component({
  selector: 'app-upload',
  imports: [],
  templateUrl: './upload.html',
  styleUrl: './upload.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Upload {
  private readonly photoService = inject(PhotoService);
  private readonly router = inject(Router);

  readonly albums = signal<Album[]>([]);
  readonly selectedAlbumId = signal<number | null>(null);
  readonly selectedFile = signal<File | null>(null);
  readonly previewUrl = signal<string | null>(null);
  readonly uploading = signal(false);
  readonly done = signal(false);

  readonly canUpload = computed(() =>
    this.selectedFile() !== null && this.selectedAlbumId() !== null && !this.uploading()
  );

  constructor() {
    this.photoService.getAlbums().subscribe(albums => this.albums.set(albums));
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

  selectAlbum(id: number): void {
    this.selectedAlbumId.set(id);
  }

  doUpload(): void {
    const file = this.selectedFile();
    const albumId = this.selectedAlbumId();
    if (!file || !albumId) return;

    this.uploading.set(true);
    this.photoService.uploadPhoto(albumId, file).subscribe({
      next: () => {
        this.uploading.set(false);
        this.done.set(true);
        setTimeout(() => this.router.navigate(['/']), 1200);
      },
      error: () => this.uploading.set(false),
    });
  }
}
