import { PeriodoAcademicoService } from '../../../core/services/periodo-academico.service';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of, throwError, Subject } from 'rxjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { DiplomasApiService } from '../../../core/services/diplomas-api.service';
import { NuevaCeremoniaComponent } from './nueva-ceremonia';

const tableroMock = {
  facultad_id: 158,
  total_ceremonias: 1,
  total_cupos: 40,
  cupos_asignados: 0,
  cupos_disponibles: 40,
  aprobados_total: 12,
  ceremonias: [{ periodo_id:77, id: 99, relacion_id: 100, facultad_id: 158, fecha_ceremonia: '2026-11-20T00:00:00Z', lugar: 'Auditorio Mayor', cantidad_estudiantes_programada: 40, cupos_asignados: 0, cupos_disponibles: 40, observacion: 'Ceremonia ordinaria', activo: true }],
  aprobados_programas: [{ programa_academico_id: 10, nombre: 'Programa 10', cantidad: 12 }]
};

class DiplomasApiServiceMock {
  asignarEstudiantesCeremonia = vi.fn(() => of({asignados:1,omitidos:0,errores:0,ceremonia_id:99}));
  getTableroCeremonias = vi.fn(() => of(tableroMock));
  crearCeremonia = vi.fn(() => of({ ceremonia: { periodo_id:77, id: 99, lugar: 'Auditorio Mayor', cantidad_estudiantes_programada: 40, activo: true }, facultad: { id: 100, facultad_id: 158, programa_academico_id: 0, cantidad_estudiantes_programada: 40, activo: true }, secretario_academico: { rol: 'secretario_academico', orden: 1, cargo_id: 158, cargo: 'SECRETARIO ACADEMICO', nombre: 'Secretaria', documento_identidad: 1023026828 } }));
  actualizarCeremonia = vi.fn(() => of({}));
  eliminarCeremonia = vi.fn(() => of({ deleted: true }));
}

