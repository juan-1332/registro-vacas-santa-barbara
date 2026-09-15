(function(){
  const LS_VACAS = 'vacas_app_v1';
  const LS_VACAS_ANTERIOR = 'sb_vacas';
  const LS_RANGOS = 'rangos_brahman_local_v1';
  const RAZA = 'Brahman';
  const EDADES = [[9,10],[10,11],[11,12],[12,13],[13,14],[14,15],[15,16],[16,17],[17,18],[18,20],[20,22],[22,24],[24,27],[27,30],[30,33],[33,36],[36,40],[40,44],[44,48]];
  const PESOS = {
    Macho: { max: [383,420,458,497,534,572,609,645,682,731,795,844], promedio: [329,363,396,431,463,498,531,563,596,639,697,742], min: [279,307,335,365,393,423,450,480,510,549,602,645] },
    Hembra: { max: [332,363,395,427,457,488,517,547,576,615,661,697], promedio: [284,312,341,369,397,423,449,475,506,534,573,603], min: [247,270,293,316,338,362,383,404,426,455,489,515] }
  };

  let bovinos = [];
  let rangosBrahman = {};
  const $ = id => document.getElementById(id);
  const form = $('form-registro');
  const lista = $('vacasList');
  const rangos = $('razasList');
  const buscar = $('buscarCodigo');
  const rangosPanel = $('rangosPanel');
  const btnToggleRangos = $('btn-toggle-rangos');

  function crearId(){
    return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  }

  function crearRangos(sexo){
    return EDADES.map(([minEdad, maxEdad], index) => ({ minEdad, maxEdad, min: PESOS[sexo].min[index] ?? null, promedio: PESOS[sexo].promedio[index] ?? null, max: PESOS[sexo].max[index] ?? null }));
  }

  function cargar(){
    try {
      const origen = localStorage.getItem(LS_VACAS) || localStorage.getItem(LS_VACAS_ANTERIOR) || '[]';
      const guardados = JSON.parse(origen);
      bovinos = Array.isArray(guardados) ? guardados.map(bovino => ({ ...bovino, id: bovino.id || crearId(), sexo: bovino.sexo || 'Macho' })) : [];
      guardar();
    } catch { bovinos = []; }
    try {
      const guardados = JSON.parse(localStorage.getItem(LS_RANGOS) || 'null');
      rangosBrahman = guardados && guardados.Macho && guardados.Hembra ? guardados : crearRangosPredeterminados();
    } catch { rangosBrahman = crearRangosPredeterminados(); }
    guardarRangos();
  }

  function guardar(){ localStorage.setItem(LS_VACAS, JSON.stringify(bovinos)); }
  function guardarRangos(){ localStorage.setItem(LS_RANGOS, JSON.stringify(rangosBrahman)); }

  function edadEnMeses(fecha){
    const nacimiento = new Date(`${fecha}T00:00:00`);
    const hoy = new Date();
    let meses = (hoy.getFullYear() - nacimiento.getFullYear()) * 12 + hoy.getMonth() - nacimiento.getMonth();
    if(hoy.getDate() < nacimiento.getDate()) meses--;
    return Math.max(0, meses);
  }

  function encontrarRango(sexo, edad){
    return (rangosBrahman[sexo] || []).find((rango, index, rangos) => {
      const ultimo = index === rangos.length - 1;
      return edad >= rango.minEdad && (ultimo ? edad <= rango.maxEdad : edad < rango.maxEdad);
    });
  }

  function crearRangosPredeterminados(){
    return { Macho: crearRangos('Macho'), Hembra: crearRangos('Hembra') };
  }

  function clasificar(peso, sexo, edad){
    const rango = encontrarRango(sexo || 'Macho', edad);
    if(!rango || typeof rango.min !== 'number' || typeof rango.max !== 'number') return 'Rango no creado';
    if(peso < rango.min) return 'Bajo peso';
    if(peso > rango.max) return 'Sobrepeso';
    return 'Peso promedio';
  }

  function mostrarRangos(){
    rangos.innerHTML = '';
    ['Macho', 'Hembra'].forEach(sexo => {
      const titulo = document.createElement('h3');
      titulo.textContent = `${RAZA} - ${sexo}`;
      rangos.appendChild(titulo);
      const tabla = document.createElement('table');
      const rangosSexo = rangosBrahman[sexo] || [];
      tabla.innerHTML = '<thead><tr><th>Competencia</th><th>Máx. (kg)</th><th>Prom. (kg)</th><th>Mín. (kg)</th><th>Acciones</th></tr></thead>';
      const cuerpo = document.createElement('tbody');
      rangosSexo.forEach((rango, index) => {
        const fila = document.createElement('tr');
        const valor = dato => typeof dato === 'number' ? dato : '-';
        fila.innerHTML = `<td>${rango.minEdad} a ${rango.maxEdad} meses</td><td>${valor(rango.max)}</td><td>${valor(rango.promedio)}</td><td>${valor(rango.min)}</td><td></td>`;
        const acciones = fila.lastElementChild;
        const editar = document.createElement('button');
        editar.textContent = 'Editar';
        editar.addEventListener('click', () => editarRango(sexo, index));
        const eliminar = document.createElement('button');
        eliminar.textContent = 'Eliminar';
        eliminar.className = 'danger';
        eliminar.addEventListener('click', () => eliminarRango(sexo, index));
        acciones.append(editar, eliminar);
        cuerpo.appendChild(fila);
      });
      tabla.appendChild(cuerpo);
      rangos.appendChild(tabla);
    });
  }

  function editarRango(sexo, index){
    const rango = rangosBrahman[sexo][index];
    const minEdad = prompt('Edad mínima (meses):', rango.minEdad);
    if(minEdad === null) return;
    const maxEdad = prompt('Edad máxima (meses):', rango.maxEdad);
    if(maxEdad === null) return;
    const max = prompt('Peso máximo (kg):', rango.max ?? '');
    if(max === null) return;
    const promedio = prompt('Peso promedio (kg):', rango.promedio ?? '');
    if(promedio === null) return;
    const min = prompt('Peso mínimo (kg):', rango.min ?? '');
    if(min === null) return;
    const valores = [minEdad, maxEdad, max, promedio, min].map(Number);
    if(valores.some(valor => !Number.isFinite(valor) || valor < 0) || valores[0] > valores[1] || valores[2] < valores[3] || valores[3] < valores[4]){
      alert('El rango ingresado no es válido. Revise edades y pesos.');
      return;
    }
    rangosBrahman[sexo][index] = { minEdad: valores[0], maxEdad: valores[1], max: valores[2], promedio: valores[3], min: valores[4] };
    guardarRangos();
    mostrarRangos();
    mostrarBovinos();
  }

  function eliminarRango(sexo, index){
    const rango = rangosBrahman[sexo][index];
    if(!confirm(`¿Eliminar el rango de ${rango.minEdad} a ${rango.maxEdad} meses para ${sexo}?`)) return;
    rangosBrahman[sexo].splice(index, 1);
    guardarRangos();
    mostrarRangos();
    mostrarBovinos();
  }

  function mostrarBovinos(){
    const texto = buscar.value.trim().toLowerCase();
    const visibles = bovinos.filter(bovino => (bovino.codigo || '').toLowerCase().includes(texto));
    if(!visibles.length){ lista.innerHTML = texto ? '<small>No se encontraron bovinos con ese código.</small>' : '<small>No hay bovinos registrados.</small>'; return; }
    const tabla = document.createElement('table');
    tabla.innerHTML = '<thead><tr><th>Código</th><th>Fecha de nacimiento</th><th>Peso (kg)</th><th>Sexo</th><th>Clasificación</th></tr></thead>';
    const cuerpo = document.createElement('tbody');
    visibles.forEach(bovino => {
      const edad = edadEnMeses(bovino.fechaNacimiento);
      const fila = document.createElement('tr');
      const sexo = bovino.sexo || 'Macho';
      const clasificacion = clasificar(Number(bovino.peso), sexo, edad);
      fila.innerHTML = `<td>${bovino.codigo}</td><td>${bovino.fechaNacimiento}</td><td>${Number(bovino.peso).toFixed(1)}</td><td>${sexo}</td><td>${clasificacion}</td>`;
      cuerpo.appendChild(fila);
    });
    tabla.appendChild(cuerpo);
    lista.replaceChildren(tabla);
  }

  function editarPeso(bovino){
    const nuevo = prompt('Nuevo peso (kg):', bovino.peso);
    if(nuevo === null) return;
    if(!Number.isFinite(Number(nuevo)) || Number(nuevo) <= 0){ alert('Ingrese un peso válido mayor que 0 kg.'); return; }
    bovino.peso = Number(nuevo); guardar(); mostrarBovinos();
  }

  function eliminarBovino(bovino){
    if(!confirm(`¿Eliminar el bovino ${bovino.codigo}?`)) return;
    bovinos = bovinos.filter(item => item !== bovino); guardar(); mostrarBovinos();
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if(!form.reportValidity()) return;
    const codigo = $('codigo').value.trim();
    const fecha = $('fechaNacimiento').value;
    const peso = Number($('peso').value);
    const sexo = $('sexoSelect').value;
    const fechaNacimiento = new Date(`${fecha}T00:00:00`);
    if(!codigo || !fecha || !sexo){ alert('Complete todos los campos requeridos.'); return; }
    if(!Number.isFinite(peso) || peso <= 0){ alert('El peso debe ser mayor que 0 kg.'); return; }
    if(Number.isNaN(fechaNacimiento.getTime()) || fechaNacimiento > new Date()){ alert('La fecha de nacimiento no puede ser futura.'); return; }
    const bovino = { id: crearId(), codigo, fechaNacimiento: fecha, peso, sexo };
    bovinos.push(bovino);
    guardar();
    form.reset();
    buscar.value = '';
    mostrarBovinos();
  });

  $('btn-reset').addEventListener('click', () => form.reset());
  buscar.addEventListener('input', mostrarBovinos);
  btnToggleRangos.addEventListener('click', () => {
    const cerrado = rangosPanel.classList.toggle('hidden');
    btnToggleRangos.textContent = cerrado ? 'Abrir rangos' : 'Cerrar rangos';
    btnToggleRangos.setAttribute('aria-expanded', String(!cerrado));
  });
  cargar(); mostrarRangos(); mostrarBovinos();
})();
