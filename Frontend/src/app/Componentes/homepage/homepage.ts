import { ChangeDetectionStrategy, Component, OnDestroy, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

const ANNIVERSARY = new Date('2026-02-10T00:00:00');
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-homepage',
  imports: [RouterLink],
  templateUrl: './homepage.html',
  styleUrl: './homepage.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Homepage implements OnDestroy {
  private readonly now = signal(new Date());
  private readonly timer = setInterval(() => this.now.set(new Date()), 1_000);

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

  readonly timeString = computed(() => {
    const h = String(this.hours()).padStart(2, '0');
    const m = String(this.minutes()).padStart(2, '0');
    const s = String(this.seconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  });

  readonly weeks = computed(() => Math.floor(this.days() / 7));

  readonly months = computed(() => {
    const end = this.now();
    const m = (end.getFullYear() - ANNIVERSARY.getFullYear()) * 12
              + (end.getMonth() - ANNIVERSARY.getMonth());
    return m < 0 ? 0 : m;
  });

  readonly yearProgress = computed(() => {
    const elapsed = this.now().getTime() - ANNIVERSARY.getTime();
    return Math.min(100, Math.round((elapsed / ONE_YEAR_MS) * 100));
  });

  readonly recentPhotos = [1, 2, 3, 4];

  ngOnDestroy() {
    clearInterval(this.timer);
  }
}
