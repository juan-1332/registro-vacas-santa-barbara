// App simple para registrar vacas y catalogar por peso
(function(){
  const LS_VACAS = 'vacas_app_v1';
  const LS_RAZAS = 'razas_app_v1';
  const RAZA_BRAHMAN = 'Brahman';
  const EDADES_BRAHMAN = [
    [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15],
    [15, 16], [16, 17], [17, 18], [18, 20], [20, 22], [22, 24],
    [24, 27], [27, 30], [30, 33], [33, 36], [36, 40], [40, 44], [44, 48]
  ];
  const ARTES_MIN = [19, 21, 22, 23, 24, 25, 26, 27, 28, 30, 31, 32, 34, 35, 35, 35, 35, 35, 35];
  const PESOS_BRAHMAN = {
    Macho: {
      max: [383, 420, 458, 497, 534, 572, 609, 645, 682, 731, 795, 844],
      promedio: [329, 363, 396, 431, 463, 498, 531, 563, 596, 639, 697, 742],
      min: [279, 307, 335, 365, 393, 423, 450, 480, 510, 549, 602, 645]
    },
    Hembra: {
      max: [332, 363, 395, 427, 457, 488, 517, 547, 576, 615, 661, 697],
      promedio: [284, 312, 341, 369, 397, 423, 449, 475, 506, 534, 573, 603],
      min: [247, 270, 293, 316, 338, 362, 383, 404, 426, 455, 489, 515]
    }
  };

  // Estado en memoria
  let vacas = [];
  let razas = {};
  let nextId = 1;

  // Elementos
  const formRegistro = document.getElementById('form-registro');
  const codigoInput = document.getElementById('codigo');
  const fechaInput = document.getElementById('fechaNacimiento');
  const pesoInput = document.getElementById('peso');
  const sexoSelect = document.getElementById('sexoSelect');
  const btnReset = document.getElementById('btn-reset');

  const razasList = document.getElementById('razasList');

  const vacasList = document.getElementById('vacasList');

  // Cargar desde localStorage
  function load(){
    const rawVacas = localStorage.getItem(LS_VACAS);
    const rawRazas = localStorage.getItem(LS_RAZAS);
    if(rawVacas){
      vacas = JSON.parse(rawVacas);
      if(vacas.length) nextId = Math.max(...vacas.map(v=>v.id))+1;
    }
    razas = { [RAZA_BRAHMAN]: crearRangosBrahman() };
    saveRazas();

    // migrar vacas antiguas que tengan 'nombre' en lugar de 'codigo'
    if(vacas && vacas.length){
      let changed = false;
      vacas.forEach(v=>{ if(!v.codigo && v.nombre){ v.codigo = v.nombre; delete v.nombre; changed = true; } });
      if(changed) saveVacas();
    }
  }

  function crearRangosBrahman(){
    return Object.fromEntries(['Macho', 'Hembra'].map(sexo=>[
      sexo,
      EDADES_BRAHMAN.map(([ageMin, ageMax], index)=>({
        ageMin,
        ageMax,
        min: PESOS_BRAHMAN[sexo].min[index],
        max: PESOS_BRAHMAN[sexo].max[index],
        promedio: PESOS_BRAHMAN[sexo].promedio[index],
        artesMin: ARTES_MIN[index]
      }))
    ]));
  }

  function saveVacas(){ localStorage.setItem(LS_VACAS, JSON.stringify(vacas)); }
  function saveRazas(){ localStorage.setItem(LS_RAZAS, JSON.stringify(razas)); }

  function registerVaca(codigo, fecha, peso, sexo){
    const vaca = {
      id: nextId++,
      codigo: codigo || '',
      fechaNacimiento: fecha,
      peso: Number(peso),
      raza: RAZA_BRAHMAN,
      sexo: sexo,
      creado: new Date().toISOString()
    };
    vacas.push(vaca);
    saveVacas();
    renderVacas();
  }

  function updatePeso(id, nuevoPeso){
    const v = vacas.find(x=>x.id===id);
    if(!v) return;
    v.peso = Number(nuevoPeso);
    saveVacas();
    renderVacas();
  }

  function edadEnMeses(fechaStr){
    if(!fechaStr) return 0;
    const nacido = new Date(fechaStr);
    const ahora = new Date();
    // calcular meses completos entre fechas usando año/mes/día
    let totalMonths = (ahora.getFullYear() - nacido.getFullYear()) * 12;
    totalMonths += ahora.getMonth() - nacido.getMonth();
    if(ahora.getDate() < nacido.getDate()) totalMonths -= 1;
    return Math.max(0, totalMonths);
  }

  function clasificar(peso, sexo, edad){
    const ranges = razas[RAZA_BRAHMAN][sexo];
    if(!ranges || ranges.length===0) return 'Sin rango';
    const r = ranges.find(rr => edad >= rr.ageMin && edad <= rr.ageMax);
    const target = r;
    if(!target) return 'Sin rango';
    if(typeof target.min !== 'number' || typeof target.max !== 'number') return 'Sin rango';
    if(peso < target.min) return 'Bajo peso';
    if(peso > target.max) return 'Sobrepeso';
    return 'Peso promedio';
  }

  // Render
  function renderRazas(){
    razasList.innerHTML = '';
    ['Macho', 'Hembra'].forEach(sexo=>{
      const title = document.createElement('h3');
      title.textContent = `${RAZA_BRAHMAN} - ${sexo}`;
      razasList.appendChild(title);
      const table = document.createElement('table');
      table.innerHTML = '<thead><tr><th>Edad (meses)</th><th>Mínimo (kg)</th><th>Promedio (kg)</th><th>Máximo (kg)</th><th>Artes mín.</th></tr></thead>';
      const tbody = document.createElement('tbody');
      razas[RAZA_BRAHMAN][sexo].forEach(rango=>{
        const row = document.createElement('tr');
        const mostrar = valor => typeof valor === 'number' ? valor : '-';
        row.innerHTML = `<td>${rango.ageMin} - ${rango.ageMax}</td><td>${mostrar(rango.min)}</td><td>${mostrar(rango.promedio)}</td><td>${mostrar(rango.max)}</td><td>${mostrar(rango.artesMin)}</td>`;
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      razasList.appendChild(table);
    });
  }

  function renderVacas(){
    if(vacas.length===0){ vacasList.innerHTML = '<small>No hay vacas registradas.</small>'; return; }
    const table = document.createElement('table');
      table.innerHTML = '<thead><tr><th>ID</th><th>Código</th><th>Raza</th><th>Sexo</th><th>Fecha Nac</th><th>Peso (kg)</th><th>Edad</th><th>Clasificación</th><th>Acciones</th></tr></thead>';
    const tbody = document.createElement('tbody');
    vacas.forEach(v=>{
      const edad = edadEnMeses(v.fechaNacimiento);
      const cls = clasificar(v.peso, v.sexo || 'Macho', edad);
      const clsClass = cls==='Bajo peso'? 'status-bajo' : (cls==='Peso promedio'? 'status-prom' : (cls==='Sobrepeso'? 'status-sobre' : ''));
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${v.id}</td>
        <td>${v.codigo || ''}</td>
        <td>${v.raza}</td>
          <td>${v.sexo || 'Macho'}</td>
        <td>${v.fechaNacimiento}</td>
        <td data-id="peso-${v.id}">${v.peso.toFixed(1)}</td>
        <td>${edad} meses</td>
        <td class="${clsClass}">${cls}</td>
        <td>
          <button data-id="${v.id}" class="editar-peso">Editar peso</button>
          <button data-id="${v.id}" class="borrar-vaca">Eliminar</button>
        </td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    vacasList.innerHTML = '';
    vacasList.appendChild(table);

    // listeners
    [...vacasList.querySelectorAll('.editar-peso')].forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = Number(btn.getAttribute('data-id'));
        const td = document.querySelector(`[data-id="peso-${id}"]`);
        const current = vacas.find(x=>x.id===id).peso;
        td.innerHTML = `<input type="number" step="0.1" min="0" value="${current}" id="input-peso-${id}"> <button id="guardar-${id}">Guardar</button>`;
        document.getElementById(`guardar-${id}`).addEventListener('click', ()=>{
          const nuevo = document.getElementById(`input-peso-${id}`).value;
          if(nuevo==='' || Number(nuevo)<0){ alert('Peso inválido'); return; }
          updatePeso(id, nuevo);
        });
      });
    });

    [...vacasList.querySelectorAll('.borrar-vaca')].forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = Number(btn.getAttribute('data-id'));
        if(confirm('Eliminar vaca id '+id+' ?')){
          vacas = vacas.filter(x=>x.id!==id);
          saveVacas();
          renderVacas();
        }
      });
    });
  }

  // Eventos
  formRegistro.addEventListener('submit', (e)=>{
    e.preventDefault();
    const codigo = codigoInput.value.trim();
    const fecha = fechaInput.value;
    const peso = pesoInput.value;
    const sexo = sexoSelect.value;
    if(!fecha || !peso || !sexo){ alert('Complete los campos requeridos'); return; }
    registerVaca(codigo, fecha, peso, sexo);
    formRegistro.reset();
  });

  btnReset.addEventListener('click', ()=>{ formRegistro.reset(); });


  // Inicializar
  load();
  renderRazas();
  renderVacas();
})();