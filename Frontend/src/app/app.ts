import { ChangeDetectionStrategy, Component, signal, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BottomNav } from './Componentes/bottom-nav/bottom-nav';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BottomNav],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-theme]': 'theme()' },
})
export class App {
  readonly theme = signal<'light' | 'dark'>('light');

  constructor() {
    // Persist theme
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (saved) this.theme.set(saved);

    effect(() => {
      localStorage.setItem('theme', this.theme());
      document.documentElement.setAttribute('data-theme', this.theme());
    });
  }

  toggleTheme(): void {
    this.theme.update(t => t === 'light' ? 'dark' : 'light');
  }
}
