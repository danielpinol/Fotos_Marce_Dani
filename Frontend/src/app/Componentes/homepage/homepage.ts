import { ChangeDetectionStrategy, Component, OnDestroy, computed, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PhotoService, Photo, Album, Prompt } from '../../services/photo.service';

const ANNIVERSARY = new Date('2026-02-10T00:00:00');
const ONE_YEAR_MS  = 365 * 24 * 60 * 60 * 1000;

export const MOODS: Record<string, { label: string; emoji: string; color: string }> = {
  enamorados: { label: 'Enamorados', emoji: '🫶', color: '#B0564C' },
  feliz:      { label: 'Felices',    emoji: '☀️',  color: '#D6A24B' },
  risa:       { label: 'Risa',       emoji: '😂',  color: '#C97D3F' },
  tranquilo:  { label: 'Tranquilos', emoji: '🌿',  color: '#6E9A78' },
  aventura:   { label: 'Aventura',   emoji: '🧭',  color: '#4E7C8C' },
  nostalgia:  { label: 'Nostalgia',  emoji: '🌙',  color: '#8A7AA8' },
};

const FALLBACK_PROMPTS = [
  'Una foto de algo que hoy te recordó a mí',
  'Tu momento favorito de hoy',
  'Una foto de mi bb',
  'Una foto de nosotros dos',
  'El cielo, ahorita estes donde estes',
  'Algo que te hizo reír esta semana',
  'Un detalle bonito que viste hoy',
  'Una foto de tu lugar favorito juntos',
];

@Component({
  selector: 'app-homepage',
  imports: [RouterLink],
  templateUrl: './homepage.html',
  styleUrl: './homepage.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Homepage implements OnDestroy {
  private readonly photoService = inject(PhotoService);
  private readonly now = signal(new Date());
  private readonly timer = setInterval(() => this.now.set(new Date()), 1_000);

  readonly recentPhotos = signal<Photo[]>([]);
  readonly albums       = signal<Album[]>([]);
  readonly prompts      = signal<string[]>(FALLBACK_PROMPTS);
  readonly promptIdx    = signal(Math.floor(Math.random() * FALLBACK_PROMPTS.length));

  readonly prompt = computed(() => this.prompts()[this.promptIdx() % this.prompts().length]);

  readonly days = computed(() =>
    Math.floor((this.now().getTime() - ANNIVERSARY.getTime()) / (1000 * 60 * 60 * 24))
  );
  readonly hours = computed(() =>
    Math.floor(((this.now().getTime() - ANNIVERSARY.getTime()) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  );
  readonly minutes = computed(() =>
    Math.floor(((this.now().getTime() - ANNIVERSARY.getTime()) % (1000 * 60 * 60)) / (1000 * 60))
  );
  readonly seconds = computed(() =>
    Math.floor(((this.now().getTime() - ANNIVERSARY.getTime()) % (1000 * 60)) / 1000)
  );
  readonly hh = computed(() => String(this.hours()).padStart(2, '0'));
  readonly mm = computed(() => String(this.minutes()).padStart(2, '0'));
  readonly ss = computed(() => String(this.seconds()).padStart(2, '0'));

  readonly months = computed(() => {
    const end = this.now();
    let m = (end.getFullYear() - ANNIVERSARY.getFullYear()) * 12
              + (end.getMonth() - ANNIVERSARY.getMonth());
    if (end.getDate() < ANNIVERSARY.getDate()) m--;
    return Math.max(0, m);
  });
  readonly weeks = computed(() => Math.floor(this.days() / 7));
  readonly yearProgress = computed(() => {
    const elapsed = this.now().getTime() - ANNIVERSARY.getTime();
    return Math.min(100, Math.round((elapsed / ONE_YEAR_MS) * 100));
  });

  readonly featured = computed(() => this.recentPhotos()[0] ?? null);
  readonly recent   = computed(() => this.recentPhotos().slice(1, 7));

  readonly starsArray = [1, 2, 3, 4, 5];

  constructor() {
    this.photoService.getRecentPhotos().subscribe(photos => this.recentPhotos.set(photos));
    this.photoService.getAlbums().subscribe(albums => this.albums.set(albums));
    this.photoService.getPrompts().subscribe(ps => {
      if (ps.length) this.prompts.set(ps.map((p: Prompt) => p.text));
    });
  }

  moodOf(id: string) { return MOODS[id] ?? MOODS['enamorados']; }

  featuredSub(photo: Photo): string {
    const parts: string[] = [];
    if (photo.place?.name) parts.push(photo.place.name);
    if (photo.date) parts.push(photo.date.slice(0, 7));
    return parts.join(' · ');
  }

  photoLabel(photo: Photo): string {
    return photo.title || photo.caption || 'Recuerdo';
  }

  nextPrompt(): void { this.promptIdx.update(i => i + 1); }

  gradientForIndex(i: number): string {
    const hues = [340, 25, 200, 280, 160, 50, 320];
    const h = hues[i % hues.length];
    return `linear-gradient(150deg, hsl(${h},30%,42%) 0%, hsl(${h + 30},25%,28%) 100%)`;
  }

  ngOnDestroy() { clearInterval(this.timer); }
}
