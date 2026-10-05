import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

interface ModuloDiplomas {
  titulo: string;
  descripcion: string;
  icono: string;
  ruta?: string;
  habilitado: boolean;
}

@Component({
  selector: 'diplomas-mf-inicio',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InicioComponent {
  readonly modulos: ModuloDiplomas[] = [
    {
      titulo: 'Gestionar firmas',
      descripcion: 'Validacion y cargue de firmas para firmantes autorizados.',
      icono: 'draw',
      ruta: '/firmas',
      habilitado: true
    },
    {
      titulo: 'Gestionar ceremonias',
      descripcion: 'Programacion y asociacion de facultades, programas y estudiantes.',
      icono: 'event',
      ruta: '/ceremonias',
      habilitado: true
    }
  ];
}
