import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent],
  template: `
    <div class="app-layout">
      <app-navbar></app-navbar>
      <main class="content-viewport">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-layout {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .content-viewport {
      flex: 1 1 auto;
    }
  `],
})
export class AppComponent {
  title = 'Enterprise IT Service Desk';
}
