export interface CrearCeremoniaRequest {
  fecha_ceremonia: string;
  lugar: string;
  cantidad_estudiantes_programada: number;
  observacion?: string;
  documento_identidad_secretario: number;
}

export type ActualizarCeremoniaRequest = CrearCeremoniaRequest;

export interface CeremoniaGradoResponse {
  id: number;
  fecha_ceremonia?: string;
  lugar: string;
  cantidad_estudiantes_programada: number;
  observacion?: string;
  activo: boolean;
}

export interface CeremoniaFacultadResponse {
  id: number;
  facultad_id: number;
  programa_academico_id: number;
  cantidad_estudiantes_programada?: number;
  activo: boolean;
}

export interface SecretarioAcademicoResponse {
  rol: string;
  orden: number;
  cargo_id: number;
  cargo: string;
  nombre: string;
  documento_identidad: number;
  dependencia?: string;
  facultad_id?: number;
}

export interface CrearCeremoniaResult {
  ceremonia: CeremoniaGradoResponse;
  facultad: CeremoniaFacultadResponse;
  secretario_academico: SecretarioAcademicoResponse;
}

export interface CeremoniaResumen {
  id: number;
  relacion_id: number;
  facultad_id: number;
  fecha_ceremonia: string;
  lugar: string;
  cantidad_estudiantes_programada: number;
  cupos_asignados: number;
  cupos_disponibles: number;
  estado_flujo?: string;
  puede_editar?: boolean;
  puede_eliminar?: boolean;
  motivo_bloqueo?: string;
  observacion?: string;
  activo: boolean;
}

export interface ProgramaAprobadoResumen {
  programa_academico_id: number;
  nombre: string;
  cantidad: number;
  ceremonia_id?: number;
  relacion_id?: number;
  lugar?: string;
  fecha_ceremonia?: string;
  estado_flujo?: string;
  puede_reasignar?: boolean;
  motivo_bloqueo?: string;
}

export interface TableroCeremoniasResult {
  facultad_id: number;
  total_ceremonias: number;
  total_cupos: number;
  cupos_asignados: number;
  cupos_disponibles: number;
  aprobados_total: number;
  ceremonias: CeremoniaResumen[];
  aprobados_programas: ProgramaAprobadoResumen[];
  pendientes_programas?: ProgramaAprobadoResumen[];
  asignados_programas?: ProgramaAprobadoResumen[];
}

export interface ParametrizacionRegistro {
  id?: number;
  facultad_id?: number;
  vigencia: number;
  libro_inicial: number;
  folio_inicial: number;
  registro_inicial: number;
  consecutivo_facultad_inicial: number;
  folios_por_libro: number;
  registros_por_folio: number;
  activo?: boolean;
  existe?: boolean;
}

export interface GuardarParametrizacionRegistroRequest {
  documento_identidad_secretario: number;
  vigencia: number;
  libro_inicial: number;
  folio_inicial: number;
  registro_inicial: number;
  consecutivo_facultad_inicial: number;
  folios_por_libro: number;
  registros_por_folio: number;
}

export interface AsignarProgramaCeremoniaItem {
  programa_academico_id: number;
  cantidad?: number;
}

export interface AsignarEstudiantesCeremoniaRequest {
  documento_identidad_secretario: number;
  programas: AsignarProgramaCeremoniaItem[];
}

export interface QuitarProgramaCeremoniaRequest {
  documento_identidad_secretario: number;
  programa_academico_id: number;
}

export interface AsignarEstudiantesCeremoniaResult {
  ceremonia_id: number;
  asignados: number;
  omitidos: number;
  errores: number;
}

export interface DatosDiplomaEstudiante {
  nombre?: string;
  numero_identificacion?: string;
  titulo?: string;
  tipo_documento?: string;
  municipio_expedicion?: string;
}

export interface EstudianteProgramaCeremonia {
  Id?: number;
  CodigoEstudiante: number;
  IdProyectoOikos: number;
  IdFacultadOikos: number;
  AnioInsGrado?: number;
  PerInsGrado?: number;
  datos_diploma?: DatosDiplomaEstudiante;
}

export interface EstudiantesProgramaCeremoniaResult {
  programa_academico_id: number;
  nombre: string;
  total: number;
  estudiantes: EstudianteProgramaCeremonia[];
}

export interface CeremoniaFirmaEstudianteResumen {
  asignacion_id: number;
  documento_digital_id: number;
  codigo_estudiante: number;
  programa_academico_id?: number;
  programa?: string;
  nombre_estudiante?: string;
  tipo_documento_estudiante?: string;
  numero_documento_estudiante?: string;
  titulo_otorgado?: string;
  estado_documento_id: number;
  firma_secretario: boolean;
  firma_decano?: boolean;
  firma_secretaria_general?: boolean;
  firma_rector?: boolean;
  puede_firmar: boolean;
  motivo_bloqueo?: string;
}

export interface CeremoniaFirmasResult {
  ceremonia: CeremoniaResumen;
  total: number;
  firmados: number;
  pendientes: number;
  estudiantes: CeremoniaFirmaEstudianteResumen[];
}

export interface AnularFirmaDiplomaRequest {
  documento_identidad_firmante: number;
}

export interface AnularFirmaDiplomaResult {
  documento_id: number;
  orden: number;
  anuladas: number;
}

export interface FirmaMasivaCeremoniaRequest {
  documento_identidad_secretario: number;
  documento_identidad_firmante?: number;
  documento_digital_ids?: number[];
}

export interface FirmaMasivaCeremoniaResult {
  ceremonia_id: number;
  total: number;
  firmados: number;
  omitidos: number;
  errores: number;
  resultados: Array<{ documento_digital_id: number; firmado: boolean; error?: string }>;
}

export interface DiplomaPreviewResult {
  preview: boolean;
  documento_id: number;
  diploma_id?: number;
  tipo_documento: string;
  metadatos: {
    titulo?: string;
    nombre_estudiante?: string;
    tipo_documento_estudiante?: string;
    numero_documento?: string;
    lugar_expedicion?: string;
    fecha_ceremonia?: string;
    libro?: number;
    folio?: number;
    numero_registro?: number;
    facultad?: string;
  };
  file: string;
}

export interface RegistroControlCeremonia {
  id: number;
  fecha: string;
  lugar: string;
  diplomas_disponibles: number;
}

export interface RegistroControlFacultad {
  id: number;
  nombre: string;
  ceremonias: RegistroControlCeremonia[];
}

export interface RegistroControlCatalogo {
  facultades: RegistroControlFacultad[];
}
