import { PeriodoSelectorComponent } from '../../../core/periodo-selector';
import { PeriodoAcademicoService } from '../../../core/services/periodo-academico.service';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, effect, computed, inject, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
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

import { CeremoniaResumen, DatosDiplomaEstudiante, EstudianteProgramaCeremonia, EstudiantesProgramaCeremoniaResult, ParametrizacionRegistro, ProgramaAprobadoResumen, TableroCeremoniasResult } from '../../../core/models/ceremonia.model';
import { DiplomasApiService } from '../../../core/services/diplomas-api.service';

type EstadoCeremonia = 'idle' | 'cargando' | 'guardando' | 'asignando' | 'detalle' | 'éxito' | 'error';

interface UsuarioAutenticadoStorage {
  user?: { documento?: string | number };
  userService?: { documento?: string | number };
}

@Component({
  selector: 'diplomas-mf-nueva-ceremonia',
  imports: [PeriodoSelectorComponent, CommonModule, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatDatepickerModule, MatProgressSpinnerModule, MatSnackBarModule],
  providers: [provideNativeDateAdapter()],
  templateUrl: './nueva-ceremonia.html',
  styleUrl: './nueva-ceremonia.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NuevaCeremoniaComponent implements OnInit {
  private readonly api = inject(DiplomasApiService);
  readonly periodo = inject(PeriodoAcademicoService);
  constructor() {
    effect(() => {
      const seleccionado = this.periodo.seleccionado();
      untracked(() => {
        ++this.cargaTablero;
        ++this.cargaDetalle;
        ++this.cargaRegistro;
        this.limpiarFormulario();
        this.registroForm.reset();
        this.parametrizacionRegistro.set(null);
        this.editModalAbierto.set(false);
        this.tablero.set(null);
        this.programaAsignacion.set(null);
        this.ceremoniaAsignacion.set(null);
        this.detallePrograma.set(null);
        this.detalleAbierto.set(false);
        this.selectorCeremoniaAbierto.set(false);
        this.estado.set('idle');
        this.error.set(null);
        this.incidenciasAprobados.set(null);
        if (seleccionado?.Id && seleccionado.Id > 0) void this.cargarTablero();
      });
    });
  }
  private cargaTablero = 0;
  private cargaDetalle = 0;
  private cargaRegistro = 0;
  readonly confirmarCambioPeriodo = (): boolean =>
    !(this.form.dirty || this.registroForm.dirty) ||
    window.confirm('Hay cambios sin guardar. ¿Desea descartarlos y cambiar de período?');

  private readonly snackBar = inject(MatSnackBar);

  readonly estado = signal<EstadoCeremonia>('idle');
  readonly error = signal<string | null>(null);
  readonly incidenciasAprobados = signal<{ cantidad: number; detalles: { codigo_estudiante: number; error: string }[] } | null>(null);
  readonly tablero = signal<TableroCeremoniasResult | null>(null);
  readonly editandoId = signal<number | null>(null);
  readonly editModalAbierto = signal(false);
  readonly ceremoniaAsignacion = signal<CeremoniaResumen | null>(null);
  readonly programaAsignacion = signal<ProgramaAprobadoResumen | null>(null);
  readonly detallePrograma = signal<EstudiantesProgramaCeremoniaResult | null>(null);
  readonly detalleAbierto = signal(false);
  readonly selectorCeremoniaAbierto = signal(false);
  readonly documentoSecretario = signal<number | null>(this.obtenerDocumentoAutenticado());
  readonly parametrizacionRegistro = signal<ParametrizacionRegistro | null>(null);

  readonly form = new FormGroup({
    periodo_id: new FormControl<number | null>(null, {validators: [Validators.required, Validators.min(1)]}),
    fecha_ceremonia: new FormControl<Date | null>(null, { validators: [Validators.required] }),
    lugar: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    cantidad_estudiantes_programada: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(1)] }),
    observacion: new FormControl<string>('', { nonNullable: true })
  });

  readonly registroForm = new FormGroup({
    vigencia: new FormControl<number>(new Date().getFullYear(), { nonNullable: true, validators: [Validators.required, Validators.min(2000)] }),
    libro_inicial: new FormControl<number>(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    folio_inicial: new FormControl<number>(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    registro_inicial: new FormControl<number>(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    consecutivo_facultad_inicial: new FormControl<number>(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    folios_por_libro: new FormControl<number>(200, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    registros_por_folio: new FormControl<number>(5, { nonNullable: true, validators: [Validators.required, Validators.min(1)] })
  });

  readonly guardando = computed(() => this.estado() === 'guardando');
  readonly asignando = computed(() => this.estado() === 'asignando');
  readonly cargando = computed(() => this.estado() === 'cargando');
  readonly cargandoDetalle = computed(() => this.estado() === 'detalle');
  readonly modoEdicion = computed(() => this.editandoId() !== null);
  readonly ceremoniaEditando = computed(() => (this.tablero()?.ceremonias ?? []).find((ceremonia) => ceremonia.id === this.editandoId()) ?? null);
  readonly programasPendientes = computed(() => {
    const tablero = this.tablero();
    if (tablero?.pendientes_programas) return tablero.pendientes_programas;
    return (tablero?.aprobados_programas ?? []).map(programa => ({
      ...programa,
      cantidad: Math.max(0, programa.cantidad - (tablero?.asignados_programas ?? [])
        .filter(asignado => asignado.programa_academico_id === programa.programa_academico_id)
        .reduce((total, asignado) => total + asignado.cantidad, 0))
    })).filter(programa => programa.cantidad > 0);
  });
  readonly programasAsignados = computed(() => this.tablero()?.asignados_programas ?? []);

  async ngOnInit(): Promise<void> {
    // El efecto carga el contexto únicamente después de seleccionar un período.
  }

  async cargarTablero(): Promise<void> {
    const periodo = this.periodo.seleccionado();
    if (!periodo || periodo.Id <= 0) return;
    const documento = this.documentoSecretario();
    if (!documento) {
      this.error.set('No fue posible identificar el documento del usuario autenticado.');
      this.estado.set('error');
      return;
    }
    const carga = ++this.cargaTablero;
    this.tablero.set(null);
    this.error.set(null);
    this.estado.set('cargando');
    this.incidenciasAprobados.set(null);
    try {
      const aprobados = await firstValueFrom(this.api.getEstudiantesAprobados()) as { errores?: number; estudiantes_con_error?: { codigo_estudiante: number; error: string }[] };
      if (carga !== this.cargaTablero || periodo !== this.periodo.seleccionado()) return;
      if (aprobados.errores && aprobados.errores > 0) {
        this.incidenciasAprobados.set({ cantidad: aprobados.errores, detalles: aprobados.estudiantes_con_error ?? [] });
      }
      const tablero = await firstValueFrom(this.api.getTableroCeremonias(documento));
      if (carga !== this.cargaTablero || periodo !== this.periodo.seleccionado()) return;
      this.tablero.set(tablero);
      this.sincronizarVigenciaRegistro();
      await this.cargarParametrizacionRegistro();
      if (carga !== this.cargaTablero || periodo !== this.periodo.seleccionado()) return;
      if (!this.error()) this.estado.set('idle');
    } catch (error) {
      if (carga !== this.cargaTablero || periodo !== this.periodo.seleccionado()) return;
      this.error.set(error instanceof Error ? error.message : 'No fue posible cargar las ceremonias.');
      this.estado.set('error');
    }
  }

  async cargarParametrizacionRegistro(): Promise<void> {
    const periodo = this.periodo.seleccionado();
    if (!periodo || periodo.Id <= 0) return;
    const documento = this.documentoSecretario();
    const vigencia = Number(this.registroForm.controls.vigencia.value);
    if (!documento || !vigencia) {
      return;
    }
    const carga = ++this.cargaRegistro;
    try {
      const parametrizacion = await firstValueFrom(this.api.getParametrizacionRegistro(documento, vigencia));
      if (carga !== this.cargaRegistro || periodo !== this.periodo.seleccionado() || vigencia !== Number(this.registroForm.controls.vigencia.value)) return;
      this.parametrizacionRegistro.set(parametrizacion);
      this.registroForm.patchValue({
        vigencia,
        libro_inicial: parametrizacion.libro_inicial || 1,
        folio_inicial: parametrizacion.folio_inicial || 1,
        registro_inicial: parametrizacion.registro_inicial || 1,
        consecutivo_facultad_inicial: parametrizacion.consecutivo_facultad_inicial || 1,
        folios_por_libro: parametrizacion.folios_por_libro || 200,
        registros_por_folio: parametrizacion.registros_por_folio || 5
      });
      this.registroForm.markAsPristine();
    } catch (error) {
      if (carga !== this.cargaRegistro || periodo !== this.periodo.seleccionado() || vigencia !== Number(this.registroForm.controls.vigencia.value)) return;
      this.error.set(error instanceof Error ? error.message : 'No fue posible cargar la parametrización de registro.');
      this.estado.set('error');
    }
  }

  async guardarParametrizacionRegistro(): Promise<void> {
    this.registroForm.markAllAsTouched();
    const periodo = this.periodo.seleccionado();
    const documento = this.documentoSecretario();
    if (!this.periodo.seleccionado() || !documento || this.registroForm.invalid || this.guardando()) {
      return;
    }
    this.estado.set('guardando');
    this.error.set(null);
    try {
      const payload = {
        documento_identidad_secretario: documento,
        vigencia: Number(this.registroForm.controls.vigencia.value),
        libro_inicial: Number(this.registroForm.controls.libro_inicial.value),
        folio_inicial: Number(this.registroForm.controls.folio_inicial.value),
        registro_inicial: Number(this.registroForm.controls.registro_inicial.value),
        consecutivo_facultad_inicial: Number(this.registroForm.controls.consecutivo_facultad_inicial.value),
        folios_por_libro: Number(this.registroForm.controls.folios_por_libro.value),
        registros_por_folio: Number(this.registroForm.controls.registros_por_folio.value)
      };
      const result = await firstValueFrom(this.api.guardarParametrizacionRegistro(payload));
      if (periodo !== this.periodo.seleccionado()) return;
      this.parametrizacionRegistro.set(result);
      this.registroForm.markAsPristine();
      this.estado.set('idle');
      this.snackBar.open('Parametrización de registro guardada correctamente.', 'Cerrar', { duration: 4500, panelClass: ['snackbar-success'] });
    } catch (error) {
      if (periodo !== this.periodo.seleccionado()) return;
      this.error.set(error instanceof Error ? error.message : 'No fue posible guardar la parametrización de registro.');
      this.estado.set('error');
    }
  }

  async guardar(formDirective?: FormGroupDirective, panel?: HTMLDetailsElement): Promise<void> {
    this.error.set(null);
    this.form.controls.periodo_id.setValue(this.periodo.seleccionado()?.Id ?? null);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.guardando()) {
      return;
    }

    const periodo = this.periodo.seleccionado();
    const documento = this.documentoSecretario();
    if (!documento) {
      this.error.set('No fue posible identificar el documento del usuario autenticado.');
      this.estado.set('error');
      return;
    }

    const payload = {
      periodo_id: Number(this.form.controls.periodo_id.value),
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
        if (periodo !== this.periodo.seleccionado()) return;
        this.snackBar.open('Ceremonia actualizada correctamente.', 'Cerrar', { duration: 4500, panelClass: ['snackbar-success'] });
      } else {
        await firstValueFrom(this.api.crearCeremonia(payload));
        if (periodo !== this.periodo.seleccionado()) return;
        this.snackBar.open('Ceremonia creada correctamente.', 'Cerrar', { duration: 4500, panelClass: ['snackbar-success'] });
      }
      this.estado.set('éxito');
      this.cerrarEdicion();
      formDirective?.resetForm({periodo_id: this.periodo.seleccionado()?.Id ?? null});
      if (panel) panel.open = false;
      await this.cargarTablero();
    } catch (error) {
      if (periodo !== this.periodo.seleccionado()) return;
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
    const periodo = this.periodo.seleccionado();
    if (!periodo) return;
    const documento = this.documentoSecretario();
    if (!documento) {
      return;
    }
    const carga = ++this.cargaDetalle;
    this.estado.set('detalle');
    this.error.set(null);
    this.detallePrograma.set(null);
    try {
      const detalle = await firstValueFrom(this.api.getEstudiantesProgramaCeremonia(programa.programa_academico_id, documento));
      if (carga !== this.cargaDetalle || periodo !== this.periodo.seleccionado()) return;
      this.detallePrograma.set(detalle);
      this.estado.set('idle');
    } catch (error) {
      if (carga !== this.cargaDetalle || periodo !== this.periodo.seleccionado()) return;
      this.error.set(error instanceof Error ? error.message : 'No fue posible consultar estudiantes del programa.');
      this.estado.set('error');
    }
  }

  cerrarDetalle(): void {
    ++this.cargaDetalle;
    if (this.cargandoDetalle()) this.estado.set('idle');
    this.detalleAbierto.set(false);
    this.selectorCeremoniaAbierto.set(false);
  }

  abrirSelectorCeremonia(): void {
    this.selectorCeremoniaAbierto.set(true);
  }

  ceremoniasDisponiblesParaPrograma(): CeremoniaResumen[] {
    const cantidad = this.programaAsignacion()?.cantidad ?? 0;
    return (this.tablero()?.ceremonias ?? []).filter((ceremonia) => ceremonia.periodo_id === this.periodo.seleccionado()?.Id && ceremonia.cupos_disponibles >= cantidad);
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
    const periodo = this.periodo.seleccionado();
    const documento = this.documentoSecretario();
    if (!ceremonia || !programa || !documento || this.asignando()) {
      return;
    }
    if (!ceremonia.periodo_id || ceremonia.periodo_id !== this.periodo.seleccionado()?.Id) {
      this.error.set('Seleccione una ceremonia configurada para el mismo período de los aprobados.');
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
      if (periodo !== this.periodo.seleccionado()) return;
      if (result.errores > 0) {
        const mensaje = `Asignados: ${result.asignados}. Omitidos: ${result.omitidos}. Errores: ${result.errores}. No fue posible completar la asignación; intente nuevamente.`;
        this.selectorCeremoniaAbierto.set(false);
        await this.cargarTablero();
        if (periodo !== this.periodo.seleccionado()) return;
        this.error.set(mensaje);
        this.estado.set('error');
        this.snackBar.open(mensaje, 'Cerrar', { duration: 8000 });
        return;
      }
      this.snackBar.open(result.asignados > 0
        ? `Programa asignado: ${result.asignados} estudiantes.`
        : `No se registraron nuevas asignaciones. Omitidos: ${result.omitidos}.`,
        'Cerrar', { duration: 5000, ...(result.asignados > 0 ? { panelClass: ['snackbar-success'] } : {}) });
      this.cerrarDetalle();
      this.cancelarAsignacion();
      this.programaAsignacion.set(null);
      this.detallePrograma.set(null);
      await this.cargarTablero();
    } catch (error) {
      if (periodo !== this.periodo.seleccionado()) return;
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
    const periodo = this.periodo.seleccionado();
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
      if (periodo !== this.periodo.seleccionado()) return;
      this.snackBar.open(`Programa retirado: ${result.asignados} estudiantes liberados.`, 'Cerrar', { duration: 4500, panelClass: ['snackbar-success'] });
      await this.cargarTablero();
    } catch (error) {
      if (periodo !== this.periodo.seleccionado()) return;
      this.error.set(error instanceof Error ? error.message : 'No fue posible quitar el programa de la ceremonia.');
      this.estado.set('error');
    }
  }

  editar(ceremonia: CeremoniaResumen): void {
    if (ceremonia.puede_editar === false) {
      this.snackBar.open(ceremonia.motivo_bloqueo || 'La ceremonia ya inició el flujo de diplomas y no puede editarse.', 'Cerrar', { duration: 5000 });
      return;
    }
    if (ceremonia.periodo_id !== this.periodo.seleccionado()?.Id) return;

    this.editandoId.set(ceremonia.id);
    this.form.patchValue({
      periodo_id: ceremonia.periodo_id ?? null,
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
    if (ceremonia.cupos_asignados > 0 || ceremonia.puede_eliminar === false) {
      this.snackBar.open(ceremonia.motivo_bloqueo || 'La ceremonia tiene estudiantes asignados y no puede eliminarse.', 'Cerrar', { duration: 5000 });
      return;
    }
    const periodo = this.periodo.seleccionado();
    const documento = this.documentoSecretario();
    if (!documento || !confirm(`¿Eliminar la ceremonia del ${this.fechaLegible(ceremonia.fecha_ceremonia)} en ${ceremonia.lugar}?`)) {
      return;
    }
    this.estado.set('guardando');
    try {
      await firstValueFrom(this.api.eliminarCeremonia(ceremonia.id, documento));
      if (periodo !== this.periodo.seleccionado()) return;
      this.snackBar.open('Ceremonia eliminada correctamente.', 'Cerrar', { duration: 4500, panelClass: ['snackbar-success'] });
      await this.cargarTablero();
    } catch (error) {
      if (periodo !== this.periodo.seleccionado()) return;
      this.error.set(error instanceof Error ? error.message : 'No fue posible eliminar la ceremonia.');
      this.estado.set('error');
    }
  }

  limpiarFormulario(): void {
    this.editandoId.set(null);
    this.form.reset({periodo_id: this.periodo.seleccionado()?.Id ?? null});
  }

  nombrePeriodo(id?: number): string {
    return this.periodo.periodos().find(p => p.Id === id)?.Nombre ?? (id ? 'Período no disponible' : 'Sin configurar');
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

  private sincronizarVigenciaRegistro(): void {
    const primeraFecha = this.tablero()?.ceremonias?.[0]?.fecha_ceremonia;
    const year = primeraFecha ? Number(this.fechaInput(primeraFecha).slice(0, 4)) : new Date().getFullYear();
    if (Number.isInteger(year) && year > 0) {
      this.registroForm.controls.vigencia.setValue(year);
    }
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
