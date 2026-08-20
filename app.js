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
  const codigoInput = document.getElementById('codigo');
  const fechaInput = document.getElementById('fechaNacimiento');
  const pesoInput = document.getElementById('peso');
  const razaSelect = document.getElementById('razaSelect');
  const btnReset = document.getElementById('btn-reset');

  const formRaza = document.getElementById('form-raza');
  const razaNombre = document.getElementById('razaNombre');
  const rangoMin = document.getElementById('rangoMin');
  const rangoMax = document.getElementById('rangoMax');
  const rangoEdadMin = document.getElementById('rangoEdadMin');
  const rangoEdadMax = document.getElementById('rangoEdadMax');
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
    if(rawRazas){
      const parsed = JSON.parse(rawRazas);
      // migrar formato antiguo (objeto con min/max) a array de rangos con edades 0-999
      if(parsed && typeof parsed === 'object' && !Array.isArray(parsed)){
        const migrated = {};
        Object.keys(parsed).forEach(k=>{
          const v = parsed[k];
          if(v && typeof v.min !== 'undefined' && typeof v.max !== 'undefined'){
            migrated[k] = [{ageMin:0, ageMax:999, min: Number(v.min), max: Number(v.max)}];
          } else {
            migrated[k] = v;
          }
        });
        razas = migrated;
      } else {
        razas = parsed;
      }
    }
    // si no hay razas, crear una por defecto
    if(!razas || Object.keys(razas).length===0){
      razas = {
        'General': [{ageMin:0, ageMax:999, min:200, max:600}]
      };
      saveRazas();
    }

    // migrar vacas antiguas que tengan 'nombre' en lugar de 'codigo'
    if(vacas && vacas.length){
      let changed = false;
      vacas.forEach(v=>{ if(!v.codigo && v.nombre){ v.codigo = v.nombre; delete v.nombre; changed = true; } });
      if(changed) saveVacas();
    }
  }


  function saveVacas(){ localStorage.setItem(LS_VACAS, JSON.stringify(vacas)); }
  function saveRazas(){ localStorage.setItem(LS_RAZAS, JSON.stringify(razas)); }

  function addOrUpdateRaza(nombre, ageMin, ageMax, min, max, editIndex){
    if(!razas[nombre]) razas[nombre] = [];
    const range = {ageMin: Number(ageMin), ageMax: Number(ageMax), min: Number(min), max: Number(max)};
    if(typeof editIndex === 'number' && !Number.isNaN(editIndex)){
      // edit existing range
      razas[nombre][editIndex] = range;
    } else {
      // enforce maximum of 3 ranges per raza
      if(razas[nombre].length >= 3){
        alert('Ya hay 3 rangos para la raza "' + nombre + '". Puedes editar uno existente o eliminar uno para agregar otro.');
        return;
      }
      razas[nombre].push(range);
    }
    saveRazas();
    renderRazas();
    populateRazaSelect();
  }

  function removeRango(nombre, index){
    if(!razas[nombre]) return;
    razas[nombre].splice(index,1);
    if(razas[nombre].length===0) delete razas[nombre];
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

  function registerVaca(codigo, fecha, peso, raza){
    const vaca = {
      id: nextId++,
      codigo: codigo || '',
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

  function edadEnAnios(fechaStr){
    if(!fechaStr) return 0;
    const nacido = new Date(fechaStr);
    const ahora = new Date();
    const diff = ahora - nacido;
    const years = diff / (1000*60*60*24*365.25);
    return Math.floor(years);
  }

  function clasificar(peso, raza, edadYears){
    const ranges = razas[raza];
    if(!ranges || ranges.length===0) return 'Sin rango';
    // buscar el rango de edad que corresponda
    const r = ranges.find(rr => edadYears >= rr.ageMin && edadYears <= rr.ageMax);
    // si no hay rango por edad, intentar 'General'
    let target = r;
    if(!target && razas['General'] && razas['General'].length>0){
      target = razas['General'][0];
    }
    if(!target) return 'Sin rango';
    if(peso < target.min) return 'Bajo peso';
    if(peso > target.max) return 'Sobrepeso';
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
    thead.innerHTML = '<tr><th>Raza</th><th>Edad (años)</th><th>Min (kg)</th><th>Max (kg)</th><th>Acciones</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    keys.forEach(r=>{
      const ranges = razas[r];
      // show count indicator row for this raza
      const countTr = document.createElement('tr');
      countTr.innerHTML = `<td colspan="5"><small>Raza: ${r} — Rangos: ${ranges.length}/3</small></td>`;
      tbody.appendChild(countTr);
      ranges.forEach((rg, idx)=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${r}</td><td>${rg.ageMin} - ${rg.ageMax}</td><td>${rg.min}</td><td>${rg.max}</td><td>`+
          `<button data-raza="${r}" data-idx="${idx}" class="edit-raza">Editar</button> `+
          `<button data-raza="${r}" data-idx="${idx}" class="del-rango">Eliminar rango</button></td>`;
        tbody.appendChild(tr);
      });
      const trAll = document.createElement('tr');
      trAll.innerHTML = `<td colspan="5"><button data-raza="${r}" class="del-raza">Eliminar raza ${r} (todas rangos)</button></td>`;
      tbody.appendChild(trAll);
    });
    table.appendChild(tbody);
    razasList.innerHTML = '';
    razasList.appendChild(table);

    // listeners
    [...razasList.querySelectorAll('.edit-raza')].forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const r = btn.getAttribute('data-raza');
        const idx = Number(btn.getAttribute('data-idx'));
        const rg = razas[r][idx];
        razaNombre.value = r;
        rangoMin.value = rg.min;
        rangoMax.value = rg.max;
        rangoEdadMin.value = rg.ageMin;
        rangoEdadMax.value = rg.ageMax;
        formRaza.dataset.editRaza = r;
        formRaza.dataset.editIndex = String(idx);
      });
    });
    [...razasList.querySelectorAll('.del-rango')].forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const r = btn.getAttribute('data-raza');
        const idx = Number(btn.getAttribute('data-idx'));
        if(confirm(`Eliminar rango de edad ${r}?`)) removeRango(r, idx);
      });
    });
    [...razasList.querySelectorAll('.del-raza')].forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const r = btn.getAttribute('data-raza');
        if(confirm(`Eliminar la raza "${r}" y todos sus rangos? Esto no eliminará vacas existentes.`)){
          removeRaza(r);
        }
      });
    });
  }

  function renderVacas(){
    if(vacas.length===0){ vacasList.innerHTML = '<small>No hay vacas registradas.</small>'; return; }
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>ID</th><th>Código</th><th>Raza</th><th>Fecha Nac</th><th>Peso (kg)</th><th>Edad</th><th>Clasificación</th><th>Acciones</th></tr></thead>';
    const tbody = document.createElement('tbody');
    vacas.forEach(v=>{
      const edad = edadEnAnios(v.fechaNacimiento);
      const cls = clasificar(v.peso, v.raza, edad);
      const clsClass = cls==='Bajo peso'? 'status-bajo' : (cls==='Peso promedio'? 'status-prom' : (cls==='Sobrepeso'? 'status-sobre' : ''));
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${v.id}</td>
        <td>${v.codigo || ''}</td>
        <td>${v.raza}</td>
        <td>${v.fechaNacimiento}</td>
        <td data-id="peso-${v.id}">${v.peso.toFixed(1)}</td>
        <td>${edad} años</td>
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
    const raza = razaSelect.value;
    if(!fecha || !peso || !raza){ alert('Complete los campos requeridos'); return; }
    // la raza debe tener exactamente 3 rangos para permitir registro
    if(!razas[raza] || razas[raza].length !== 3){
      alert('La raza seleccionada debe tener exactamente 3 rangos de edad antes de registrar vacas. Actualmente tiene ' + (razas[raza]? razas[raza].length : 0) + '.');
      return;
    }
    registerVaca(codigo, fecha, peso, raza);
    formRegistro.reset();
  });

  btnReset.addEventListener('click', ()=>{ formRegistro.reset(); });

  formRaza.addEventListener('submit', (e)=>{
    e.preventDefault();
    const nombre = razaNombre.value.trim();
    const min = rangoMin.value;
    const max = rangoMax.value;
    const ageMin = rangoEdadMin.value;
    const ageMax = rangoEdadMax.value;
    if(!nombre || min==='' || max==='' || ageMin==='' || ageMax===''){ alert('Complete los campos de raza'); return; }
    if(Number(min) > Number(max)){ alert('El mínimo no puede ser mayor que el máximo'); return; }
    if(Number(ageMin) > Number(ageMax)){ alert('La edad mínima no puede ser mayor que la máxima'); return; }
    const editRaza = formRaza.dataset.editRaza;
    const editIndex = formRaza.dataset.editIndex ? Number(formRaza.dataset.editIndex) : undefined;
    addOrUpdateRaza(nombre, ageMin, ageMax, min, max, editIndex);
    // clear edit flags
    delete formRaza.dataset.editRaza;
    delete formRaza.dataset.editIndex;
    formRaza.reset();
  });

  // Inicializar
  load();
  populateRazaSelect();
  renderRazas();
  renderVacas();
})();