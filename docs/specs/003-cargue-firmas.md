# 003 Cargue de Firmas

## REQ-FIRMA-001

Un usuario autorizado puede consultar un firmante por documento de identidad.

### AC-FIRMA-001

Dado un documento valido, cuando se consulta, entonces se muestra nombre, cargo, rol, documento y orden de firma cuando exista.

## REQ-FIRMA-002

Solo un firmante activo puede continuar al cargue de firma.

### AC-FIRMA-002

Si el servicio indica que el documento no corresponde a un firmante activo, se muestra un mensaje entendible y no se habilita seleccion/cargue de firma.

## REQ-FIRMA-003

El usuario puede seleccionar una imagen de firma PNG.

### AC-FIRMA-003

El sistema valida archivo existente, MIME `image/png`, tamano maximo de 2 MB y archivo no vacio. No procesa la imagen en frontend.

## REQ-FIRMA-004

El usuario puede previsualizar la firma antes de enviarla.

### AC-FIRMA-004

Al seleccionar PNG valido se muestra imagen, nombre de archivo y tamano. El usuario puede reemplazarlo antes de cargar.

## REQ-FIRMA-005

El sistema envia la firma a `POST /v1/firmantes/firma` solo despues de validar firmante y archivo.

## REQ-FIRMA-006

La vista expone estados: idle, validando firmante, firmante valido, firmante no autorizado, archivo seleccionado, subiendo, exito y error.

## Lineamientos visuales

La primera vista usa Angular Material con tema institucional UD: primario `#03678f`, acento `#145a95`, advertencia equivalente y tipografia Open Sans, Helvetica Neue, sans-serif. La interfaz debe mantener estructura centrada, tarjetas Material, campos `mat-form-field`, botones Material, iconos, spinners y mensajes accesibles sin alterar el flujo funcional de validacion, seleccion PNG, previsualizacion y envio Base64.

## Pruebas

- TEST-FIRMA-001 consulta `/v1/firmantes/rol-activo`.
- TEST-FIRMA-002 envia `POST /v1/firmantes/firma`.
- TEST-FIRMA-003 no habilita cargue sin firmante validado.
- TEST-FIRMA-004 rechaza archivos no PNG.
- TEST-FIRMA-005 muestra preview de PNG valido.
- TEST-FIRMA-006 habilita boton con firmante y archivo.
- TEST-FIRMA-007 muestra estado de exito.
- TEST-FIRMA-008 muestra error comprensible si falla backend.