describe('NuevaCeremoniaComponent', () => {
  beforeAll(async () => {
    await resolveComponentResources((url) => {
      const cleanUrl = url.replace(/^\.\//, '');
      return readFile(join(process.cwd(), 'src/app/features/ceremonias/nueva-ceremonia', cleanUrl), 'utf-8');
    });
  });

  let fixture: ComponentFixture<NuevaCeremoniaComponent>;
  let component: NuevaCeremoniaComponent;
  let api: DiplomasApiServiceMock;

  beforeEach(async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    localStorage.setItem('user', btoa(JSON.stringify({ user: { documento: '1111111111' }, userService: { documento: '1023026828' } })));

    await TestBed.configureTestingModule({
      imports: [NuevaCeremoniaComponent, NoopAnimationsModule],
      providers: [{ provide: DiplomasApiService, useClass: DiplomasApiServiceMock }, provideRouter([])]
    }).compileComponents();

    TestBed.inject(PeriodoAcademicoService).periodos.set([{Id:77,Nombre:"2026-3",Year:2026,Ciclo:"3",CodigoAbreviacion:"PA",Activo:true}]);
    TestBed.inject(PeriodoAcademicoService).seleccionado.set({Id:77,Nombre:'2026-3',Year:2026,Ciclo:'3',CodigoAbreviacion:'PA',Activo:true});
    fixture = TestBed.createComponent(NuevaCeremoniaComponent);
    component = fixture.componentInstance;
    api = TestBed.inject(DiplomasApiService) as unknown as DiplomasApiServiceMock;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  function llenarFormulario(): void {
    component.form.patchValue({ fecha_ceremonia: new Date('2026-11-20T00:00:00'), lugar: 'Auditorio Mayor', cantidad_estudiantes_programada: 40, observacion: 'Ceremonia ordinaria' });
    component.form.updateValueAndValidity();
  }

  it('TEST-CER-001 carga tablero con documento autenticado', () => {
    expect(component.documentoSecretario()).toBe(1023026828);
    expect(api.getTableroCeremonias).toHaveBeenCalledWith(1023026828);
    expect(component.tablero()?.total_ceremonias).toBe(1);
  });

  it('TEST-CER-002 formulario inicia inválido', () => {
    expect(component.form.invalid).toBe(true);
  });

  it('TEST-CER-003 botón guardar permanece deshabilitado si formulario es inválido', () => {
    const button = fixture.debugElement.query(By.css('button[type="submit"]')).nativeElement as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('TEST-CER-004 crea ceremonia con payload correcto', async () => {
    llenarFormulario();
    await component.guardar();
    expect(api.crearCeremonia).toHaveBeenCalledWith({ periodo_id:77, fecha_ceremonia: '2026-11-20', lugar: 'Auditorio Mayor', cantidad_estudiantes_programada: 40, observacion: 'Ceremonia ordinaria', documento_identidad_secretario: 1023026828 });
  });

  it('TEST-CER-005 edita una ceremonia existente', async () => {
    component.editar(tableroMock.ceremonias[0]);
    expect(component.modoEdicion()).toBe(true);
    component.form.controls.lugar.setValue('Sala 2');
    await component.guardar();
    expect(api.actualizarCeremonia).toHaveBeenCalledWith(99, expect.objectContaining({ lugar: 'Sala 2', fecha_ceremonia: '2026-11-20' }));
  });

  it('TEST-CER-006 elimina una ceremonia', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    await component.eliminar(tableroMock.ceremonias[0]);
    expect(api.eliminarCeremonia).toHaveBeenCalledWith(99, 1023026828);
  });

  it('TEST-CER-007 muestra mensaje comprensible cuando backend falla', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    api.crearCeremonia.mockReturnValueOnce(throwError(() => new Error('No tiene permisos para realizar esta acción.')));
    llenarFormulario();
    await component.guardar();
    expect(component.estado()).toBe('error');
    expect(component.error()).toContain('No tiene permisos');
    consoleError.mockRestore();
  });
  it('ignora respuestas tardías al cambiar período y limpia selección temporal', async () => {
    const estado = TestBed.inject(PeriodoAcademicoService);
    const anterior = new Subject<typeof tableroMock>();
    const actual = new Subject<typeof tableroMock>();
    api.getTableroCeremonias.mockReturnValueOnce(anterior).mockReturnValueOnce(actual);
    const oldLoad = component.cargarTablero();
    estado.seleccionado.set({Id:75,Nombre:'2026-1',Year:2026,Ciclo:'1',CodigoAbreviacion:'PA',Activo:false});
    const newLoad = component.cargarTablero();
    actual.next({...tableroMock,aprobados_total:3});actual.complete();await newLoad;
    anterior.next({...tableroMock,aprobados_total:90});anterior.complete();await oldLoad;
    expect(component.tablero()?.aprobados_total).toBe(3);
    expect(component.programaAsignacion()).toBeNull();
  });

  it('muestra ceremonias históricas sin período pero bloquea creación hasta configurarlo', async () => {
    TestBed.inject(PeriodoAcademicoService).seleccionado.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.tablero()?.ceremonias[0].id).toBe(99);
    api.getTableroCeremonias.mockClear();
    llenarFormulario();
    await component.guardar();
    expect(api.crearCeremonia).not.toHaveBeenCalled();
    expect(component.form.controls.periodo_id.invalid).toBe(true);
    expect(component.tablero()?.total_ceremonias).toBe(1);
  });

  it('consulta pendientes al elegir período y conserva programa Oikos 72', async () => {
    const periodo = TestBed.inject(PeriodoAcademicoService);
    api.getTableroCeremonias.mockReturnValueOnce(of({...tableroMock,aprobados_total:0,aprobados_programas:[]}));
    periodo.seleccionado.set(null);
    fixture.detectChanges();await fixture.whenStable();fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sin consultar');
    api.getTableroCeremonias.mockReturnValueOnce(of({...tableroMock,aprobados_total:1,aprobados_programas:[{programa_academico_id:72,nombre:'Programa Oikos 72',cantidad:1}]}));
    periodo.seleccionado.set({Id:77,Nombre:'2026-3',Year:2026,Ciclo:'3',CodigoAbreviacion:'PA',Activo:true});
    fixture.detectChanges();await fixture.whenStable();fixture.detectChanges();
    expect(component.programasPendientes()).toEqual([{programa_academico_id:72,nombre:'Programa Oikos 72',cantidad:1}]);
    expect(fixture.nativeElement.textContent).toContain('Programa Oikos 72');
  });

  it('solo ofrece ceremonias del mismo período y rechaza asignación cruzada', async () => {
    component.tablero.set({...tableroMock,ceremonias:[tableroMock.ceremonias[0],{...tableroMock.ceremonias[0],id:100,periodo_id:79}]});
    component.programaAsignacion.set({programa_academico_id:72,nombre:'Programa',cantidad:1});
    expect(component.ceremoniasDisponiblesParaPrograma().map(c=>c.id)).toEqual([99]);
    component.ceremoniaAsignacion.set({...tableroMock.ceremonias[0],id:100,periodo_id:79});
    await component.asignarEstudiantes();
    expect(api.asignarEstudiantesCeremonia).not.toHaveBeenCalled();
    expect(component.error()).toContain('mismo período');
  });

  it('no anuncia éxito ni cierra el programa cuando todas las asignaciones fallan', async () => {
    api.asignarEstudiantesCeremonia.mockReturnValueOnce(of({ceremonia_id:99,asignados:0,omitidos:0,errores:1}));
    component.programaAsignacion.set({programa_academico_id:72,nombre:'Programa',cantidad:1});
    component.ceremoniaAsignacion.set(tableroMock.ceremonias[0]);
    component.selectorCeremoniaAbierto.set(true);
    await component.asignarEstudiantes();
    expect(component.estado()).toBe('error');
    expect(component.error()).toContain('Asignados: 0');
    expect(component.error()).toContain('Errores: 1');
    expect(component.programaAsignacion()?.programa_academico_id).toBe(72);
    expect(component.selectorCeremoniaAbierto()).toBe(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('No fue posible completar');
  });

});
