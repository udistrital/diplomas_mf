import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { FirmanteActivo, SubirFirmaFirmanteResult } from '../../../core/models/firmante.model';
import { DiplomasApiService } from '../../../core/services/diplomas-api.service';

type EstadoFirma =
  | 'idle'
  | 'validando firmante'
  | 'firmante válido'
  | 'firmante no autorizado'
  | 'archivo seleccionado'
  | 'subiendo'
  | 'exito'
  | 'error';

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const TIPO_DOCUMENTO_FIRMA = 38;

interface UsuarioAutenticadoStorage {
  user?: {
    documento?: string | number;
  };
  userService?: {
    documento?: string | number;
  };
}

@Component({
  selector: 'diplomas-mf-cargar-firma',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './cargar-firma.html',
  styleUrl: './cargar-firma.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CargarFirmaComponent {
  private readonly api = inject(DiplomasApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly validarFirmanteForm = new FormGroup({
    documento: new FormControl<number | null>(null, {
      nonNullable: false,
      validators: [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]
    })
  });

  readonly estado = signal<EstadoFirma>('idle');
  readonly loadingFirmante = signal(false);
  readonly firmante = signal<FirmanteActivo | null>(null);
  readonly firmanteError = signal<string | null>(null);
  readonly archivo = signal<File | null>(null);
  readonly archivoError = signal<string | null>(null);
  readonly previewUrl = signal<string | null>(null);
  readonly subiendoFirma = signal(false);
  readonly resultado = signal<SubirFirmaFirmanteResult | null>(null);
  readonly error = signal<string | null>(null);

  readonly puedeSeleccionarArchivo = computed(() => this.firmante() !== null && !this.loadingFirmante());
  readonly puedeSubir = computed(() => this.firmante() !== null && this.archivo() !== null && !this.subiendoFirma());
  readonly enlaceFirmaActual = computed(() =>
    this.resultado()?.enlace_firma
    ?? this.firmante()?.firma_firmante?.enlace_firma
    ?? this.firmante()?.enlace_firma
    ?? null
  );
  readonly firmaImagenActual = computed(() => this.firmante()?.firma_imagen ?? null);

  constructor() {
    this.precargarDocumentoAutenticado();
    this.destroyRef.onDestroy(() => this.liberarPreview());
  }

  async validarFirmante(): Promise<void> {
    this.firmanteError.set(null);
    this.error.set(null);
    this.resultado.set(null);
    const documento = this.validarFirmanteForm.controls.documento.value;

    if (!documento || this.validarFirmanteForm.controls.documento.invalid) {
      this.firmante.set(null);
      this.firmanteError.set('Ingrese un documento de identidad válido.');
      this.estado.set('firmante no autorizado');
      return;
    }

    this.loadingFirmante.set(true);
    this.estado.set('validando firmante');
    try {
      const firmante = await firstValueFrom(this.api.getFirmanteActivo(documento));
      this.firmante.set(firmante);
      this.estado.set('firmante válido');
    } catch (error) {
      this.firmante.set(null);
      this.limpiarArchivo();
      this.firmanteError.set(error instanceof Error ? error.message : 'No se encontró un firmante activo para el documento ingresado.');
      this.estado.set('firmante no autorizado');
    } finally {
      this.loadingFirmante.set(false);
    }
  }

  onArchivoInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.onArchivoSeleccionado(input.files?.item(0) ?? null);
  }

  onArchivoSeleccionado(file: File | null): void {
    this.archivoError.set(null);
    this.error.set(null);
    this.resultado.set(null);
    this.liberarPreview();

    if (!file) {
      this.archivo.set(null);
      this.archivoError.set('Seleccione una imagen PNG de la firma.');
      return;
    }
    if (file.size <= 0) {
      this.archivo.set(null);
      this.archivoError.set('El archivo seleccionado está vacío.');
      return;
    }
    if (file.type !== 'image/png') {
      this.archivo.set(null);
      this.archivoError.set('El archivo seleccionado no tiene un formato válido. Use PNG.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      this.archivo.set(null);
      this.archivoError.set('El archivo supera el tamaño máximo permitido de 2 MB.');
      return;
    }

    this.archivo.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
    this.estado.set('archivo seleccionado');
  }

  limpiarArchivo(): void {
    this.archivo.set(null);
    this.archivoError.set(null);
    this.liberarPreview();
  }

  async subirFirma(): Promise<void> {
    const firmante = this.firmante();
    const archivo = this.archivo();
    if (!firmante || !archivo) {
      this.error.set('Valide el firmante y seleccione una firma PNG antes de cargar.');
      return;
    }

    this.subiendoFirma.set(true);
    this.estado.set('subiendo');
    this.error.set(null);
    this.resultado.set(null);

    try {
      const file = await this.fileToBase64(archivo);
      const result = await firstValueFrom(this.api.subirFirma({
        documento_identidad_firmante: firmante.documento_identidad,
        IdTipoDocumento: TIPO_DOCUMENTO_FIRMA,
        nombre: 'firma_diploma',
        descripcion: `firma diploma ${new Date().getFullYear()}`,
        metadatos: { vigencia: String(new Date().getFullYear()) },
        file
      }));
      this.resultado.set(result);
      this.estado.set('exito');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No fue posible cargar la firma. Intente nuevamente.');
      this.estado.set('error');
    } finally {
      this.subiendoFirma.set(false);
    }
  }

  formatoTamano(size: number): string {
    if (size < 1024) {
      return `${size} B`;
    }
    return `${(size / 1024).toFixed(1)} KB`;
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result ?? '');
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = () => reject(new Error('No fue posible leer el archivo seleccionado.'));
      reader.readAsDataURL(file);
    });
  }

  private liberarPreview(): void {
    const url = this.previewUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.previewUrl.set(null);
  }

  private precargarDocumentoAutenticado(): void {
    const documento = this.obtenerDocumentoAutenticado();
    if (!documento) {
      return;
    }

    this.validarFirmanteForm.controls.documento.setValue(documento, { emitEvent: false });
    this.validarFirmanteForm.controls.documento.disable({ emitEvent: false });
  }

  private obtenerDocumentoAutenticado(): number | null {
    const userStorage = localStorage.getItem('user');
    if (!userStorage) {
      return null;
    }

    try {
      const usuario = JSON.parse(atob(userStorage)) as UsuarioAutenticadoStorage;
      const documento = usuario.userService?.documento ?? usuario.user?.documento;
      const documentoNumerico = Number(documento);
      return Number.isInteger(documentoNumerico) && documentoNumerico > 0 ? documentoNumerico : null;
    } catch {
      return null;
    }
  }
}
