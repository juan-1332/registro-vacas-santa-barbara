// App simple para registrar vacas y catalogar por peso
(function(){
  const LS_VACAS = 'vacas_app_v1';
  const LS_RAZAS = 'razas_app_v1';
  const RAZA_BRAHMAN = 'Brahman'; 
  /* Configura estas dos variables con las credenciales de tu proyecto Supabase. */
  const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
  const SUPABASE_ANON_KEY = 'TU-ANON-KEY';

  (function () {
    const RAZA_BRAHMAN = 'Brahman';
    const EDADES_BRAHMAN = [[9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 16], [16, 17], [17, 18], [18, 20], [20, 22], [22, 24], [24, 27], [27, 30], [30, 33], [33, 36], [36, 40], [40, 44], [44, 48]];
    const PESOS_BRAHMAN = {
      Macho: { max: [383, 420, 458, 497, 534, 572, 609, 645, 682, 731, 795, 844], promedio: [329, 363, 396, 431, 463, 498, 531, 563, 596, 639, 697, 742], min: [279, 307, 335, 365, 393, 423, 450, 480, 510, 549, 602, 645] },
      Hembra: { max: [332, 363, 395, 427, 457, 488, 517, 547, 576, 615, 661, 697], promedio: [284, 312, 341, 369, 397, 423, 449, 475, 506, 534, 573, 603], min: [247, 270, 293, 316, 338, 362, 383, 404, 426, 455, 489, 515] }
    };
    const localMode = SUPABASE_URL.includes('TU-PROYECTO');
    const db = !localMode && window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
    let currentUser = null;
    let currentRole = 'usuario';
    let vacas = [];
    let razas = {};

    const $ = id => document.getElementById(id);
    const authScreen = $('auth-screen');
    const authForm = $('auth-form');
    const authMessage = $('auth-message');
    const formRegistro = $('form-registro');

    function crearRangosBrahman() {
      return Object.fromEntries(['Macho', 'Hembra'].map(sexo => [sexo, EDADES_BRAHMAN.map(([ageMin, ageMax], index) => ({ ageMin, ageMax, min: PESOS_BRAHMAN[sexo].min[index] ?? null, max: PESOS_BRAHMAN[sexo].max[index] ?? null, promedio: PESOS_BRAHMAN[sexo].promedio[index] ?? null }))]));
    }

    function localUsers() { return JSON.parse(localStorage.getItem('sb_users') || '{}'); }
    function saveLocal() { localStorage.setItem('sb_vacas', JSON.stringify(vacas)); localStorage.setItem('sb_razas', JSON.stringify(razas)); }
    function localLogin(email, password) {
      const users = localUsers();
      if (!users[email] || users[email].password !== password) throw new Error('Correo o contraseña incorrectos.');
      return users[email];
    }

    async function signIn(email, password) {
      if (localMode) return localLogin(email, password);
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { id: data.user.id, email: data.user.email };
    }

    async function signUp(email, password) {
      if (localMode) {
        const users = localUsers();
        if (users[email]) throw new Error('Ese correo ya está registrado.');
        users[email] = { id: crypto.randomUUID(), email, password, role: Object.keys(users).length ? 'usuario' : 'admin' };
        localStorage.setItem('sb_users', JSON.stringify(users));
        return users[email];
      }
      const { data, error } = await db.auth.signUp({ email, password });
      if (error) throw error;
      return { id: data.user.id, email: data.user.email };
    }

    async function loadCloudData() {
      const [animalResult, breedResult] = await Promise.all([db.from('animals').select('*').order('created_at'), db.from('breeds').select('*').order('name')]);
      if (animalResult.error) throw animalResult.error;
      if (breedResult.error) throw breedResult.error;
      vacas = animalResult.data.map(item => ({ id: item.id, codigo: item.codigo, fechaNacimiento: item.fecha_nacimiento, peso: Number(item.peso), raza: item.raza, sexo: item.sexo, creadoPor: item.created_by }));
      razas = Object.fromEntries(breedResult.data.map(item => [item.name, { id: item.id, ranges: item.ranges, creadoPor: item.created_by }]));
      if (!razas[RAZA_BRAHMAN]) {
        const { data, error } = await db.from('breeds').insert({ name: RAZA_BRAHMAN, ranges: crearRangosBrahman(), created_by: currentUser.id }).select().single();
        if (error) throw error;
        razas[RAZA_BRAHMAN] = { id: data.id, ranges: data.ranges, creadoPor: data.created_by };
      }
    }

    function loadLocalData() {
      vacas = JSON.parse(localStorage.getItem('sb_vacas') || '[]');
      razas = JSON.parse(localStorage.getItem('sb_razas') || '{}');
      if (!razas[RAZA_BRAHMAN]) razas[RAZA_BRAHMAN] = { ranges: crearRangosBrahman(), creadoPor: currentUser.id };
      saveLocal();
    }

    async function loadData() { if (localMode) loadLocalData(); else await loadCloudData(); }
    function isOwner(item) { return item.creadoPor === currentUser.id || item.created_by === currentUser.id; }
    function canManage(item) { return currentRole === 'admin' || isOwner(item); }
    function edadEnMeses(fecha) { const born = new Date(fecha); const now = new Date(); let months = (now.getFullYear() - born.getFullYear()) * 12 + now.getMonth() - born.getMonth(); if (now.getDate() < born.getDate()) months--; return Math.max(0, months); }
    function clasificar(peso, sexo, edad, raza) {
      const ranges = razas[raza]?.ranges?.[sexo] || [];
      const range = ranges.find((item, index) => edad >= item.ageMin && (index === ranges.length - 1 ? edad <= item.ageMax : edad < item.ageMax));
      if (!range) return 'Sin rango';
      if (typeof range.min !== 'number' || typeof range.max !== 'number') return 'Sin datos';
      return peso < range.min ? 'Bajo peso' : peso > range.max ? 'Sobrepeso' : 'Peso promedio';
    }

    async function addAnimal(animal) {
      let id = crypto.randomUUID();
      if (db) { const { data, error } = await db.from('animals').insert({ codigo: animal.codigo, fecha_nacimiento: animal.fechaNacimiento, peso: animal.peso, raza: animal.raza, sexo: animal.sexo, created_by: currentUser.id }).select().single(); if (error) throw error; id = data.id; }
      vacas.push({ ...animal, id, creadoPor: currentUser.id }); saveLocal();
    }
    async function deleteAnimal(animal) {
      if (!canManage(animal)) return;
      if (db) { const { error } = await db.from('animals').delete().eq('id', animal.id); if (error) throw error; }
      vacas = vacas.filter(item => item.id !== animal.id); saveLocal(); renderVacas();
    }
    async function updateAnimal(animal, peso) {
      if (db) { const { error } = await db.from('animals').update({ peso }).eq('id', animal.id); if (error) throw error; }
      animal.peso = peso; saveLocal(); renderVacas();
    }

    function renderRazaSelect() { $('razaSelect').innerHTML = Object.keys(razas).map(name => `<option value="${name}">${name}</option>`).join(''); }
    function renderRazas() {
      const list = $('razasList'); list.innerHTML = '';
      Object.entries(razas).forEach(([name, breed]) => {
        const heading = document.createElement('div'); heading.className = 'breed-heading'; heading.innerHTML = `<h3>${name}</h3>`;
        if (currentRole === 'admin' || canManage(breed)) { const button = document.createElement('button'); button.className = 'del-raza'; button.textContent = 'Eliminar raza'; button.onclick = () => deleteBreed(name, breed); heading.appendChild(button); }
        list.appendChild(heading);
        ['Macho', 'Hembra'].forEach(sexo => {
          const table = document.createElement('table'); table.innerHTML = '<thead><tr><th>Competencia</th><th>Máx. (kg)</th><th>Prom. (kg)</th><th>Mín. (kg)</th><th>Acciones</th></tr></thead>';
          const tbody = document.createElement('tbody');
          (breed.ranges[sexo] || []).forEach((range, index) => { const row = document.createElement('tr'); row.innerHTML = `<td>${range.ageMin} a ${range.ageMax} meses</td><td>${range.max ?? '-'}</td><td>${range.promedio ?? '-'}</td><td>${range.min ?? '-'}</td><td></td>`; if (currentRole === 'admin') { const button = document.createElement('button'); button.className = 'edit-range'; button.textContent = 'Editar'; button.onclick = () => editRange(name, sexo, index); row.lastElementChild.appendChild(button); } tbody.appendChild(row); });
          table.appendChild(tbody); list.appendChild(table);
        });
      });
    }
    function renderVacas() {
      const filter = $('buscarCodigo').value.trim().toLowerCase(); const shown = vacas.filter(item => (item.codigo || '').toLowerCase().includes(filter));
      if (!shown.length) { $('vacasList').innerHTML = '<small>No hay bovinos que mostrar.</small>'; return; }
      const table = document.createElement('table'); table.innerHTML = '<thead><tr><th>Código</th><th>Raza</th><th>Sexo</th><th>Fecha Nac.</th><th>Peso</th><th>Edad</th><th>Clasificación</th><th>Acciones</th></tr></thead>';
      const body = document.createElement('tbody'); shown.forEach(item => { const age = edadEnMeses(item.fechaNacimiento); const row = document.createElement('tr'); row.innerHTML = `<td>${item.codigo}</td><td>${item.raza}</td><td>${item.sexo}</td><td>${item.fechaNacimiento}</td><td>${item.peso.toFixed(1)}</td><td>${age} meses</td><td>${clasificar(item.peso, item.sexo, age, item.raza)}</td><td></td>`; if (currentRole === 'admin' || canManage(item)) { if (currentRole === 'admin') { const edit = document.createElement('button'); edit.className = 'editar-peso'; edit.textContent = 'Editar peso'; edit.onclick = () => { const value = prompt('Nuevo peso (kg):', item.peso); if (value !== null && Number(value) > 0) updateAnimal(item, Number(value)).catch(showError); }; row.lastElementChild.append(edit); } if (canManage(item)) { const del = document.createElement('button'); del.className = 'borrar-vaca'; del.textContent = 'Eliminar'; del.onclick = () => { if (confirm('¿Eliminar este bovino?')) deleteAnimal(item).catch(showError); }; row.lastElementChild.append(del); } } body.appendChild(row); }); table.appendChild(body); $('vacasList').replaceChildren(table);
    }
    async function deleteBreed(name, breed) { if (!confirm(`¿Eliminar la raza ${name}?`)) return; if (db) { const { error } = await db.from('breeds').delete().eq('id', breed.id); if (error) return showError(error); } delete razas[name]; saveLocal(); renderRazaSelect(); renderRazas(); }
    async function editRange(name, sexo, index) { const range = razas[name].ranges[sexo][index]; const values = ['min', 'promedio', 'max'].map(key => prompt(`${key} (kg):`, range[key] ?? '')); if (values.some(value => value === null || value === '' || Number.isNaN(Number(value)))) return; Object.assign(range, { min: Number(values[0]), promedio: Number(values[1]), max: Number(values[2]) }); if (db) { const { error } = await db.from('breeds').update({ ranges: razas[name].ranges }).eq('id', razas[name].id); if (error) return showError(error); } saveLocal(); renderRazas(); renderVacas(); }
    function showError(error) { alert(error.message || error); }
    function applyRole() { $('session-user').textContent = currentUser.email; $('session-role').textContent = currentRole; $('registro-panel').classList.remove('hidden'); $('razas-admin').classList.toggle('hidden', currentRole !== 'admin'); $('rangos-panel').classList.add('hidden'); $('btn-toggle-rangos').textContent = 'Rangos'; $('auth-screen').classList.add('hidden'); document.querySelector('main').classList.remove('hidden'); }

    authForm.addEventListener('submit', async event => { event.preventDefault(); authMessage.textContent = 'Procesando...'; try { const isRegister = authForm.dataset.mode === 'register'; currentUser = await (isRegister ? signUp($('auth-email').value.trim(), $('auth-password').value) : signIn($('auth-email').value.trim(), $('auth-password').value)); currentRole = currentUser.role || 'usuario'; if (!localMode && !currentUser.role) { const { data } = await db.from('profiles').select('role').eq('id', currentUser.id).single(); currentRole = data?.role || 'usuario'; } await loadData(); applyRole(); renderRazaSelect(); renderRazas(); renderVacas(); } catch (error) { authMessage.textContent = error.message || 'No se pudo iniciar sesión.'; } });
    document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => { const register = button.dataset.authMode === 'register'; document.querySelectorAll('.auth-tab').forEach(item => item.classList.toggle('active', item === button)); authForm.dataset.mode = register ? 'register' : 'login'; $('auth-submit').textContent = register ? 'Crear cuenta' : 'Entrar'; }));
    $('btn-logout').onclick = async () => { if (db) await db.auth.signOut(); location.reload(); };
    $('buscarCodigo').addEventListener('input', renderVacas);
    $('btn-toggle-rangos').onclick = () => { const hidden = $('rangos-panel').classList.toggle('hidden'); $('btn-toggle-rangos').textContent = hidden ? 'Rangos' : 'Cerrar rangos'; };
    formRegistro.addEventListener('submit', async event => { event.preventDefault(); const animal = { codigo: $('codigo').value.trim(), fechaNacimiento: $('fechaNacimiento').value, peso: Number($('peso').value), raza: $('razaSelect').value, sexo: $('sexoSelect').value }; if (!animal.codigo || !animal.fechaNacimiento || animal.peso <= 0) return alert('Complete los datos correctamente.'); try { await addAnimal(animal); formRegistro.reset(); renderVacas(); } catch (error) { showError(error); } });
    $('form-raza').addEventListener('submit', async event => { event.preventDefault(); const name = $('nueva-raza').value.trim(); if (!name || razas[name]) return alert('Indique un nombre nuevo.'); const breed = { ranges: { Macho: [], Hembra: [] }, creadoPor: currentUser.id }; if (db) { const { data, error } = await db.from('breeds').insert({ name, ranges: breed.ranges, created_by: currentUser.id }).select().single(); if (error) return showError(error); breed.id = data.id; } razas[name] = breed; saveLocal(); event.target.reset(); renderRazaSelect(); renderRazas(); });
  })();
  return;
  const EDADES_BRAHMAN = [
    [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15],
    [15, 16], [16, 17], [17, 18], [18, 20], [20, 22], [22, 24],
    [24, 27], [27, 30], [30, 33], [33, 36], [36, 40], [40, 44], [44, 48]
  ];
  const PESOS_BRAHMAN = {
    Macho: {
      max: [383, 420, 458, 497, 534, 572, 609, 645, 682, 731, 795, 844, null, null, null, null, null, null, null],
      promedio: [329, 363, 396, 431, 463, 498, 531, 563, 596, 639, 697, 742, null, null, null, null, null, null, null],
      min: [279, 307, 335, 365, 393, 423, 450, 480, 510, 549, 602, 645, null, null, null, null, null, null, null]
    },
    Hembra: {
      max: [332, 363, 395, 427, 457, 488, 517, 547, 576, 615, 661, 697, null, null, null, null, null, null, null],
      promedio: [284, 312, 341, 369, 397, 423, 449, 475, 506, 534, 573, 603, null, null, null, null, null, null, null],
      min: [247, 270, 293, 316, 338, 362, 383, 404, 426, 455, 489, 515, null, null, null, null, null, null, null]
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
  const btnToggleRangos = document.getElementById('btn-toggle-rangos');
  const rangosPanel = document.getElementById('rangos-panel');

  const vacasList = document.getElementById('vacasList');
  const buscarCodigo = document.getElementById('buscarCodigo');

  // Cargar desde localStorage
  function load(){
    const rawVacas = localStorage.getItem(LS_VACAS);
    const rawRazas = localStorage.getItem(LS_RAZAS);
    if(rawVacas){
      vacas = JSON.parse(rawVacas);
      if(vacas.length) nextId = Math.max(...vacas.map(v=>v.id))+1;
    }

    const rangosDefault = { [RAZA_BRAHMAN]: crearRangosBrahman() };
    if(rawRazas){
      try {
        const parsed = JSON.parse(rawRazas);
        if(parsed && parsed[RAZA_BRAHMAN] && parsed[RAZA_BRAHMAN].Macho && parsed[RAZA_BRAHMAN].Hembra){
          razas = parsed;
        } else {
          razas = rangosDefault;
        }
      } catch (error) {
        razas = rangosDefault;
      }
    } else {
      razas = rangosDefault;
    }
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
    const r = ranges.find((rr, index) => edad >= rr.ageMin && (index === ranges.length - 1 ? edad <= rr.ageMax : edad < rr.ageMax));
    const target = r;
    if(!target) return 'Sin rango';
    if(typeof target.min !== 'number' || typeof target.max !== 'number') return 'Sin datos';
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
      table.innerHTML = '<thead><tr><th>Competencia</th><th>Máx. (kg)</th><th>Prom. (kg)</th><th>Mín. (kg)</th></tr></thead>';
      const tbody = document.createElement('tbody');
      razas[RAZA_BRAHMAN][sexo].forEach((rango, index)=>{
        const row = document.createElement('tr');
        const mostrar = valor => typeof valor === 'number' ? valor : '-';
        row.innerHTML = `<td>${String(rango.ageMin).padStart(2, '0')} a ${String(rango.ageMax).padStart(2, '0')} meses</td><td>${mostrar(rango.max)}</td><td>${mostrar(rango.promedio)}</td><td>${mostrar(rango.min)}</td>`;
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      razasList.appendChild(table);
    });
  }

  function renderVacas(){
    const filtro = buscarCodigo.value.trim().toLowerCase();
    const bovinos = vacas.filter(v => (v.codigo || '').toLowerCase().includes(filtro));
    if(bovinos.length===0){
      vacasList.innerHTML = filtro ? '<small>No se encontraron bovinos con ese código.</small>' : '<small>No hay bovinos registrados.</small>';
      return;
    }
    const table = document.createElement('table');
      table.innerHTML = '<thead><tr><th>Código</th><th>Raza</th><th>Sexo</th><th>Fecha Nac</th><th>Peso (kg)</th><th>Edad</th><th>Clasificación</th><th>Acciones</th></tr></thead>';
    const tbody = document.createElement('tbody');
    bovinos.forEach(v=>{
      const edad = edadEnMeses(v.fechaNacimiento);
      const cls = clasificar(v.peso, v.sexo || 'Macho', edad);
      const clsClass = cls==='Bajo peso'? 'status-bajo' : (cls==='Peso promedio'? 'status-prom' : (cls==='Sobrepeso'? 'status-sobre' : ''));
      const tr = document.createElement('tr');
      tr.innerHTML = `
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
    if(!codigo || !fecha || !peso || !sexo){ alert('Complete todos los campos requeridos'); return; }
    if(!Number.isFinite(Number(peso)) || Number(peso) <= 0){ alert('Ingrese un peso válido mayor que 0 kg'); return; }
    const fechaNacimiento = new Date(`${fecha}T00:00:00`);
    if(Number.isNaN(fechaNacimiento.getTime()) || fechaNacimiento > new Date()){
      alert('Ingrese una fecha de nacimiento válida');
      return;
    }
    registerVaca(codigo, fecha, peso, sexo);
    formRegistro.reset();
  });

  btnReset.addEventListener('click', ()=>{ formRegistro.reset(); });
  buscarCodigo.addEventListener('input', renderVacas);

  btnToggleRangos.addEventListener('click', () => {
    const isHidden = rangosPanel.classList.toggle('hidden');
    btnToggleRangos.textContent = isHidden ? 'Rangos' : 'Cerrar rangos';
    btnToggleRangos.setAttribute('aria-expanded', String(!isHidden));
  });

  // Inicializar
  load();
  renderRazas();
  renderVacas();
})();