import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  readonly username = signal('');
  readonly password = signal('');
  readonly loading  = signal(false);
  readonly error    = signal('');

  constructor() {
    if (this.auth.isLoggedIn) this.router.navigate(['/']);
  }

  submit(): void {
    const u = this.username().trim().toLowerCase();
    const p = this.password();
    if (!u || !p) return;
    this.loading.set(true);
    this.error.set('');
    this.auth.login(u, p).subscribe({
      next: () => this.router.navigate(['/']),
      error: () => {
        this.loading.set(false);
        this.error.set('Usuario o contraseña incorrectos');
      },
    });
  }
}
