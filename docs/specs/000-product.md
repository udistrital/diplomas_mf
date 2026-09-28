# 000 Product

## Producto

`diplomas_mf` es el microfrontend del dominio de diplomas digitales. Esta primera vertical entrega una vista funcional para cargar firmas de firmantes autorizados.

## Alcance de esta iteracion

Incluye solamente la vista `Gestión de firma`, disponible en `/diplomas/firmas`.

El usuario puede:

1. ingresar documento de identidad;
2. validar firmante activo contra `diplomas_service`;
3. revisar nombre, cargo, rol, documento y orden;
4. seleccionar una imagen PNG de firma;
5. previsualizar archivo seleccionado;
6. enviar la firma a `diplomas_service`;
7. ver resultado de exito o error.

## Fuera de alcance

No se implementa preview/generacion/firma de diplomas, ceremonias, libros, folios, registros, consecutivos ni configuracion administrativa.
