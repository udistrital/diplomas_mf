import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DiplomasApiService, DIPLOMAS_SERVICE_BASE_URL } from './diplomas-api.service';
import { PeriodoAcademicoService } from './periodo-academico.service';
import { PeriodoSelectorComponent } from '../periodo-selector';

describe('Período académico compartido', () => {
 let api: DiplomasApiService;
 let http: HttpTestingController;
 let estado: PeriodoAcademicoService;
 const periodo = { Id:77, Nombre:'2026-3', Year:2026, Ciclo:'3', CodigoAbreviacion:'PA', Activo:true };
 beforeEach(() => {
  TestBed.configureTestingModule({ providers:[provideHttpClient(),provideHttpClientTesting(),{provide:DIPLOMAS_SERVICE_BASE_URL,useValue:'/v1'}] });
  api=TestBed.inject(DiplomasApiService);http=TestBed.inject(HttpTestingController);estado=TestBed.inject(PeriodoAcademicoService);
 });
 afterEach(() => http.verify());
 it('exige selección explícita', () => {
  expect(estado.seleccionado()).toBeNull();
  expect(() => api.getEstudiantesAprobados()).toThrow('Seleccione');
  expect(() => api.crearDocumentosAprobados({})).toThrow('Seleccione');
 });
 it('propaga ID a consultas y creación; conserva Oikos', () => {
  estado.seleccionado.set(periodo);
  api.getEstudiantesAprobados().subscribe();
  http.expectOne('/v1/diplomas/estudiantes-aprobados?periodo_id=77').flush({total:0,facultades:[]});
  api.getTableroCeremonias(12).subscribe();
  const board=http.expectOne(r => r.url==='/v1/ceremonias');expect(board.request.params.get('periodo_id')).toBe('77');board.flush({});
  api.getEstudiantesProgramaCeremonia(275,12).subscribe();
  const students=http.expectOne(r => r.url==='/v1/ceremonias/programas/275/estudiantes');expect(students.request.params.get('periodo_id')).toBe('77');students.flush({});
  api.crearDocumentosAprobados({dry_run:true,periodo_id:3}).subscribe();
  const post=http.expectOne('/v1/diplomas/estudiantes-aprobados/documentos');expect(post.request.body).toEqual({dry_run:true,periodo_id:77});post.flush({});
  api.asignarEstudiantesCeremonia(1,{documento_identidad_secretario:12,programas:[{programa_academico_id:275}]}).subscribe();
  const assign=http.expectOne('/v1/ceremonias/1/asignar');expect(assign.request.body.periodo_id).toBe(77);expect(assign.request.body.programas[0].programa_academico_id).toBe(275);assign.flush({});
 });
 it('ofrece solo activos ordenados, sin elegir automáticamente, y conserva IDs internamente', async () => {
  const selector=TestBed.runInInjectionContext(() => new PeriodoSelectorComponent());
  const load=selector.cargar();
  http.expectOne('/v1/diplomas/periodos-academicos').flush([periodo,{...periodo,Id:79,Year:2027,Ciclo:'1'},{...periodo,Id:75,Ciclo:'1',Activo:false}]);
  await load;
  expect(selector.periodos().map(p=>p.Id)).toEqual([79,77,75]);expect(estado.seleccionado()).toBeNull();
  expect(selector.periodosActivos().map(p=>p.Id)).toEqual([79,77]);
  selector.seleccionar('75');expect(estado.seleccionado()).toBeNull();
  selector.seleccionar('77');expect(estado.seleccionado()?.Id).toBe(77);
 });
 it('muestra error y permite reintentar sin confundirlo con vacío',async () => {
  const selector=TestBed.runInInjectionContext(() => new PeriodoSelectorComponent());
  const load=selector.cargar();http.expectOne('/v1/diplomas/periodos-academicos').flush({}, {status:500,statusText:'Error'});await load;
  expect(selector.error()).toBeTruthy();expect(selector.cargando()).toBe(false);
  const retry=selector.cargar();http.expectOne('/v1/diplomas/periodos-academicos').flush([]);await retry;expect(selector.error()).toBe('');expect(selector.periodos()).toEqual([]);
 });
 it('lista ceremonias persistidas sin período; mantiene bloqueo de estudiantes y asignación', () => {
  api.getTableroCeremonias(12).subscribe();
  const req=http.expectOne('/v1/ceremonias?documento_identidad_secretario=12');
  expect(req.request.params.has('periodo_id')).toBe(false);
  req.flush({ceremonias:[]});
  expect(() => api.getEstudiantesProgramaCeremonia(275,12)).toThrow('Seleccione');
  expect(() => api.asignarEstudiantesCeremonia(1,{documento_identidad_secretario:12,programas:[]})).toThrow('Seleccione');
 });

});
