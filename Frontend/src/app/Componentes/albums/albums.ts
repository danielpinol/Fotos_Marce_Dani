import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PhotoService, Album } from '../../services/photo.service';

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];

@Component({
  selector: 'app-albums',
  imports: [RouterLink, FormsModule, DatePipe],
  templateUrl: './albums.html',
  styleUrl: './albums.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Albums {
  private readonly photoService = inject(PhotoService);

  readonly albums = signal<Album[]>([]);
  readonly showForm = signal(false);
  readonly newTitle = signal('');
  readonly newDescription = signal('');
  readonly albumToDelete = signal<Album | null>(null);

  constructor() {
    this.photoService.getAlbums().subscribe(albums => this.albums.set(albums));
  }

  roman(n: number): string {
    return ROMAN[n - 1] ?? String(n);
  }

  coverSlots(covers: string[]): (string | null)[] {
    return [0, 1, 2, 3].map(i => covers[i] ?? null);
  }

  openForm(): void {
    this.newTitle.set('');
    this.newDescription.set('');
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  confirmDelete(album: Album, e: Event): void {
    e.stopPropagation();
    this.albumToDelete.set(album);
  }

  cancelDelete(): void {
    this.albumToDelete.set(null);
  }

  deleteAlbum(): void {
    const target = this.albumToDelete();
    if (!target) return;
    this.photoService.deleteAlbum(target.id).subscribe(() => {
      this.albums.update(list => list.filter(a => a.id !== target.id));
      this.albumToDelete.set(null);
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
}
