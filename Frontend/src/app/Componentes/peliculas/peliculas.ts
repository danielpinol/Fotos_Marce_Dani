import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MovieService, Movie } from '../../services/movie.service';
import { AuthService } from '../../services/auth.service';

type Carpeta = 'pendientes' | 'vistas';

@Component({
  selector: 'app-peliculas',
  imports: [ReactiveFormsModule],
  templateUrl: './peliculas.html',
  styleUrl: './peliculas.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Peliculas {
  private readonly movieService = inject(MovieService);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly movies    = signal<Movie[]>([]);
  readonly carpeta   = signal<Carpeta>('pendientes');
  readonly guardando = signal(false);
  readonly mostrarForm = signal(false);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    notes: ['', [Validators.maxLength(200)]],
  });

  // Las que faltan por ver: primero las agregadas mas recientemente
  readonly pendientes = computed(() =>
    this.movies().filter(m => !m.watched)
  );

  // Las que ya vimos: primero la ultima que vimos juntos
  readonly vistas = computed(() =>
    [...this.movies()]
      .filter(m => m.watched)
      .sort((a, b) => new Date(b.watchedAt ?? b.createdAt).getTime()
                    - new Date(a.watchedAt ?? a.createdAt).getTime())
  );

  readonly enPantalla = computed(() =>
    this.carpeta() === 'pendientes' ? this.pendientes() : this.vistas()
  );

  abrirForm(): void {
    this.mostrarForm.set(true);
  }

  cerrarForm(): void {
    this.mostrarForm.set(false);
    this.form.reset();
  }

  verCarpeta(cual: Carpeta): void {
    this.carpeta.set(cual);
  }

  agregar(): void {
    if (this.form.invalid || this.guardando()) return;
    const { title, notes } = this.form.getRawValue();
    const quien = this.auth.currentUser() === 'marche' ? 'marce' : 'dani';

    this.guardando.set(true);
    this.movieService.addMovie(title.trim(), notes.trim(), quien).subscribe({
      next: peli => {
        this.movies.update(lista => [peli, ...lista]);
        this.form.reset();
        this.mostrarForm.set(false);
        this.guardando.set(false);
        // Si estabamos viendo las vistas, saltamos a pendientes para verla caer
        this.carpeta.set('pendientes');
      },
      error: () => this.guardando.set(false),
    });
  }

  alternarVista(peli: Movie): void {
    const vista = !peli.watched;
    this.movieService.updateMovie(peli.id, { watched: vista }).subscribe({
      next: actualizada => {
        this.movies.update(lista => lista.map(m => m.id === peli.id ? actualizada : m));
      },
    });
  }

  calificar(peli: Movie, estrellas: number): void {
    // Tocar la misma estrella otra vez quita la calificacion
    const rating = peli.rating === estrellas ? null : estrellas;
    this.movieService.updateMovie(peli.id, { rating }).subscribe({
      next: actualizada => {
        this.movies.update(lista => lista.map(m => m.id === peli.id ? actualizada : m));
      },
    });
  }

  borrar(peli: Movie): void {
    this.movieService.deleteMovie(peli.id).subscribe({
      next: () => this.movies.update(lista => lista.filter(m => m.id !== peli.id)),
    });
  }

  nombreDe(quien: string): string {
    return quien === 'marce' ? 'Marche' : 'Dani';
  }

  fechaVista(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  readonly estrellas = [1, 2, 3, 4, 5];

  constructor() {
    this.movieService.getMovies().subscribe(m => this.movies.set(m));
  }
}
