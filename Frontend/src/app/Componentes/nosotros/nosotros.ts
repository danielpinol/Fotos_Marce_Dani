import { ChangeDetectionStrategy, Component, OnDestroy, computed, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PhotoService, Photo } from '../../services/photo.service';
import { AuthService } from '../../services/auth.service';
import { MOODS } from '../homepage/homepage';
import { Peliculas } from '../peliculas/peliculas';

const ANNIVERSARY  = new Date('2026-02-10T00:00:00');
const ONE_YEAR_MS  = 365 * 24 * 60 * 60 * 1000;

interface StatSummary {
  total:    number;
  weeks:    number;
  topPlace: [string, number];
  topMood:  { label: string; emoji: string; color: string };
  avgRating:number;
  mostLoved:Photo | null;
}

@Component({
  selector: 'app-nosotros',
  imports: [RouterLink, Peliculas],
  templateUrl: './nosotros.html',
  styleUrl: './nosotros.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Nosotros implements OnDestroy {
  private readonly photoService = inject(PhotoService);
  readonly auth = inject(AuthService);
  private readonly now = signal(new Date());
  private readonly timer = setInterval(() => this.now.set(new Date()), 1_000);

  readonly photos = signal<Photo[]>([]);

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
  readonly remainingDays = computed(() => {
    const milestone = new Date(ANNIVERSARY);
    milestone.setMonth(milestone.getMonth() + this.months());
    return Math.floor((this.now().getTime() - milestone.getTime()) / (1000 * 60 * 60 * 24));
  });
  readonly yearProgress = computed(() =>
    Math.min(100, Math.round(((this.now().getTime() - ANNIVERSARY.getTime()) / ONE_YEAR_MS) * 100))
  );

  readonly stats = computed<StatSummary>(() => {
    const mems = this.photos();
    if (!mems.length) return {
      total: 0, weeks: this.weeks(),
      topPlace: ['—', 0], topMood: MOODS['enamorados'],
      avgRating: 0, mostLoved: null,
    };

    const count = (arr: string[]) => {
      const m: Record<string, number> = {};
      for (const k of arr) m[k] = (m[k] ?? 0) + 1;
      return m;
    };
    const top = (obj: Record<string, number>): [string, number] => {
      const e = Object.entries(obj).sort((a, b) => b[1] - a[1])[0];
      return e ?? ['—', 0];
    };

    const placeCounts = count(mems.map(m => m.place?.name).filter(Boolean) as string[]);
    const moodCounts  = count(mems.map(m => m.mood));
    const topMoodId   = top(moodCounts)[0];

    const avgRating = mems.reduce((s, m) => s + (m.rating ?? 5), 0) / mems.length;
    const mostLoved = [...mems].sort((a, b) =>
      (b.reactions.length + b.comments.length) - (a.reactions.length + a.comments.length)
    )[0] ?? null;

    return {
      total:    mems.length,
      weeks:    this.weeks(),
      topPlace: top(placeCounts),
      topMood:  MOODS[topMoodId] ?? MOODS['enamorados'],
      avgRating,
      mostLoved,
    };
  });

  constructor() {
    this.photoService.getAllPhotos().subscribe(photos => this.photos.set(photos));
  }

  currentMonthName(): string {
    return new Date().toLocaleDateString('es', { month: 'long', year: 'numeric' });
  }

  ngOnDestroy() { clearInterval(this.timer); }
}
