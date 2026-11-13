import { PeriodoSelectorComponent } from '../../core/periodo-selector';
import { Component, effect, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { DiplomasApiService } from '../../core/services/diplomas-api.service';
import { PeriodoAcademicoService } from '../../core/services/periodo-academico.service';

interface Estudiante { CodigoEstudiante: number; IdProyectoOikos: number; datos_diploma?: { nombre: string }; }
interface Aprobados { total: number; errores: number; facultades: { facultad_id: number; estudiantes: Estudiante[] }[]; estudiantes_con_error?: unknown[]; }
@Component({
 selector: 'diplomas-aprobados', imports: [PeriodoSelectorComponent, JsonPipe],
 changeDetection: ChangeDetectionStrategy.Eager,
 template: `<main style="padding:24px"><h1>Estudiantes aprobados</h1><diplomas-periodo-selector />
 @if(!periodo.seleccionado()) { <p>Seleccione un período académico para consultar aprobados.</p> }
 @if(periodo.seleccionado(); as p) { <p>Período: {{ p.Nombre }}</p>
 <button (click)="cargar()" [disabled]="cargando()">Actualizar</button>
 <button (click)="crear(true)" [disabled]="cargando() || !datos()?.total">Simular creación</button>
 <button (click)="crear(false)" [disabled]="cargando() || !datos()?.total">Crear documentos</button> }
 @if(cargando()) { <p role="status">Procesando…</p> }
 @if(error()) { <p role="alert">{{ error() }}</p> }
 @if(datos(); as d) {
 <p>{{ d.total }} aprobados disponibles · {{ d.errores }} errores de estudiantes</p>
 @for(f of d.facultades; track f.facultad_id) {
 <h2>Facultad Oikos {{ f.facultad_id }}</h2>
 <table><thead><tr><th>Código</th><th>Nombre</th><th>Programa Oikos</th></tr></thead><tbody>
 @for(e of f.estudiantes; track e.CodigoEstudiante) { <tr><td>{{ e.CodigoEstudiante }}</td><td>{{ e.datos_diploma?.nombre }}</td><td>{{ e.IdProyectoOikos }}</td></tr> }
 </tbody></table> }
 @if(d.estudiantes_con_error?.length) { <pre>{{ d.estudiantes_con_error | json }}</pre> }
 }
 @if(resultado()) { <h2>Resultado de creación</h2><pre>{{ resultado() | json }}</pre> }
 </main>`
})
export class AprobadosComponent {
 readonly periodo = inject(PeriodoAcademicoService);
 private readonly api = inject(DiplomasApiService);
 readonly datos = signal<Aprobados | null>(null);
 readonly resultado = signal<unknown>(null);
 readonly error = signal('');
 readonly cargando = signal(false);
 constructor() { effect(() => {
  const p = this.periodo.seleccionado();
  this.datos.set(null); this.resultado.set(null); this.error.set(''); this.cargando.set(false);
  if(p) void this.cargar();
 }); }
 async cargar(): Promise<void> {
  const p = this.periodo.seleccionado(); if(!p) return;
  this.cargando.set(true); this.error.set('');
  try { const d = await firstValueFrom(this.api.getEstudiantesAprobados()); if(p === this.periodo.seleccionado()) this.datos.set(d as Aprobados); }
  catch(e) { if(p === this.periodo.seleccionado()) this.error.set(e instanceof Error ? e.message : 'Error al consultar aprobados.'); }
  finally { if(p === this.periodo.seleccionado()) this.cargando.set(false); }
 }
 async crear(dryRun: boolean): Promise<void> {
  const p = this.periodo.seleccionado(); if(!p || this.cargando()) return;
  if(!dryRun && !window.confirm(`¿Crear documentos para aprobados de ${p.Nombre}?`)) return;
  this.cargando.set(true); this.error.set('');
  try { const r = await firstValueFrom(this.api.crearDocumentosAprobados({ dry_run: dryRun })); if(p === this.periodo.seleccionado()) this.resultado.set(r); }
  catch(e) { if(p === this.periodo.seleccionado()) this.error.set(e instanceof Error ? e.message : 'Error al crear documentos.'); }
  finally { if(p === this.periodo.seleccionado()) this.cargando.set(false); }
 }
}
