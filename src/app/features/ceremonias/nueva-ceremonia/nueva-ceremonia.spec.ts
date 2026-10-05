import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
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
  ceremonias: [{ id: 99, relacion_id: 100, facultad_id: 158, fecha_ceremonia: '2026-11-20T00:00:00Z', lugar: 'Auditorio Mayor', cantidad_estudiantes_programada: 40, cupos_asignados: 0, cupos_disponibles: 40, observacion: 'Ceremonia ordinaria', activo: true }],
  aprobados_programas: [{ programa_academico_id: 10, nombre: 'Programa 10', cantidad: 12 }]
};

class DiplomasApiServiceMock {
  getTableroCeremonias = vi.fn(() => of(tableroMock));
  crearCeremonia = vi.fn(() => of({ ceremonia: { id: 99, lugar: 'Auditorio Mayor', cantidad_estudiantes_programada: 40, activo: true }, facultad: { id: 100, facultad_id: 158, programa_academico_id: 0, cantidad_estudiantes_programada: 40, activo: true }, secretario_academico: { rol: 'secretario_academico', orden: 1, cargo_id: 158, cargo: 'SECRETARIO ACADEMICO', nombre: 'Secretaria', documento_identidad: 1023026828 } }));
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
    expect(api.crearCeremonia).toHaveBeenCalledWith({ fecha_ceremonia: '2026-11-20', lugar: 'Auditorio Mayor', cantidad_estudiantes_programada: 40, observacion: 'Ceremonia ordinaria', documento_identidad_secretario: 1023026828 });
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
});
