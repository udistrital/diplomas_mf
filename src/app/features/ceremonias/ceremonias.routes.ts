import { Routes } from '@angular/router';

import { NuevaCeremoniaComponent } from './nueva-ceremonia/nueva-ceremonia';

export const CEREMONIAS_ROUTES: Routes = [
  { path: '', component: NuevaCeremoniaComponent },
  { path: 'nueva', pathMatch: 'full', redirectTo: '' }
];
