import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

interface Album {
  id: number;
  title: string;
  description: string;
  photoCount: number;
  createdAt: Date;
  covers: string[];
}

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];

@Component({
  selector: 'app-albums',
  imports: [RouterLink, FormsModule, DatePipe],
  templateUrl: './albums.html',
  styleUrl: './albums.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Albums {
  readonly albums = signal<Album[]>([]);
  readonly showForm = signal(false);
  readonly newTitle = signal('');
  readonly newDescription = signal('');
  readonly albumToDelete = signal<Album | null>(null);

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
    this.albums.update(list => list.filter(a => a.id !== target.id));
    this.albumToDelete.set(null);
  }

  createAlbum(): void {
    const title = this.newTitle().trim();
    if (!title) return;
    const newAlbum: Album = {
      id: Date.now(),
      title,
      description: this.newDescription().trim(),
      photoCount: 0,
      createdAt: new Date(),
      covers: [],
    };
    this.albums.update(list => [...list, newAlbum]);
    this.showForm.set(false);
  }
}
