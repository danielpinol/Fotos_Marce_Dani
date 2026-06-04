import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PhotoService, Album, Photo } from '../../services/photo.service';
import { MOODS } from '../homepage/homepage';

const PEOPLE: Record<string, { name: string; color: string }> = {
  dani:  { name: 'Dani',   color: '#3F6F9F' },
  marce: { name: 'Marche', color: '#B0564C' },
};

const REACTIONS = ['🫶', '🥹', '😂', '☀️', '😍', '🥰'];

@Component({
  selector: 'app-album-detail',
  imports: [RouterLink],
  templateUrl: './album-detail.html',
  styleUrl: './album-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlbumDetail implements OnDestroy {
  private readonly photoService = inject(PhotoService);
  private readonly route        = inject(ActivatedRoute);
  private readonly doc          = inject(DOCUMENT);

  readonly album          = signal<Album | null>(null);
  readonly photos         = signal<Photo[]>([]);
  readonly lightboxIndex  = signal<number | null>(null);
  readonly activeTab      = signal<'foto' | 'info'>('foto');
  readonly editingCaption = signal('');
  readonly saving         = signal(false);
  readonly commentText    = signal('');
  readonly commenting     = signal(false);
  readonly activeAuthor   = signal<'dani' | 'marce'>('dani');
  readonly deleteConfirm  = signal(false);
  readonly deleting       = signal(false);

  private touchStartX = 0;

  readonly lightboxPhoto = computed(() => {
    const i = this.lightboxIndex();
    return i !== null ? this.photos()[i] ?? null : null;
  });

  readonly reactions = REACTIONS;
  readonly people    = PEOPLE;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.photoService.getAlbums().subscribe(albums =>
      this.album.set(albums.find(a => a.id === id) ?? null)
    );
    this.photoService.getAlbumPhotos(id).subscribe(photos => this.photos.set(photos));

    effect(() => {
      const photo = this.lightboxPhoto();
      this.editingCaption.set(photo?.caption ?? '');
    });
  }

  open(i: number): void {
    this.lightboxIndex.set(i);
    this.activeTab.set('foto');
    this.deleteConfirm.set(false);
    this.doc.body.style.overflow = 'hidden';
  }
  close(): void {
    this.lightboxIndex.set(null);
    this.doc.body.style.overflow = '';
  }

  ngOnDestroy(): void { this.doc.body.style.overflow = ''; }
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

  moodOf(id: string) { return MOODS[id] ?? MOODS['enamorados']; }

  saveCaption(): void {
    const photo = this.lightboxPhoto();
    if (!photo) return;
    this.saving.set(true);
    this.photoService.updateCaption(photo.id, this.editingCaption().trim()).subscribe(updated => {
      this.photos.update(list => list.map(p => p.id === updated.id ? updated : p));
      this.saving.set(false);
    });
  }

  react(emoji: string): void {
    const photo = this.lightboxPhoto();
    if (!photo) return;
    const me = this.activeAuthor();
    const myReaction = photo.reactions.find(r => r.by === me);
    const newEmoji = myReaction?.emoji === emoji ? null : emoji;
    this.photoService.addReaction(photo.id, me, newEmoji).subscribe(updated => {
      this.photos.update(list => list.map(p => p.id === updated.id ? updated : p));
    });
  }

  hasMyReaction(emoji: string): boolean {
    const photo = this.lightboxPhoto();
    if (!photo) return false;
    return photo.reactions.some(r => r.by === this.activeAuthor() && r.emoji === emoji);
  }

  sendComment(): void {
    const text = this.commentText().trim();
    const photo = this.lightboxPhoto();
    if (!text || !photo) return;
    this.commenting.set(true);
    this.photoService.addComment(photo.id, this.activeAuthor(), text).subscribe(updated => {
      this.photos.update(list => list.map(p => p.id === updated.id ? updated : p));
      this.commentText.set('');
      this.commenting.set(false);
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  deletePhoto(): void {
    const photo = this.lightboxPhoto();
    if (!photo) return;
    this.deleting.set(true);
    this.photoService.deletePhoto(photo.id).subscribe(() => {
      this.photos.update(list => list.filter(p => p.id !== photo.id));
      this.close();
      this.deleting.set(false);
      this.deleteConfirm.set(false);
    });
  }

  formatMemoryDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  formatShortDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }

  starsArray = [1, 2, 3, 4, 5];

  photoLabel(photo: Photo): string {
    return photo.title || photo.caption || 'Recuerdo';
  }
}
