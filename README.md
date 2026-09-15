# Registro de Vacas

Pequeña aplicación web para registrar vacas, asignar raza y clasificar por peso.

Cómo usar:

1. Abrir `index.html` en un navegador moderno.
2. La aplicación usa únicamente la raza Brahman y muestra sus rangos oficiales por sexo y competencia mensual.
3. En "Registrar Vaca" ingresa código, fecha de nacimiento, peso y sexo. La edad y los rangos se manejan en meses.
4. La tabla "Bovinos registrados" muestra la clasificación: "Bajo peso", "Peso promedio" o "Sobrepeso".
5. Usa "Buscar por código" para localizar rápidamente un bovino.
6. Puedes editar el peso de un bovino desde la tabla.

Los datos se guardan en `localStorage` del navegador.

## Funcionamiento local

La aplicación funciona directamente abriendo `index.html` o mediante un servidor local.

- Los datos se guardan en `localStorage` del navegador.
- La única raza disponible es Brahman.
- Los rangos se expresan en meses y se separan por sexo.
- La clasificación devuelve `Bajo peso`, `Peso promedio`, `Sobrepeso` o `Rango no creado`.
- Los rangos se consultan desde una sección independiente que se puede abrir y cerrar.
- Cada rango permite editar sus edades y pesos o eliminarlo; los cambios quedan guardados localmente.
- El código, la fecha, el peso y el sexo son obligatorios al registrar un bovino.
- Puedes buscar, editar el peso o eliminar un bovino desde el listado.
