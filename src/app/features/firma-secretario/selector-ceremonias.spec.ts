import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Swal from 'sweetalert2';
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { FirmaSecretarioComponent } from './firma-secretario';
import { DiplomasApiService } from '../../core/services/diplomas-api.service';
import { PeriodoAcademicoService } from '../../core/services/periodo-academico.service';
import { CeremoniaResumen, CeremoniaFirmasResult } from '../../core/models/ceremonia.model';

const periodo = {Id:77, Nombre:'2026-3', Year:2026, Ciclo:'3', CodigoAbreviacion:'PA', Activo:true};
const ceremonia = (id: number, pendientes: number, fecha: string, periodoId = 77): CeremoniaResumen => ({
  id, periodo_id:periodoId, lugar:`Auditorio ${id}`, fecha_ceremonia:fecha, cupos_asignados:2,
  cupos_disponibles:pendientes, cantidad_estudiantes_programada:10, relacion_id:id, facultad_id:1, activo:true
});
const catalogo = [ceremonia(1, 0, '2026-11-20'), ceremonia(2, 2, '2026-10-29'), ceremonia(3, 1, '2026-10-30'), ceremonia(4, 1, '2027-01-01', 79)];
const detalle = (c: CeremoniaResumen): CeremoniaFirmasResult => ({
  ceremonia:c, total:2, firmados:0, pendientes:2,
  estudiantes:[1,2].map(n => ({asignacion_id:n, documento_digital_id:c.id*10+n, codigo_estudiante:n,
    nombre_estudiante:`Estudiante ${n}`, programa:`Programa ${c.id}`, estado_documento_id:1,
    puede_firmar:true, firma_secretario:false, firma_decano:false, firma_secretaria_general:false, firma_rector:false}))
});

