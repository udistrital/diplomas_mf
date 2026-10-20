import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [authGuard],
    loadComponent: () => import('./features/inicio/inicio').then((m) => m.InicioComponent)
  },
  {
    path: 'firmas',
    canActivate: [authGuard],
    loadChildren: () => import('./features/firmas/firmas.routes').then((m) => m.FIRMAS_ROUTES)
  },
  {
    path: 'ceremonias',
    canActivate: [authGuard],
    loadChildren: () => import('./features/ceremonias/ceremonias.routes').then((m) => m.CEREMONIAS_ROUTES)
  },
  {
    path: 'firma-secretario',
    canActivate: [authGuard],
    loadComponent: () => import('./features/firma-secretario/firma-secretario').then((m) => m.FirmaSecretarioComponent)
  },
  {
    path: 'diplomas/firma-secretario',
    canActivate: [authGuard],
    loadComponent: () => import('./features/firma-secretario/firma-secretario').then((m) => m.FirmaSecretarioComponent)
  },
  {
    path: 'firma-decano',
    canActivate: [authGuard],
    loadComponent: () => import('./features/firma-secretario/firma-secretario').then((m) => m.FirmaSecretarioComponent)
  },
  {
    path: 'diplomas/firma-decano',
    canActivate: [authGuard],
    loadComponent: () => import('./features/firma-secretario/firma-secretario').then((m) => m.FirmaSecretarioComponent)
  },
  {
    path: 'firma-secretaria-general',
    canActivate: [authGuard],
    loadComponent: () => import('./features/firma-secretario/firma-secretario').then((m) => m.FirmaSecretarioComponent)
  },
  {
    path: 'diplomas/firma-secretaria-general',
    canActivate: [authGuard],
    loadComponent: () => import('./features/firma-secretario/firma-secretario').then((m) => m.FirmaSecretarioComponent)
  },
  {
    path: 'firma-rector',
    canActivate: [authGuard],
    loadComponent: () => import('./features/firma-secretario/firma-secretario').then((m) => m.FirmaSecretarioComponent)
  },
  {
    path: 'registro-control',
    canActivate: [authGuard],
    loadComponent: () => import('./features/registro-control/registro-control').then((m) => m.RegistroControlComponent)
  },
  {
    path: 'diplomas/registro-control',
    canActivate: [authGuard],
    loadComponent: () => import('./features/registro-control/registro-control').then((m) => m.RegistroControlComponent)
  },
  {
    path: 'diplomas/firma-rector',
    canActivate: [authGuard],
    loadComponent: () => import('./features/firma-secretario/firma-secretario').then((m) => m.FirmaSecretarioComponent)
  },
  { path: '**', redirectTo: '' }
];
