// App simple para registrar vacas y catalogar por peso
(function(){
  const LS_VACAS = 'vacas_app_v1';
  const LS_RAZAS = 'razas_app_v1';

  // Estado en memoria
  let vacas = [];
  let razas = {};
  let nextId = 1;

  // Elementos
  const formRegistro = document.getElementById('form-registro');
  const nombreInput = document.getElementById('nombre');
  const fechaInput = document.getElementById('fechaNacimiento');
  const pesoInput = document.getElementById('peso');
  const razaSelect = document.getElementById('razaSelect');
  const btnReset = document.getElementById('btn-reset');

  const formRaza = document.getElementById('form-raza');
  const razaNombre = document.getElementById('razaNombre');
  const rangoMin = document.getElementById('rangoMin');
  const rangoMax = document.getElementById('rangoMax');
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
    if(rawRazas){ razas = JSON.parse(rawRazas); }
    // si no hay razas, crear una por defecto
    if(Object.keys(razas).length===0){
      razas = {
        'General': {min:200, max:600}
      };
      saveRazas();
    }
  }

  function saveVacas(){ localStorage.setItem(LS_VACAS, JSON.stringify(vacas)); }
  function saveRazas(){ localStorage.setItem(LS_RAZAS, JSON.stringify(razas)); }

  function addOrUpdateRaza(nombre, min, max){
    razas[nombre] = {min: Number(min), max: Number(max)};
    saveRazas();
    renderRazas();
    populateRazaSelect();
  }

  function removeRaza(nombre){
    delete razas[nombre];
    saveRazas();
    renderRazas();
    populateRazaSelect();
  }

  function registerVaca(nom, fecha, peso, raza){
    const vaca = {
      id: nextId++,
      nombre: nom || '',
      fechaNacimiento: fecha,
      peso: Number(peso),
      raza: raza,
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

  function clasificar(peso, raza){
    const r = razas[raza];
    if(!r) return 'Sin rango';
    if(peso < r.min) return 'Bajo peso';
    if(peso > r.max) return 'Sobrepeso';
    return 'Peso promedio';
  }

  // Render
  function populateRazaSelect(){
    razaSelect.innerHTML = '';
    Object.keys(razas).forEach(r=>{
      const opt = document.createElement('option'); opt.value = r; opt.textContent = r;
      razaSelect.appendChild(opt);
    });
  }

  function renderRazas(){
    const keys = Object.keys(razas);
    if(keys.length===0){ razasList.innerHTML = '<small>No hay razas definidas.</small>'; return; }
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Raza</th><th>Min (kg)</th><th>Max (kg)</th><th>Acciones</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    keys.forEach(r=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r}</td><td>${razas[r].min}</td><td>${razas[r].max}</td><td>`+
        `<button data-raza="${r}" class="edit-raza">Editar</button> `+
        `<button data-raza="${r}" class="del-raza">Eliminar</button></td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    razasList.innerHTML = '';
    razasList.appendChild(table);

    // listeners
    [...razasList.querySelectorAll('.edit-raza')].forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const r = btn.getAttribute('data-raza');
        razaNombre.value = r;
        rangoMin.value = razas[r].min;
        rangoMax.value = razas[r].max;
      });
    });
    [...razasList.querySelectorAll('.del-raza')].forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const r = btn.getAttribute('data-raza');
        if(confirm(`Eliminar la raza "${r}"? Esto no eliminará vacas existentes.`)){
          removeRaza(r);
        }
      });
    });
  }

  function renderVacas(){
    if(vacas.length===0){ vacasList.innerHTML = '<small>No hay vacas registradas.</small>'; return; }
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>ID</th><th>Nombre</th><th>Raza</th><th>Fecha Nac</th><th>Peso (kg)</th><th>Clasificación</th><th>Acciones</th></tr></thead>';
    const tbody = document.createElement('tbody');
    vacas.forEach(v=>{
      const cls = clasificar(v.peso, v.raza);
      const clsClass = cls==='Bajo peso'? 'status-bajo' : (cls==='Peso promedio'? 'status-prom' : (cls==='Sobrepeso'? 'status-sobre' : ''));
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${v.id}</td>
        <td>${v.nombre}</td>
        <td>${v.raza}</td>
        <td>${v.fechaNacimiento}</td>
        <td data-id="peso-${v.id}">${v.peso.toFixed(1)}</td>
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
    const nom = nombreInput.value.trim();
    const fecha = fechaInput.value;
    const peso = pesoInput.value;
    const raza = razaSelect.value;
    if(!fecha || !peso || !raza){ alert('Complete los campos requeridos'); return; }
    registerVaca(nom, fecha, peso, raza);
    formRegistro.reset();
  });

  btnReset.addEventListener('click', ()=>{ formRegistro.reset(); });

  formRaza.addEventListener('submit', (e)=>{
    e.preventDefault();
    const nombre = razaNombre.value.trim();
    const min = rangoMin.value;
    const max = rangoMax.value;
    if(!nombre || min==='' || max===''){ alert('Complete los campos de raza'); return; }
    if(Number(min) > Number(max)){ alert('El mínimo no puede ser mayor que el máximo'); return; }
    addOrUpdateRaza(nombre, min, max);
    formRaza.reset();
  });

  // Inicializar
  load();
  populateRazaSelect();
  renderRazas();
  renderVacas();
})();