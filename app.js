(function(){
  const LS_VACAS = 'vacas_app_v1';
  const LS_VACAS_ANTERIOR = 'sb_vacas';
  const LS_RANGOS = 'rangos_brahman_local_v1';
  const RAZA = 'Brahman';
  const SUPABASE_URL = 'https://pphnbmdbodwkjcbrynl.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwaG5ibWRib2R3a2pqY2JyeW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MjE4OTYsImV4cCI6MjEwNTA5Nzg5Nn0.shcx3_fRWQ5BPqoBRubaZU01TW4nNzlgYYNYnF4TQKA';
  const clienteSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
  const estadoConexion = $('estadoConexion');
  const rangosPanel = $('rangosPanel');
  const btnToggleRangos = $('btn-toggle-rangos');
  const formRango = $('form-rango');
  const rangoEditor = $('rangoEditor');
  const rangoEditorTitulo = $('rangoEditorTitulo');
  let rangoEditando = null;

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

  // Solo se persiste la respuesta cuando la consulta fue exitosa; un fallo nunca borra el caché local.
  async function cargarDesdeSupabase(){
    estadoConexion.textContent = 'Cargando bovinos...';
    estadoConexion.className = 'status loading';
    lista.setAttribute('aria-busy', 'true');
    lista.textContent = 'Cargando bovinos...';
    try {
      const { data, error } = await clienteSupabase.from('bovinos').select('*');
      if(error || !Array.isArray(data)) throw error || new Error('Respuesta inválida de Supabase');
      bovinos = (data || []).map(bovino => ({
        id: bovino.id,
        codigo: bovino.codigo,
        fechaNacimiento: bovino.fecha_nacimiento,
        peso: Number(bovino.peso),
        sexo: bovino.sexo || 'Macho'
      }));
      guardar();
      estadoConexion.textContent = 'Datos sincronizados con Supabase.';
      estadoConexion.className = 'status';
    } catch(error){
      console.warn('No se pudieron cargar los bovinos desde Supabase:', error);
      estadoConexion.textContent = 'Modo offline: mostrando datos guardados localmente.';
      estadoConexion.className = 'status offline';
    } finally {
      lista.setAttribute('aria-busy', 'false');
      mostrarBovinos();
    }
  }

  function guardar(){ localStorage.setItem(LS_VACAS, JSON.stringify(bovinos)); }
  function guardarRangos(){ localStorage.setItem(LS_RANGOS, JSON.stringify(rangosBrahman)); }

  // Se construye la fecha en hora local para evitar el desplazamiento UTC de YYYY-MM-DD.
  function edadEnMeses(fecha){
    const partes = String(fecha || '').split('-').map(Number);
    if(partes.length !== 3 || partes.some(Number.isNaN)) return 0;
    const nacimiento = new Date(partes[0], partes[1] - 1, partes[2]);
    if(Number.isNaN(nacimiento.getTime())) return 0;
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

  function crearCelda(etiqueta, valor){
    const celda = document.createElement('td');
    celda.dataset.label = etiqueta;
    celda.textContent = valor;
    return celda;
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
        ['Competencia', 'Máximo', 'Promedio', 'Mínimo', 'Acciones'].forEach((etiqueta, celdaIndex) => {
          fila.cells[celdaIndex].dataset.label = etiqueta;
        });
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
    const nuevo = document.createElement('button');
    nuevo.type = 'button';
    nuevo.textContent = 'Crear nuevo rango';
    nuevo.addEventListener('click', () => abrirEditorRango());
    rangos.appendChild(nuevo);
  }

  function abrirEditorRango(sexo = 'Macho', index = null){
    rangoEditando = index === null ? null : { sexo, index };
    const rango = index === null ? { minEdad: '', maxEdad: '', min: '', promedio: '', max: '' } : rangosBrahman[sexo][index];
    rangoEditorTitulo.textContent = index === null ? 'Nuevo rango' : `Editar rango de ${sexo}`;
    $('rangoSexo').value = sexo;
    $('rangoEdadMin').value = rango.minEdad;
    $('rangoEdadMax').value = rango.maxEdad;
    $('rangoPesoMin').value = rango.min ?? '';
    $('rangoPesoPromedio').value = rango.promedio ?? '';
    $('rangoPesoMax').value = rango.max ?? '';
    rangoEditor.classList.remove('hidden');
    rangos.classList.add('hidden');
    rangoEditor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    $('rangoEdadMin').focus();
  }

  function cerrarEditorRango(){
    rangoEditando = null;
    rangoEditor.classList.add('hidden');
    rangos.classList.remove('hidden');
    formRango.reset();
  }

  function rangosQueSeSolapan(sexo, minEdad, maxEdad){
    return (rangosBrahman[sexo] || []).filter((rango, index) => {
      if(rangoEditando && rangoEditando.sexo === sexo && rangoEditando.index === index) return false;
      return minEdad < rango.maxEdad && maxEdad > rango.minEdad;
    });
  }

  function guardarRangoDesdeFormulario(event){
    event.preventDefault();
    if(!formRango.reportValidity()) return;
    const sexo = $('rangoSexo').value;
    const rangoAnterior = rangoEditando ? rangosBrahman[rangoEditando.sexo][rangoEditando.index] : null;
    const valores = ['rangoEdadMin', 'rangoEdadMax', 'rangoPesoMin', 'rangoPesoPromedio', 'rangoPesoMax'].map(id => Number($(id).value));
    const [minEdad, maxEdad, min, promedio, max] = valores;
    if(valores.some(valor => !Number.isFinite(valor) || valor < 0) || minEdad >= maxEdad || min > promedio || promedio > max){
      alert('El rango ingresado no es válido. Revise edades y pesos.');
      return;
    }
    const ocupados = rangosQueSeSolapan(sexo, minEdad, maxEdad);
    if(ocupados.length){
      const descripcion = ocupados.map(rango => `${rango.minEdad} a ${rango.maxEdad} meses`).join(', ');
      if(!confirm(`Las edades elegidas ya están ocupadas por: ${descripcion}. ¿Deseas reemplazar el rango?`)) return;
      rangosBrahman[sexo] = rangosBrahman[sexo].filter(rango => !ocupados.includes(rango));
    }
    const nuevoRango = { minEdad, maxEdad, min, promedio, max };
    if(rangoAnterior){
      rangosBrahman[rangoEditando.sexo] = rangosBrahman[rangoEditando.sexo].filter(rango => rango !== rangoAnterior);
    }
    rangosBrahman[sexo].push(nuevoRango);
    rangosBrahman[sexo].sort((a, b) => a.minEdad - b.minEdad);
    guardarRangos();
    cerrarEditorRango();
    mostrarRangos();
    mostrarBovinos();
  }

  function editarRango(sexo, index){ abrirEditorRango(sexo, index); }

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
    if(!visibles.length){ lista.textContent = texto ? 'No se encontraron bovinos con ese código.' : 'No hay bovinos registrados.'; return; }
    const tabla = document.createElement('table');
    const encabezado = document.createElement('thead');
    const filaEncabezado = document.createElement('tr');
    ['Código', 'Fecha de nacimiento', 'Peso (kg)', 'Sexo', 'Clasificación', 'Acciones'].forEach(textoEncabezado => {
      const th = document.createElement('th');
      th.textContent = textoEncabezado;
      filaEncabezado.appendChild(th);
    });
    encabezado.appendChild(filaEncabezado);
    tabla.appendChild(encabezado);
    const cuerpo = document.createElement('tbody');
    visibles.forEach(bovino => {
      const fila = document.createElement('tr');
      const sexo = bovino.sexo || 'Macho';
      const peso = Number(bovino.peso);
      fila.append(
        crearCelda('Código', bovino.codigo || ''),
        crearCelda('Fecha de nacimiento', bovino.fechaNacimiento || ''),
        crearCelda('Peso', Number.isFinite(peso) ? peso.toFixed(1) : '-'),
        crearCelda('Sexo', sexo),
        crearCelda('Clasificación', clasificar(peso, sexo, edadEnMeses(bovino.fechaNacimiento)))
      );
      const acciones = crearCelda('Acciones', '');
      const editar = document.createElement('button');
      editar.type = 'button';
      editar.textContent = 'Editar peso';
      editar.addEventListener('click', () => editarPeso(bovino));
      const eliminar = document.createElement('button');
      eliminar.type = 'button';
      eliminar.textContent = 'Eliminar';
      eliminar.className = 'danger';
      eliminar.addEventListener('click', () => eliminarBovino(bovino));
      acciones.replaceChildren(editar, eliminar);
      fila.appendChild(acciones);
      cuerpo.appendChild(fila);
    });
    tabla.appendChild(cuerpo);
    lista.replaceChildren(tabla);
  }

  async function editarPeso(bovino){
    const nuevo = prompt('Nuevo peso (kg):', bovino.peso);
    if(nuevo === null) return;
    if(!Number.isFinite(Number(nuevo)) || Number(nuevo) <= 0){ alert('Ingrese un peso válido mayor que 0 kg.'); return; }
    const { error } = await clienteSupabase.from('bovinos').update({ peso: Number(nuevo) }).eq('id', bovino.id);
    if(error){ alert(`No se pudo actualizar el peso: ${error.message}`); return; }
    bovino.peso = Number(nuevo); guardar(); mostrarBovinos();
  }

  async function eliminarBovino(bovino){
    if(!confirm(`¿Eliminar el bovino ${bovino.codigo}?`)) return;
    const { error } = await clienteSupabase.from('bovinos').delete().eq('id', bovino.id);
    if(error){ alert(`No se pudo eliminar el bovino: ${error.message}`); return; }
    bovinos = bovinos.filter(item => item.id !== bovino.id); guardar(); mostrarBovinos();
  }

  form.addEventListener('submit', async event => {
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
    const { data, error } = await clienteSupabase.from('bovinos').insert({
      codigo,
      fecha_nacimiento: fecha,
      peso,
      sexo
    }).select().single();
    if(error){
      alert(`No se pudo guardar el bovino: ${error.message}`);
      return;
    }
    const bovino = {
      id: data.id,
      codigo: data.codigo,
      fechaNacimiento: data.fecha_nacimiento,
      peso: Number(data.peso),
      sexo: data.sexo || sexo
    };
    bovinos.push(bovino);
    guardar();
    form.reset();
    buscar.value = '';
    mostrarBovinos();
    alert('Bovino guardado correctamente.');
  });

  $('btn-reset').addEventListener('click', () => form.reset());
  formRango.addEventListener('submit', guardarRangoDesdeFormulario);
  $('btn-cancelar-rango').addEventListener('click', cerrarEditorRango);
  buscar.addEventListener('input', mostrarBovinos);
  btnToggleRangos.addEventListener('click', () => {
    const cerrado = rangosPanel.classList.toggle('hidden');
    btnToggleRangos.textContent = cerrado ? 'Abrir rangos' : 'Cerrar rangos';
    btnToggleRangos.setAttribute('aria-expanded', String(!cerrado));
  });
  cargar(); mostrarRangos(); mostrarBovinos(); cargarDesdeSupabase();
})();