beforeAll(async () => {
  await resolveComponentResources(url => readFile(join(process.cwd(), 'src/app/features/firma-secretario', url.replace(/^\.\//, '')), 'utf-8'));
});

describe.each([
  ['secretario', 'secretario_academico', 1, ''],
  ['decano', 'decano', 2, 'Decano'],
  ['secretaria-general', 'secretaria_general', 3, 'SecretariaGeneral'],
  ['rector', 'rector', 4, 'Rector']
] as const)('Selector compartido: %s', (ruta, rol, orden, sufijo) => {
  let fixture: ComponentFixture<FirmaSecretarioComponent>;
  let component: FirmaSecretarioComponent;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let cargaDetalle: ReturnType<typeof vi.fn>;
  let cargaTablero: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    localStorage.setItem('user', btoa(JSON.stringify({userService:{documento:123}})));
    cargaDetalle = vi.fn((id: number) => of(detalle(catalogo.find(c => c.id === id)!)));
    cargaTablero = vi.fn(() => of({ceremonias:catalogo.map(c => ({...c,cupos_disponibles:8,resumen_firmas:{orden,total:2,firmados:2-c.cupos_disponibles,pendientes:c.cupos_disponibles}}))}));
    api = {
      getFirmanteActivo:vi.fn(() => of({rol,orden,nombre:'Firmante Prueba',documento_identidad:123,cargo_id:1,cargo:'Firmante',enlace_firma:'firma'})),
      getPeriodosAcademicos:vi.fn(() => of([periodo,{...periodo,Id:79,Nombre:'2027-1',Year:2027,Ciclo:'1'}])),
      [`getTableroCeremonias${sufijo}`]: cargaTablero,
      [`getFirmasCeremonia${sufijo}`]: cargaDetalle,
      [`firmarCeremonia${sufijo}`]:vi.fn(() => of({firmados:2,omitidos:0,errores:0,resultados:[]}))
    };
    await TestBed.configureTestingModule({imports:[FirmaSecretarioComponent], providers:[
      provideRouter([]), {provide:Router,useValue:{url:`/firma-${ruta}`}}, {provide:DiplomasApiService,useValue:api}
    ]}).compileComponents();
    fixture = TestBed.createComponent(FirmaSecretarioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(component.estado()).toBe('idle'));
    fixture.detectChanges();
  });

  afterEach(() => { fixture.destroy(); vi.restoreAllMocks(); localStorage.clear(); });

  async function seleccionarPeriodo(): Promise<void> {
    component.periodo.seleccionado.set(periodo);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(component.tablero()).not.toBeNull());
    fixture.detectChanges();
  }

  it('carga catálogo, identifica actor y espera selección explícita de período y ceremonia', async () => {
    expect(api.getPeriodosAcademicos).toHaveBeenCalledOnce();
    expect(component.firmante()?.rol).toBe(rol);
    expect(component.filtroCeremonia()).toBe('pendientes');
    expect(cargaTablero).not.toHaveBeenCalled();
    await seleccionarPeriodo();
    expect(cargaTablero).toHaveBeenCalledOnce();
    if (orden <= 2) expect(cargaTablero).toHaveBeenCalledWith(123,true);
    expect(component.etiquetaCeremonia(component.ceremoniasConEstudiantes()[0])).toContain('Completada');
    expect(component.ceremoniasFiltradas().map(c => c.id)).toEqual([3,2]);
    expect(cargaDetalle).not.toHaveBeenCalled();
    expect(component.ceremoniaSeleccionada()).toBeNull();
    expect(component.ceremoniasConEstudiantes().map(c => c.id)).toEqual([1,2,3]);
  });

  it('filtra completadas, ordena pendientes recientes y busca fecha o nombre', async () => {
    await seleccionarPeriodo();
    expect(component.ceremoniasFiltradas().map(c => c.id)).toEqual([3,2]);
    component.filtroCeremonia.set('completadas');
    expect(component.ceremoniasFiltradas().map(c => c.id)).toEqual([1]);
    component.filtroCeremonia.set('todas');
    expect(component.ceremoniasFiltradas().map(c => c.id)).toEqual([3,2,1]);
    component.busquedaCeremonia.set('29/10/2026');
    expect(component.ceremoniasFiltradas().map(c => c.id)).toEqual([2]);
    component.busquedaCeremonia.set('Auditorio 3');
    expect(component.ceremoniasFiltradas().map(c => c.id)).toEqual([3]);
  });

  it('cambiar ceremonia limpia selección y filtros anteriores', async () => {
    await seleccionarPeriodo();
    await component.seleccionarCeremonia(catalogo[1]);
    component.seleccionarTodosPendientes();
    component.busqueda.set('Estudiante'); component.filtroPrograma.set('Programa 2');
    await component.seleccionarCeremonia(catalogo[2]);
    expect(component.seleccionados().size).toBe(0);
    expect(component.busqueda()).toBe('');
    expect(component.filtroPrograma()).toBe('todos');
    expect(component.programasUnicos()).toEqual(['Programa 3']);
    expect(component.detalle()?.ceremonia.id).toBe(3);
  });

  it('ignora detalle tardío tras seleccionar otra ceremonia', async () => {
    await seleccionarPeriodo();
    const anterior = new Subject<CeremoniaFirmasResult>();
    cargaDetalle.mockReturnValueOnce(anterior);
    const carga = component.seleccionarCeremonia(catalogo[1]);
    await component.seleccionarCeremonia(catalogo[2]);
    anterior.next(detalle(catalogo[1])); anterior.complete(); await carga;
    expect(component.detalle()?.ceremonia.id).toBe(3);
    expect(component.ceremoniaSeleccionada()?.id).toBe(3);
  });

  it('cambio de período limpia detalle y descarta tablero tardío', async () => {
    await seleccionarPeriodo();
    await component.seleccionarCeremonia(catalogo[1]);
    component.seleccionarTodosPendientes();
    const anterior = new Subject<{ceremonias:CeremoniaResumen[]}>();
    cargaTablero.mockReturnValueOnce(anterior);
    const carga = component.cargarCeremonias(); await Promise.resolve();
    component.periodo.seleccionado.set(null);
    fixture.detectChanges(); await fixture.whenStable();
    anterior.next({ceremonias:[]}); anterior.complete(); await carga;
    expect(component.tablero()).toBeNull();
    expect(component.detalle()).toBeNull();
    expect(component.seleccionados().size).toBe(0);
    expect(component.ceremoniaSeleccionada()).toBeNull();
  });

  it.each([1,2])('firma %s diploma(s) elegibles, descarta IDs ajenos y conserva ceremonia completada', async cantidad => {
    await seleccionarPeriodo();
    await component.seleccionarCeremonia(catalogo[1]);
    component.seleccionados.set(new Set([21,...(cantidad === 2 ? [22] : []),999]));
    component.busqueda.set('Estudiante');
    vi.spyOn(Swal,'fire').mockResolvedValue({isConfirmed:true} as never);
    cargaDetalle.mockReturnValueOnce(of({...detalle(catalogo[1]),firmados:2,pendientes:0,estudiantes:detalle(catalogo[1]).estudiantes.map(e => ({...e,puede_firmar:false,[`firma_${rol === 'secretario_academico' ? 'secretario' : rol}`]:true}))}));
    await component.firmarSeleccionados();
    expect(api[`firmarCeremonia${sufijo}`]).toHaveBeenCalledWith(2,expect.objectContaining({documento_digital_ids:cantidad === 2 ? [21,22] : [21]}));
    expect(cargaDetalle).toHaveBeenCalledTimes(2);
    expect(component.ceremoniaSeleccionada()?.id).toBe(2);
    expect(component.detalle()?.pendientes).toBe(0);
    expect(component.activaFueraDelFiltro()?.id).toBe(2);
    expect(component.busqueda()).toBe('Estudiante');
    expect(component.seleccionados().size).toBe(0);
  });
  it('limita opciones y permite encontrar ceremonias fuera de las primeras cincuenta', async () => {
    await seleccionarPeriodo();
    component.tablero.set({ceremonias:Array.from({length:120},(_,n) => ceremonia(n+1,1,'2026-10-29'))} as never);
    component.filtroCeremonia.set('todas');
    expect(component.ceremoniasFiltradas()).toHaveLength(120);
    expect(component.opcionesCeremonia()).toHaveLength(50);
    component.busquedaCeremonia.set('Auditorio 12');
    expect(component.opcionesCeremonia().map(c => c.id)).toContain(12);
  });

  it.each(['ausente','otra etapa','inconsistente'])('muestra error ante resumen %s y no inventa pendientes', async variante => {
    await seleccionarPeriodo();
    vi.spyOn(Swal,'fire').mockResolvedValue({isConfirmed:true} as never);
    const ceremonias = catalogo.map(c => ({...c,resumen_firmas:variante === 'ausente' ? undefined : {
      orden:variante === 'otra etapa' ? orden+1 : orden,
      total:2,firmados:1,pendientes:variante === 'inconsistente' ? 2 : 1
    }}));
    cargaTablero.mockReturnValueOnce(of({ceremonias}));
    await component.cargarCeremonias();
    expect(component.tablero()).toBeNull();
    expect(component.error()).toContain('resumen de firmas para su rol');
    expect(cargaDetalle).not.toHaveBeenCalled();
  });

});
