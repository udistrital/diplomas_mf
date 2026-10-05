import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { CeremoniaResumen, DatosDiplomaEstudiante, EstudianteProgramaCeremonia, EstudiantesProgramaCeremoniaResult, ProgramaAprobadoResumen, TableroCeremoniasResult } from '../../../core/models/ceremonia.model';
import { DiplomasApiService } from '../../../core/services/diplomas-api.service';

type EstadoCeremonia = 'idle' | 'cargando' | 'guardando' | 'asignando' | 'detalle' | 'éxito' | 'error';

interface UsuarioAutenticadoStorage {
  user?: { documento?: string | number };
  userService?: { documento?: string | number };
}

@Component({
  selector: 'diplomas-mf-nueva-ceremonia',
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatDatepickerModule, MatProgressSpinnerModule, MatSnackBarModule],
  providers: [provideNativeDateAdapter()],
  templateUrl: './nueva-ceremonia.html',
  styleUrl: './nueva-ceremonia.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NuevaCeremoniaComponent implements OnInit {
  private readonly api = inject(DiplomasApiService);
  private readonly snackBar = inject(MatSnackBar);

  readonly estado = signal<EstadoCeremonia>('idle');
  readonly error = signal<string | null>(null);
  readonly tablero = signal<TableroCeremoniasResult | null>(null);
  readonly editandoId = signal<number | null>(null);
  readonly editModalAbierto = signal(false);
  readonly ceremoniaAsignacion = signal<CeremoniaResumen | null>(null);
  readonly programaAsignacion = signal<ProgramaAprobadoResumen | null>(null);
  readonly detallePrograma = signal<EstudiantesProgramaCeremoniaResult | null>(null);
  readonly detalleAbierto = signal(false);
  readonly selectorCeremoniaAbierto = signal(false);
  readonly documentoSecretario = signal<number | null>(this.obtenerDocumentoAutenticado());

  readonly form = new FormGroup({
    fecha_ceremonia: new FormControl<Date | null>(null, { validators: [Validators.required] }),
    lugar: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    cantidad_estudiantes_programada: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(1)] }),
    observacion: new FormControl<string>('', { nonNullable: true })
  });

  readonly guardando = computed(() => this.estado() === 'guardando');
  readonly asignando = computed(() => this.estado() === 'asignando');
  readonly cargando = computed(() => this.estado() === 'cargando');
  readonly cargandoDetalle = computed(() => this.estado() === 'detalle');
  readonly modoEdicion = computed(() => this.editandoId() !== null);
  readonly ceremoniaEditando = computed(() => (this.tablero()?.ceremonias ?? []).find((ceremonia) => ceremonia.id === this.editandoId()) ?? null);
  readonly programasPendientes = computed(() => this.tablero()?.pendientes_programas ?? this.tablero()?.aprobados_programas ?? []);
  readonly programasAsignados = computed(() => this.tablero()?.asignados_programas ?? []);

  async ngOnInit(): Promise<void> {
    await this.cargarTablero();
  }

  async cargarTablero(): Promise<void> {
    const documento = this.documentoSecretario();
    if (!documento) {
      this.error.set('No fue posible identificar el documento del usuario autenticado.');
      this.estado.set('error');
      return;
    }
    this.estado.set('cargando');
    try {
      this.tablero.set(await firstValueFrom(this.api.getTableroCeremonias(documento)));
      this.estado.set('idle');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No fue posible cargar las ceremonias.');
      this.estado.set('error');
    }
  }

  async guardar(): Promise<void> {
    this.error.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.guardando()) {
      return;
    }

    const documento = this.documentoSecretario();
    if (!documento) {
      this.error.set('No fue posible identificar el documento del usuario autenticado.');
      this.estado.set('error');
      return;
    }

    const payload = {
      fecha_ceremonia: this.fechaPayload(this.form.controls.fecha_ceremonia.value),
      lugar: this.form.controls.lugar.value.trim(),
      cantidad_estudiantes_programada: Number(this.form.controls.cantidad_estudiantes_programada.value),
      observacion: this.form.controls.observacion.value.trim() || undefined,
      documento_identidad_secretario: documento
    };

    const ceremonia = this.ceremoniaEditando();
    if (ceremonia && payload.cantidad_estudiantes_programada < ceremonia.cupos_asignados) {
      this.snackBar.open('Los cupos no pueden ser menores a los estudiantes ya asignados.', 'Cerrar', { duration: 4500 });
      return;
    }

    this.estado.set('guardando');
    try {
      const id = this.editandoId();
      if (id) {
        await firstValueFrom(this.api.actualizarCeremonia(id, payload));
        this.snackBar.open('Ceremonia actualizada correctamente.', 'Cerrar', { duration: 4500, panelClass: ['snackbar-success'] });
      } else {
        await firstValueFrom(this.api.crearCeremonia(payload));
        this.snackBar.open('Ceremonia creada correctamente.', 'Cerrar', { duration: 4500, panelClass: ['snackbar-success'] });
      }
      this.estado.set('éxito');
      this.cerrarEdicion();
      await this.cargarTablero();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No fue posible guardar la ceremonia.');
      this.estado.set('error');
    }
  }

  seleccionarAsignacion(ceremonia: CeremoniaResumen): void {
    this.ceremoniaAsignacion.set(ceremonia);
  }

  cancelarAsignacion(): void {
    this.ceremoniaAsignacion.set(null);
    this.selectorCeremoniaAbierto.set(false);
  }

  async seleccionarPrograma(programa: ProgramaAprobadoResumen): Promise<void> {
    this.programaAsignacion.set(programa);
    this.detalleAbierto.set(true);
    await this.cargarDetallePrograma(programa);
  }

  async cargarDetallePrograma(programa: ProgramaAprobadoResumen): Promise<void> {
    const documento = this.documentoSecretario();
    if (!documento) {
      return;
    }
    this.estado.set('detalle');
    this.detallePrograma.set(null);
    try {
      this.detallePrograma.set(await firstValueFrom(this.api.getEstudiantesProgramaCeremonia(programa.programa_academico_id, documento)));
      this.estado.set('idle');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No fue posible consultar estudiantes del programa.');
      this.estado.set('error');
    }
  }

  cerrarDetalle(): void {
    this.detalleAbierto.set(false);
    this.selectorCeremoniaAbierto.set(false);
  }

  abrirSelectorCeremonia(): void {
    this.selectorCeremoniaAbierto.set(true);
  }

  ceremoniasDisponiblesParaPrograma(): CeremoniaResumen[] {
    const cantidad = this.programaAsignacion()?.cantidad ?? 0;
    return (this.tablero()?.ceremonias ?? []).filter((ceremonia) => ceremonia.cupos_disponibles >= cantidad);
  }

  totalSeleccionadoAsignacion(): number {
    return this.programaAsignacion()?.cantidad ?? 0;
  }

  async asignarACeremonia(ceremonia: CeremoniaResumen): Promise<void> {
    this.ceremoniaAsignacion.set(ceremonia);
    await this.asignarEstudiantes();
  }

  async asignarEstudiantes(): Promise<void> {
    const ceremonia = this.ceremoniaAsignacion();
    const programa = this.programaAsignacion();
    const documento = this.documentoSecretario();
    if (!ceremonia || !programa || !documento || this.asignando()) {
      return;
    }
    if (programa.cantidad > ceremonia.cupos_disponibles) {
      this.snackBar.open('El programa completo supera los cupos disponibles de la ceremonia.', 'Cerrar', { duration: 4500 });
      return;
    }

    this.estado.set('asignando');
    this.error.set(null);
    try {
      const result = await firstValueFrom(this.api.asignarEstudiantesCeremonia(ceremonia.id, { documento_identidad_secretario: documento, programas: [{ programa_academico_id: programa.programa_academico_id }] }));
      this.snackBar.open(`Programa asignado: ${result.asignados} estudiantes.`, 'Cerrar', { duration: 5000, panelClass: ['snackbar-success'] });
      this.cerrarDetalle();
      this.cancelarAsignacion();
      this.programaAsignacion.set(null);
      this.detallePrograma.set(null);
      await this.cargarTablero();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No fue posible asignar el programa a la ceremonia.');
      this.estado.set('error');
    }
  }

  datosDiploma(estudiante: EstudianteProgramaCeremonia): DatosDiplomaEstudiante | null {
    const raw = estudiante as EstudianteProgramaCeremonia & { DatosDiploma?: DatosDiplomaEstudiante };
    return estudiante.datos_diploma ?? raw.DatosDiploma ?? null;
  }

  async quitarPrograma(programa: ProgramaAprobadoResumen): Promise<void> {
    if (programa.puede_reasignar === false) {
      this.snackBar.open(programa.motivo_bloqueo || 'El programa ya inició el flujo de diplomas y no puede reasignarse.', 'Cerrar', { duration: 5000 });
      return;
    }
    const documento = this.documentoSecretario();
    if (!documento || !programa.ceremonia_id) {
      return;
    }
    if (!confirm(`¿Quitar ${programa.nombre} de la ceremonia?`)) {
      return;
    }
    this.estado.set('asignando');
    try {
      const result = await firstValueFrom(this.api.quitarProgramaCeremonia(programa.ceremonia_id, { documento_identidad_secretario: documento, programa_academico_id: programa.programa_academico_id }));
      this.snackBar.open(`Programa retirado: ${result.asignados} estudiantes liberados.`, 'Cerrar', { duration: 4500, panelClass: ['snackbar-success'] });
      await this.cargarTablero();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No fue posible quitar el programa de la ceremonia.');
      this.estado.set('error');
    }
  }

  editar(ceremonia: CeremoniaResumen): void {
    if (ceremonia.puede_editar === false) {
      this.snackBar.open(ceremonia.motivo_bloqueo || 'La ceremonia ya inició el flujo de diplomas y no puede editarse.', 'Cerrar', { duration: 5000 });
      return;
    }
    this.editandoId.set(ceremonia.id);
    this.form.patchValue({
      fecha_ceremonia: this.fechaDate(ceremonia.fecha_ceremonia),
      lugar: ceremonia.lugar,
      cantidad_estudiantes_programada: ceremonia.cantidad_estudiantes_programada,
      observacion: ceremonia.observacion ?? ''
    });
    this.editModalAbierto.set(true);
  }

  cerrarEdicion(): void {
    this.editModalAbierto.set(false);
    this.limpiarFormulario();
  }

  async eliminar(ceremonia: CeremoniaResumen): Promise<void> {
    if (ceremonia.puede_eliminar === false) {
      this.snackBar.open(ceremonia.motivo_bloqueo || 'La ceremonia tiene estudiantes asignados y no puede eliminarse.', 'Cerrar', { duration: 5000 });
      return;
    }
    const documento = this.documentoSecretario();
    if (!documento || !confirm(`¿Eliminar la ceremonia del ${this.fechaLegible(ceremonia.fecha_ceremonia)} en ${ceremonia.lugar}?`)) {
      return;
    }
    this.estado.set('guardando');
    try {
      await firstValueFrom(this.api.eliminarCeremonia(ceremonia.id, documento));
      this.snackBar.open('Ceremonia eliminada correctamente.', 'Cerrar', { duration: 4500, panelClass: ['snackbar-success'] });
      await this.cargarTablero();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No fue posible eliminar la ceremonia.');
      this.estado.set('error');
    }
  }

  limpiarFormulario(): void {
    this.editandoId.set(null);
    this.form.reset();
  }

  fechaInput(value: string): string {
    return String(value || '').slice(0, 10);
  }

  fechaDate(value: string): Date | null {
    const fecha = this.fechaInput(value);
    return fecha ? new Date(`${fecha}T00:00:00`) : null;
  }

  fechaPayload(value: Date | null): string {
    if (!value) {
      return '';
    }
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  fechaLegible(value: string): string {
    const fecha = this.fechaInput(value);
    if (!fecha) {
      return 'Sin fecha';
    }
    const [year, month, day] = fecha.split('-');
    return `${day}/${month}/${year}`;
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
