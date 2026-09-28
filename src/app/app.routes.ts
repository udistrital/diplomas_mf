import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/inicio/inicio').then((m) => m.InicioComponent)
  },
  {
    path: 'firmas',
    canActivate: [authGuard],
    loadChildren: () => import('./features/firmas/firmas.routes').then((m) => m.FIRMAS_ROUTES)
  },
  { path: '**', redirectTo: '' }
];
