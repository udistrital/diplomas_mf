import { PeriodoSelectorComponent } from '../../core/periodo-selector';
import { PeriodoAcademicoService } from '../../core/services/periodo-academico.service';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, OnInit, OnDestroy, computed, inject, signal, untracked } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { finalize, firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { CeremoniaFirmaEstudianteResumen, CeremoniaFirmasResult, CeremoniaResumen, DiplomaPreviewResult, TableroCeremoniasResult } from '../../core/models/ceremonia.model';
import { FirmanteActivo } from '../../core/models/firmante.model';
import { DiplomasApiService } from '../../core/services/diplomas-api.service';

type EstadoFirmaSecretario = 'idle' | 'cargando' | 'estudiantes' | 'preview' | 'firmando' | 'error';

type FiltroEstado = 'todos' | 'pendientes' | 'firmados';
type ModoFirma = 'secretario' | 'decano' | 'secretaria-general' | 'rector';

interface FirmaModoConfig {
  titulo: string;
  descripcion: string;
  etiquetaPanel: string;
  etiquetaFirmado: string;
  etiquetaPendiente: string;
  rol: string;
  orden: number;
  errorRol: string;
  vacio: string;
}

interface UsuarioAutenticadoStorage {
  user?: { documento?: string | number };
  userService?: { documento?: string | number };
}

@Component({
  selector: 'diplomas-mf-firma-secretario',
  imports: [PeriodoSelectorComponent, CommonModule, FormsModule, MatButtonModule, MatCardModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule, MatSnackBarModule],
  templateUrl: './firma-secretario.html',
  styleUrl: './firma-secretario.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FirmaSecretarioComponent implements OnInit, OnDestroy {
  private readonly api = inject(DiplomasApiService);
  readonly periodo = inject(PeriodoAcademicoService);
  private cargaCeremonias = 0;
  private cargaEstudiantes = 0;
  private readonly periodoEffect = effect(() => {
    this.periodo.seleccionado();
    untracked(() => {
      ++this.cargaCeremonias;
      this.tablero.set(null);
      this.resumenFirmas.set(new Map());
      this.busquedaCeremonia.set('');
      this.limpiarContextoCeremonia();
      this.estado.set('idle');
      this.error.set(null);
      void this.cargarCeremonias();
    });
  });
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);

  readonly estado = signal<EstadoFirmaSecretario>('idle');
  readonly error = signal<string | null>(null);
  readonly tablero = signal<TableroCeremoniasResult | null>(null);
  readonly detalle = signal<CeremoniaFirmasResult | null>(null);
  readonly ceremoniaSeleccionada = signal<CeremoniaResumen | null>(null);
  readonly seleccionados = signal<Set<number>>(new Set());
  readonly preview = signal<DiplomaPreviewResult | null>(null);
  readonly previewUrl = signal<SafeResourceUrl | null>(null);
  readonly previewAbierto = signal(false);
  readonly documentoSecretario = signal<number | null>(this.obtenerDocumentoAutenticado());
  readonly firmante = signal<FirmanteActivo | null>(null);

  readonly modoFirma = computed<ModoFirma>(() => {
    const url = this.router.url;
    if (url.includes('firma-rector')) {
      return 'rector';
    }
    if (url.includes('firma-secretaria-general')) {
      return 'secretaria-general';
    }
    if (url.includes('firma-decano')) {
      return 'decano';
    }
    return 'secretario';
  });
  readonly modoConfig = computed<FirmaModoConfig>(() => this.configuracionModo(this.modoFirma()));
  readonly tituloPagina = computed(() => this.modoConfig().titulo);
  readonly descripcionPagina = computed(() => this.modoConfig().descripcion);
  readonly etiquetaRolPanel = computed(() => this.modoConfig().etiquetaPanel);
  readonly etiquetaFirmado = computed(() => this.modoConfig().etiquetaFirmado);
  readonly etiquetaPendiente = computed(() => this.modoConfig().etiquetaPendiente);
  readonly firmanteNombre = computed(() => this.firmante()?.nombre || 'Firmante identificado');
  readonly firmanteRol = computed(() => this.firmante()?.rol || this.modoConfig().rol);
  readonly firmanteCargo = computed(() => this.firmante()?.cargo || 'Cargo no disponible');
  readonly firmanteOrden = computed(() => this.firmante()?.orden ?? this.modoConfig().orden);
  readonly firmanteDocumento = computed(() => this.firmante()?.documento_identidad ?? this.documentoSecretario());
  readonly inicialesFirmante = computed(() => this.firmanteNombre().split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase() || 'F');

  // Filtros
  readonly busqueda = signal<string>('');
  readonly filtroPrograma = signal<string>('todos');
  readonly filtroEstado = signal<FiltroEstado>('todos');

  readonly cargando = computed(() => this.estado() === 'cargando' || this.estado() === 'estudiantes');
  readonly firmando = computed(() => this.estado() === 'firmando');
  readonly procesando = computed(() => this.cargando() || this.firmando());
  readonly firmanteTieneRubrica = computed(() => Boolean(this.firmante()?.enlace_firma || this.firmante()?.firma_firmante?.enlace_firma));
  readonly filtroCeremonia = signal<'pendientes' | 'completadas' | 'todas'>('pendientes');
  readonly busquedaCeremonia = signal('');
  readonly resumenFirmas = signal(new Map<number, { firmados: number; pendientes: number }>());
  readonly ceremoniasConEstudiantes = computed(() => (this.tablero()?.ceremonias ?? [])
    .filter(c => c.periodo_id === this.periodo.seleccionado()?.Id && Number(c.cupos_asignados) > 0));
  readonly totalAsignadosPeriodo = computed(() => this.ceremoniasConEstudiantes().reduce((n, c) => n + c.cupos_asignados, 0));
  readonly ceremoniasFiltradas = computed(() => {
    const texto = this.busquedaCeremonia().trim().toLocaleLowerCase();
    return this.ceremoniasConEstudiantes().filter(c => {
      const pendientes = this.pendientesCeremonia(c);
      const cumpleEstado = this.filtroCeremonia() === 'todas' ||
        (this.filtroCeremonia() === 'completadas' ? pendientes === 0 : pendientes !== null && pendientes > 0);
      return cumpleEstado && (!texto || `${c.lugar} ${c.fecha_ceremonia} ${this.fechaLegible(c.fecha_ceremonia)}`.toLocaleLowerCase().includes(texto));
    }).sort((a, b) => this.prioridadCeremonia(a) - this.prioridadCeremonia(b) ||
      b.fecha_ceremonia.localeCompare(a.fecha_ceremonia) || b.id - a.id);
  });
  readonly opcionesCeremonia = computed(() => this.ceremoniasFiltradas().slice(0, 50));
  readonly activaFueraDeOpciones = computed(() => {
    const activa = this.ceremoniaSeleccionada();
    return activa && !this.opcionesCeremonia().some(c => c.id === activa.id) ? activa : null;
  });
  private prioridadCeremonia(ceremonia: CeremoniaResumen): number {
    const pendientes = this.pendientesCeremonia(ceremonia);
    return pendientes === null ? 1 : pendientes > 0 ? 0 : 2;
  }
  readonly activaFueraDelFiltro = computed(() => {
    const activa = this.ceremoniaSeleccionada();
    return activa && !this.ceremoniasFiltradas().some(c => c.id === activa.id) ? activa : null;
  });

  pendientesCeremonia(ceremonia: CeremoniaResumen): number | null {
    const resumen = this.resumenFirmas().get(ceremonia.id);
    if (resumen) return resumen.pendientes;
    if (ceremonia.resumen_firmas?.orden === this.modoConfig().orden) return ceremonia.resumen_firmas.pendientes;
    return null;
  }

  etiquetaCeremonia(ceremonia: CeremoniaResumen): string {
    const pendientes = this.pendientesCeremonia(ceremonia);
    const estado = pendientes === null ? 'Resumen no disponible' : pendientes === 0 ? 'Completada' : `${pendientes} pendiente${pendientes === 1 ? '' : 's'}`;
    return `${this.fechaLegible(ceremonia.fecha_ceremonia)} — ${ceremonia.lugar} · ${estado}`;
  }

  async elegirCeremonia(id: number | null): Promise<void> {
    const ceremonia = this.ceremoniasConEstudiantes().find(c => c.id === id);
    if (ceremonia) await this.seleccionarCeremonia(ceremonia);
    else this.limpiarContextoCeremonia();
  }

  private limpiarContextoCeremonia(): void {
    ++this.cargaEstudiantes;
    this.cerrarPreview();
    this.ceremoniaSeleccionada.set(null);
    this.detalle.set(null);
    this.seleccionados.set(new Set());
    this.limpiarFiltros();
    this.estado.set('idle');
    this.error.set(null);
  }
  readonly estudiantes = computed(() => this.detalle()?.estudiantes ?? []);
  readonly programasUnicos = computed(() => {
    const estudiantes = this.estudiantes();
    const programas = new Set<string>();
    estudiantes.forEach(e => { if (e.programa) programas.add(e.programa); });
    return Array.from(programas).sort();
  });
  readonly pendientes = computed(() => this.estudiantes().filter((estudiante) => this.firmanteTieneRubrica() && estudiante.puede_firmar && !this.estudianteFirmadoEnModo(estudiante)));

  readonly estudiantesFiltrados = computed(() => {
    const busqueda = this.busqueda().toLowerCase().trim();
    const filtroPrograma = this.filtroPrograma();
    const filtroEstado = this.filtroEstado();
    const estudiantes = this.estudiantes();

    return estudiantes.filter(estudiante => {
      if (filtroPrograma !== 'todos' && estudiante.programa !== filtroPrograma) {
        return false;
      }
      if (filtroEstado === 'pendientes' && (this.estudianteFirmadoEnModo(estudiante) || !estudiante.puede_firmar)) {
        return false;
      }
      if (filtroEstado === 'firmados' && !this.estudianteFirmadoEnModo(estudiante)) {
        return false;
      }
      if (busqueda) {
        const nombre = (estudiante.nombre_estudiante || '').toLowerCase();
        const codigo = String(estudiante.codigo_estudiante || '').toLowerCase();
        const documento = (estudiante.numero_documento_estudiante || '').toLowerCase();
        const tipoDoc = (estudiante.tipo_documento_estudiante || '').toLowerCase();
        if (!nombre.includes(busqueda) && !codigo.includes(busqueda) && !documento.includes(busqueda) && !tipoDoc.includes(busqueda)) {
          return false;
        }
      }
      return true;
    });
  });

  readonly totalSeleccionados = computed(() => this.seleccionados().size);
  readonly pendientesFiltrados = computed(() => this.estudiantesFiltrados().filter((estudiante) => this.firmanteTieneRubrica() && estudiante.puede_firmar && !this.estudianteFirmadoEnModo(estudiante)));
  readonly todosPendientesSeleccionados = computed(() => {
    const pendientes = this.pendientesFiltrados();
    const seleccion = this.seleccionados();
    return pendientes.length > 0 && pendientes.every((estudiante) => seleccion.has(estudiante.documento_digital_id));
  });

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.filtroPrograma.set('todos');
    this.filtroEstado.set('todos');
  }

  hayFiltrosActivos(): boolean {
    return this.busqueda().trim() !== '' || this.filtroPrograma() !== 'todos' || this.filtroEstado() !== 'todos';
  }

  async ngOnInit(): Promise<void> {
    // El efecto de período inicializa los cuatro roles.
  }

  async cargarCeremonias(): Promise<void> {
    const periodo = this.periodo.seleccionado();
    const carga = ++this.cargaCeremonias;
    const documento = this.documentoSecretario();
    if (!documento) {
      this.error.set('No fue posible identificar el documento del usuario autenticado.');
      this.estado.set('error');
      await this.mostrarError(this.error()!);
      return;
    }
    this.estado.set('cargando');
    this.error.set(null);
    try {
      const firmante = await firstValueFrom(this.api.getFirmanteActivo(documento));
      if (carga !== this.cargaCeremonias || periodo !== this.periodo.seleccionado()) return;
      this.firmante.set(firmante);
      const config = this.modoConfig();
      if (firmante.rol !== config.rol || firmante.orden !== config.orden) {
        this.tablero.set(null);
        this.detalle.set(null);
        this.estado.set('error');
        this.error.set(config.errorRol);
        await this.mostrarError(config.errorRol);
        return;
      }

      if (!this.firmanteTieneRubrica()) {
        const mensaje = 'Debe cargar una rúbrica activa antes de firmar diplomas.';
        this.error.set(mensaje);
        this.estado.set('idle');
        await this.mostrarAdvertencia(mensaje);
        if (carga !== this.cargaCeremonias || periodo !== this.periodo.seleccionado()) return;
        this.estado.set('cargando');
      }

      if (!periodo) { this.estado.set('idle'); return; }
      const tablero = await firstValueFrom(this.obtenerTablero(documento));
      if (carga !== this.cargaCeremonias || periodo !== this.periodo.seleccionado()) return;
      if ((tablero.ceremonias ?? []).some(c => {
        const resumen = c.resumen_firmas;
        return !resumen || resumen.orden !== this.modoConfig().orden ||
          ![resumen.total, resumen.firmados, resumen.pendientes].every(n => Number.isInteger(n) && n >= 0) ||
          resumen.total !== resumen.firmados + resumen.pendientes;
      })) {
        this.tablero.set(null);
        throw new Error('No fue posible obtener el resumen de firmas para su rol. Reintente la consulta.');
      }
      this.tablero.set(tablero);
      this.resumenFirmas.set(new Map());
      this.estado.set('idle');

      const actual = this.ceremoniaSeleccionada();
      if (actual) {
        const refrescada = this.ceremoniasConEstudiantes().find((ceremonia) => ceremonia.id === actual.id) ?? null;
        if (refrescada) {
          await this.seleccionarCeremonia(refrescada);
          return;
        }
      }

      if (actual) this.limpiarContextoCeremonia();
    } catch (error) {
      if (carga !== this.cargaCeremonias || periodo !== this.periodo.seleccionado()) return;
      const mensaje = this.mensajeError(error, 'No fue posible cargar las ceremonias.');
      this.error.set(mensaje);
      this.estado.set('error');
      await this.mostrarError(mensaje);
    }
  }

  async seleccionarCeremonia(ceremonia: CeremoniaResumen): Promise<void> {
    const periodo = this.periodo.seleccionado();
    const documento = this.documentoSecretario();
    if (!periodo || ceremonia.periodo_id !== periodo.Id || !documento) {
      return;
    }
    const carga = ++this.cargaEstudiantes;
    if (this.ceremoniaSeleccionada()?.id !== ceremonia.id) {
      this.limpiarFiltros();
      this.cerrarPreview();
    }
    this.ceremoniaSeleccionada.set(ceremonia);
    this.detalle.set(null);
    this.seleccionados.set(new Set());
    this.estado.set('estudiantes');
    this.error.set(null);
    try {
      const detalle = await firstValueFrom(this.obtenerFirmasCeremonia(ceremonia.id, documento));
      if (carga !== this.cargaEstudiantes || periodo !== this.periodo.seleccionado()) return;
      this.detalle.set(detalle);
      this.estado.set('idle');
      this.resumenFirmas.update(actual => new Map(actual).set(ceremonia.id, {firmados: detalle.firmados, pendientes: detalle.pendientes}));
    } catch (error) {
      if (carga !== this.cargaEstudiantes || periodo !== this.periodo.seleccionado()) return;
      const mensaje = this.mensajeError(error, 'No fue posible cargar estudiantes de la ceremonia.');
      this.error.set(mensaje);
      this.estado.set('error');
      await this.mostrarError(mensaje);
    }
  }

  toggleEstudiante(estudiante: CeremoniaFirmaEstudianteResumen, checked: boolean): void {
    if (!this.estudiantes().some(e => e.documento_digital_id === estudiante.documento_digital_id && e.puede_firmar && !this.estudianteFirmadoEnModo(e))) {
      return;
    }
    const next = new Set(this.seleccionados());
    if (checked) {
      next.add(estudiante.documento_digital_id);
    } else {
      next.delete(estudiante.documento_digital_id);
    }
    this.seleccionados.set(next);
  }

  toggleTodos(checked: boolean): void {
    if (checked) {
      this.seleccionarTodosPendientes();
      return;
    }
    this.seleccionados.set(new Set());
  }

  seleccionarTodosPendientes(): void {
    this.seleccionados.set(new Set(this.pendientesFiltrados().map((estudiante) => estudiante.documento_digital_id)));
  }

  private previewObjectUrl: string | null = null;
  private previewSolicitud = 0;

  ngOnDestroy(): void {
    ++this.cargaCeremonias;
    ++this.cargaEstudiantes;
    this.cerrarPreview();
  }

  private liberarPreviewUrl(): void {
    this.previewUrl.set(null);
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
  }

  async abrirPreview(estudiante: CeremoniaFirmaEstudianteResumen): Promise<void> {
    const solicitud = ++this.previewSolicitud;
    this.estado.set('preview');
    this.preview.set(null);
    this.liberarPreviewUrl();
    this.previewAbierto.set(true);
    try {
      const documento = this.documentoSecretario();
      if (!documento) throw new Error('No fue posible identificar al firmante.');
      const preview = await firstValueFrom(this.modoConfig().rol === 'secretario_academico'
        ? this.api.prepararDiplomaPreview(estudiante.documento_digital_id, documento)
        : this.api.getDiplomaPreview(estudiante.documento_digital_id));
      if (solicitud !== this.previewSolicitud) return;
      const bytes = Uint8Array.from(atob(preview.file), caracter => caracter.charCodeAt(0));
      this.previewObjectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      this.preview.set(preview);
      this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.previewObjectUrl));
      this.estado.set('idle');
    } catch (error) {
      if (solicitud !== this.previewSolicitud) return;
      this.liberarPreviewUrl();
      this.previewAbierto.set(false);
      const mensaje = this.mensajeError(error, 'No fue posible generar el preview del diploma.');
      this.error.set(mensaje);
      this.estado.set('error');
      await this.mostrarError(mensaje);
    }
  }

  cerrarPreview(): void {
    ++this.previewSolicitud;
    this.previewAbierto.set(false);
    this.preview.set(null);
    this.liberarPreviewUrl();
  }

  async firmarSeleccionados(): Promise<void> {
    const periodo = this.periodo.seleccionado();
    const ceremonia = this.ceremoniaSeleccionada();
    const documento = this.documentoSecretario();
    const contexto = this.cargaEstudiantes;
    const ids = this.pendientes().filter(e => this.seleccionados().has(e.documento_digital_id)).map(e => e.documento_digital_id);
    if (!ceremonia || !documento || ids.length === 0 || this.firmando()) {
      return;
    }
    if (!this.firmanteTieneRubrica()) {
      const mensaje = 'Debe cargar una rúbrica activa antes de firmar diplomas.';
      this.error.set(mensaje);
      await this.mostrarAdvertencia(mensaje);
      return;
    }
    const confirmacion = await Swal.fire({
      title: 'Confirmar firma',
      text: `Se firmarán ${ids.length} diploma(s) de la ceremonia seleccionada.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Firmar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#007ea7',
      cancelButtonColor: '#5b7080',
      heightAuto: false
    });
    if (!confirmacion.isConfirmed || ceremonia.id !== this.ceremoniaSeleccionada()?.id || contexto !== this.cargaEstudiantes) {
      return;
    }
    this.estado.set('firmando');
    this.error.set(null);
    try {
      const payload = { documento_identidad_secretario: documento, documento_identidad_firmante: documento, documento_digital_ids: ids };
      const result = await firstValueFrom(this.firmarCeremoniaPorModo(ceremonia.id, payload).pipe(
        finalize(() => {
          if (this.estado() === 'firmando') {
            this.estado.set('idle');
          }
        })
      ));
      if (contexto !== this.cargaEstudiantes) return;
      const errorFirma = result.errores > 0
        ? result.resultados.find((item) => item.error)?.error || 'La firma terminó con errores. Revise el detalle del servicio e intente nuevamente.'
        : null;
      await this.mostrarResultadoFirma(result.firmados, result.omitidos, result.errores, errorFirma);
      if (contexto !== this.cargaEstudiantes) return;
      await this.cargarCeremonias();
      if (periodo !== this.periodo.seleccionado() || ceremonia.id !== this.ceremoniaSeleccionada()?.id) return;
      if (errorFirma) {
        this.error.set(errorFirma);
      }
    } catch (error) {
      if (contexto !== this.cargaEstudiantes) return;
      const mensaje = this.mensajeError(error, 'No fue posible firmar los diplomas seleccionados.');
      this.error.set(mensaje);
      this.estado.set('error');
      await this.mostrarError(mensaje);
      if (contexto !== this.cargaEstudiantes) return;
      await this.cargarCeremonias();
      if (periodo !== this.periodo.seleccionado() || ceremonia.id !== this.ceremoniaSeleccionada()?.id) return;
      this.error.set(mensaje);
    }
  }


  async anularFirma(estudiante: CeremoniaFirmaEstudianteResumen): Promise<void> {
    const periodo = this.periodo.seleccionado();
    const ceremonia = this.ceremoniaSeleccionada();
    const contexto = this.cargaEstudiantes;
    const documento = this.documentoSecretario();
    if (!ceremonia || !documento || this.firmando() || !this.puedeRevertir(estudiante)) {
      return;
    }
    const confirmacion = await Swal.fire({
      title: 'Revertir firma',
      text: `Se revertirá la firma de ${estudiante.nombre_estudiante || 'este diploma'}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Revertir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#c62828',
      cancelButtonColor: '#5b7080',
      heightAuto: false
    });
    if (!confirmacion.isConfirmed || ceremonia.id !== this.ceremoniaSeleccionada()?.id || contexto !== this.cargaEstudiantes) {
      return;
    }
    this.estado.set('firmando');
    this.error.set(null);
    try {
      const result = await firstValueFrom(this.api.anularFirmaDocumento(estudiante.documento_digital_id, { documento_identidad_firmante: documento }));
      if (contexto !== this.cargaEstudiantes) return;
      if (result.anuladas < 1) throw new Error('No se revirtió ninguna firma. Actualice el diploma e intente nuevamente.');
      this.estado.set('idle');
      await Swal.fire({
        title: 'Firma revertida',
        text: `Se anularon ${result.anuladas} registro(s).`,
        icon: 'success',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#007ea7',
        heightAuto: false
      });
      if (contexto !== this.cargaEstudiantes) return;
      await this.cargarCeremonias();
      if (periodo !== this.periodo.seleccionado() || ceremonia.id !== this.ceremoniaSeleccionada()?.id) return;
    } catch (error) {
      if (contexto !== this.cargaEstudiantes) return;
      const mensaje = this.mensajeError(error, 'No fue posible anular la firma del diploma.');
      this.error.set(mensaje);
      this.estado.set('error');
      await this.mostrarError(mensaje);
      if (contexto !== this.cargaEstudiantes) return;
      await this.cargarCeremonias();
      if (periodo !== this.periodo.seleccionado() || ceremonia.id !== this.ceremoniaSeleccionada()?.id) return;
      this.error.set(mensaje);
    }
  }

  puedeRevertir(estudiante: CeremoniaFirmaEstudianteResumen): boolean {
    return estudiante.puede_revertir === true && this.estudianteFirmadoEnModo(estudiante) && this.modoFirma() !== 'rector';
  }

  estudianteFirmadoEnModo(estudiante: CeremoniaFirmaEstudianteResumen): boolean {
    switch (this.modoFirma()) {
      case 'decano':
        return Boolean(estudiante.firma_decano);
      case 'secretaria-general':
        return Boolean(estudiante.firma_secretaria_general);
      case 'rector':
        return Boolean(estudiante.firma_rector);
      default:
        return Boolean(estudiante.firma_secretario);
    }
  }

  private obtenerTablero(documento: number) {
    switch (this.modoFirma()) {
      case 'decano':
        return this.api.getTableroCeremoniasDecano(documento, true);
      case 'secretaria-general':
        return this.api.getTableroCeremoniasSecretariaGeneral(documento);
      case 'rector':
        return this.api.getTableroCeremoniasRector(documento);
      default:
        return this.api.getTableroCeremonias(documento, true);
    }
  }

  private obtenerFirmasCeremonia(ceremoniaId: number, documento: number) {
    switch (this.modoFirma()) {
      case 'decano':
        return this.api.getFirmasCeremoniaDecano(ceremoniaId, documento);
      case 'secretaria-general':
        return this.api.getFirmasCeremoniaSecretariaGeneral(ceremoniaId, documento);
      case 'rector':
        return this.api.getFirmasCeremoniaRector(ceremoniaId, documento);
      default:
        return this.api.getFirmasCeremonia(ceremoniaId, documento);
    }
  }

  private firmarCeremoniaPorModo(ceremoniaId: number, payload: { documento_identidad_secretario: number; documento_identidad_firmante: number; documento_digital_ids: number[] }) {
    switch (this.modoFirma()) {
      case 'decano':
        return this.api.firmarCeremoniaDecano(ceremoniaId, payload);
      case 'secretaria-general':
        return this.api.firmarCeremoniaSecretariaGeneral(ceremoniaId, payload);
      case 'rector':
        return this.api.firmarCeremoniaRector(ceremoniaId, payload);
      default:
        return this.api.firmarCeremonia(ceremoniaId, payload);
    }
  }

  private configuracionModo(modo: ModoFirma): FirmaModoConfig {
    const configs: Record<ModoFirma, FirmaModoConfig> = {
      secretario: {
        titulo: 'Firma de secretario académico',
        descripcion: 'Seleccione una ceremonia, revise los diplomas y firme en bloque.',
        etiquetaPanel: 'Información del secretario',
        etiquetaFirmado: 'Firmado',
        etiquetaPendiente: 'Pendiente',
        rol: 'secretario_academico',
        orden: 1,
        errorRol: 'El usuario autenticado no tiene rol activo de secretario académico para firmar diplomas.',
        vacio: 'No hay ceremonias con estudiantes asignados.'
      },
      decano: {
        titulo: 'Firma de decano',
        descripcion: 'Seleccione una ceremonia, revise diplomas firmados por secretario y firme en bloque.',
        etiquetaPanel: 'Información del decano',
        etiquetaFirmado: 'Firmado por decano',
        etiquetaPendiente: 'Pendiente decano',
        rol: 'decano',
        orden: 2,
        errorRol: 'El usuario autenticado no tiene rol activo de decano para firmar diplomas.',
        vacio: 'No hay ceremonias con diplomas firmados por secretario.'
      },
      'secretaria-general': {
        titulo: 'Firma de secretaría general',
        descripcion: 'Revise diplomas firmados por decanos de todas las facultades y firme en bloque.',
        etiquetaPanel: 'Información de secretaría general',
        etiquetaFirmado: 'Firmado por secretaría general',
        etiquetaPendiente: 'Pendiente secretaría general',
        rol: 'secretaria_general',
        orden: 3,
        errorRol: 'El usuario autenticado no tiene rol activo de secretaría general para firmar diplomas.',
        vacio: 'No hay ceremonias con diplomas firmados por decano.'
      },
      rector: {
        titulo: 'Firma de rector',
        descripcion: 'Revise diplomas firmados por secretaría general de todas las facultades y firme en bloque.',
        etiquetaPanel: 'Información del rector',
        etiquetaFirmado: 'Firmado por rector',
        etiquetaPendiente: 'Pendiente rector',
        rol: 'rector',
        orden: 4,
        errorRol: 'El usuario autenticado no tiene rol activo de rector para firmar diplomas.',
        vacio: 'No hay ceremonias con diplomas firmados por secretaría general.'
      }
    };
    return configs[modo];
  }

  fechaLegible(value: string): string {
    const fecha = String(value || '').slice(0, 10);
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

  private mensajeError(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  private async mostrarError(mensaje: string): Promise<void> {
    await Swal.fire({
      title: 'No fue posible continuar',
      text: mensaje,
      icon: 'error',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#007ea7',
      heightAuto: false
    });
  }

  private async mostrarAdvertencia(mensaje: string): Promise<void> {
    await Swal.fire({
      title: 'Revisión requerida',
      text: mensaje,
      icon: 'warning',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#007ea7',
      heightAuto: false
    });
  }

  private async mostrarResultadoFirma(firmados: number, omitidos: number, errores: number, detalleError: string | null): Promise<void> {
    const icon = errores > 0 ? 'warning' : 'success';
    await Swal.fire({
      title: errores > 0 ? 'Firma finalizada con novedades' : 'Firma finalizada',
      html: `
        <div class="swal-result">
          <strong>${firmados}</strong> firmado(s)<br>
          <strong>${omitidos}</strong> omitido(s)<br>
          <strong>${errores}</strong> error(es)
          ${detalleError ? `<p>${this.escapeHTML(detalleError)}</p>` : ''}
        </div>
      `,
      icon,
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#007ea7',
      heightAuto: false
    });
  }

  private escapeHTML(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char] ?? char);
  }
}
