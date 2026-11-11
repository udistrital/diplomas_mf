import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import { DiplomasApiService } from '../../core/services/diplomas-api.service';
import { RegistroControlCatalogo } from '../../core/models/ceremonia.model';

@Component({
  selector: 'diplomas-mf-registro-control',
  imports: [DatePipe, FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule],
  templateUrl: './registro-control.html',
  styleUrl: './registro-control.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegistroControlComponent implements OnInit {
  private readonly api = inject(DiplomasApiService);
  readonly descargando = signal(false);
  readonly cargando = signal(true);
  readonly mensaje = signal<string | null>(null);
  readonly catalogo = signal<RegistroControlCatalogo>({ facultades: [] });
  readonly facultadId = signal<number | null>(null);
  readonly ceremoniaId = signal<number | null>(null);
  readonly ceremonias = computed(() => {
    const facultad = this.catalogo().facultades.find((item) => item.id === this.facultadId());
    return facultad?.ceremonias ?? [];
  });
  readonly diplomasDisponibles = computed(() => {
    const ceremoniaId = this.ceremoniaId();
    if (ceremoniaId !== null) {
      return this.ceremonias().find((item) => item.id === ceremoniaId)?.diplomas_disponibles ?? 0;
    }
    if (this.facultadId() !== null) {
      return this.ceremonias().reduce((total, item) => total + item.diplomas_disponibles, 0);
    }
    return this.catalogo().facultades.reduce(
      (total, facultad) => total + facultad.ceremonias.reduce((subtotal, item) => subtotal + item.diplomas_disponibles, 0),
      0
    );
  });

  ngOnInit(): void {
    this.api.getOpcionesRegistroControl()
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (catalogo) => this.catalogo.set(catalogo),
        error: () => this.mensaje.set('No fue posible cargar facultades y ceremonias disponibles.')
      });
  }

  seleccionarFacultad(facultadId: number | null): void {
    this.facultadId.set(facultadId);
    this.ceremoniaId.set(null);
  }

  seleccionarCeremonia(ceremoniaId: number | null): void {
    this.ceremoniaId.set(ceremoniaId);
    if (ceremoniaId !== null && this.diplomasDisponibles() === 0) {
      this.mensaje.set('Esta ceremonia todavía no tiene diplomas originales almacenados en S3.');
    } else {
      this.mensaje.set(null);
    }
  }

  descargar(): void {
    if (this.descargando()) return;
    this.descargando.set(true);
    this.mensaje.set(null);
    this.api.descargarDiplomasRegistroControl(this.facultadId() ?? undefined, this.ceremoniaId() ?? undefined)
      .pipe(finalize(() => this.descargando.set(false)))
      .subscribe({
        next: (archivo) => {
          const url = URL.createObjectURL(archivo);
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = 'diplomas_registro_control.zip';
          enlace.click();
          URL.revokeObjectURL(url);
          this.mensaje.set('Archivo ZIP generado correctamente.');
        },
        error: (error) => void this.mostrarErrorDescarga(error)
      });
  }

  private async mostrarErrorDescarga(error: unknown): Promise<void> {
    let detalle = '';
    if (error instanceof HttpErrorResponse && error.error instanceof Blob) {
      try {
        const payload = JSON.parse(await error.error.text()) as { error?: string };
        detalle = payload.error?.trim() ?? '';
      } catch {
        // La respuesta no contiene JSON legible.
      }
    }
    this.mensaje.set(detalle || 'No fue posible descargar los diplomas. Verifique los filtros y permisos.');
  }
}
