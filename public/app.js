// Validar Autenticación de Sesión
if (!sessionStorage.getItem('authenticated')) {
  window.location.href = 'login.html';
}

document.getElementById('btn-logout').addEventListener('click', () => {
  sessionStorage.clear();
  window.location.href = 'login.html';
});

// Identificador estricto de categoría
function esMedicamento(item) {
  if (item.categoria && item.categoria.toLowerCase() === 'medicamento') return true;
  if (item.categoria && item.categoria.toLowerCase() === 'aseo') return false;
  
  const nom = item.nombre.toLowerCase();
  return nom.includes('mg') || nom.includes('sertralina') || nom.includes('fluoxetina') || 
         nom.includes('clonazepam') || nom.includes('quetiapina') || nom.includes('escitalopram') || 
         nom.includes('amitriptilina') || nom.includes('venlafaxina');
}

// Generación de Códigos QR
async function generarCodigosQR() {
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    
    const ip = config.ip;
    const port = config.port;

    const urlFicha1 = `http://${ip}:${port}/ficha/1`;
    const urlFicha2 = `http://${ip}:${port}/ficha/2`;

    const qr1Url = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(urlFicha1)}`;
    const qr2Url = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(urlFicha2)}`;

    const imgQr1 = document.getElementById('qr-residente-1');
    const imgQr2 = document.getElementById('qr-residente-2');
    const link1 = document.getElementById('link-directo-1');
    const link2 = document.getElementById('link-directo-2');

    if (imgQr1) imgQr1.src = qr1Url;
    if (imgQr2) imgQr2.src = qr2Url;
    if (link1) link1.href = `/ficha/1`;
    if (link2) link2.href = `/ficha/2`;

  } catch (error) {
    console.error('Error al generar los códigos QR:', error);
  }
}

// Poblar los desplegables ÚNICAMENTE con los productos que existen en la BD + Opción Nuevo
function poblarSelects(itemsEnBD) {
  const selectMed = document.getElementById('med-select');
  const selectAseo = document.getElementById('aseo-select');

  if (!selectMed || !selectAseo) return;

  const currentMed = selectMed.value;
  const currentAseo = selectAseo.value;

  selectMed.innerHTML = `<option value="">-- Seleccionar medicamento --</option>`;
  selectAseo.innerHTML = `<option value="">-- Seleccionar artículo de aseo --</option>`;

  // A) MEDICAMENTOS (Solo los únicos de la BD)
  const medicamentos = itemsEnBD.filter(item => esMedicamento(item));
  medicamentos.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.nombre;
    opt.dataset.pauta = m.pauta || '';
    opt.textContent = `${m.nombre} (Stock actual: ${m.stock} cajas)`;
    selectMed.appendChild(opt);
  });

  const optMedNuevo = document.createElement('option');
  optMedNuevo.value = '__NUEVO__';
  optMedNuevo.textContent = '➕ Registrar NUEVO medicamento NO listado...';
  selectMed.appendChild(optMedNuevo);

  // B) ARTÍCULOS DE ASEO (Solo los únicos de la BD)
  const aseoItems = itemsEnBD.filter(item => !esMedicamento(item));
  aseoItems.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.nombre;
    opt.dataset.pauta = a.pauta || '';
    opt.textContent = `${a.nombre} (Stock actual: ${a.stock} unidades)`;
    selectAseo.appendChild(opt);
  });

  const optAseoNuevo = document.createElement('option');
  optAseoNuevo.value = '__NUEVO__';
  optAseoNuevo.textContent = '➕ Registrar NUEVO artículo NO listado...';
  selectAseo.appendChild(optAseoNuevo);

  if (currentMed) selectMed.value = currentMed;
  if (currentAseo) selectAseo.value = currentAseo;
}

// Control de campos al cambiar de opción en modales
document.getElementById('med-select').addEventListener('change', (e) => {
  const val = e.target.value;
  const divNuevo = document.getElementById('div-med-nuevo');
  const inputNuevo = document.getElementById('med-nombre-nuevo');
  const inputPauta = document.getElementById('med-pauta');

  if (val === '__NUEVO__') {
    divNuevo.style.display = 'block';
    inputNuevo.required = true;
    inputNuevo.value = '';
    inputPauta.value = 'Mañana: 1, Tarde: 0, Noche: 1 (sueño), SOS: 1';
  } else {
    divNuevo.style.display = 'none';
    inputNuevo.required = false;
    const opt = e.target.options[e.target.selectedIndex];
    if (opt && opt.dataset.pauta) {
      inputPauta.value = opt.dataset.pauta;
    }
  }
});

document.getElementById('aseo-select').addEventListener('change', (e) => {
  const val = e.target.value;
  const divNuevo = document.getElementById('div-aseo-nuevo');
  const inputNuevo = document.getElementById('aseo-nombre-nuevo');
  const inputPauta = document.getElementById('aseo-pauta');

  if (val === '__NUEVO__') {
    divNuevo.style.display = 'block';
    inputNuevo.required = true;
    inputNuevo.value = '';
    inputPauta.value = 'Higienización e insumos de limpieza';
  } else {
    divNuevo.style.display = 'none';
    inputNuevo.required = false;
    const opt = e.target.options[e.target.selectedIndex];
    if (opt && opt.dataset.pauta) {
      inputPauta.value = opt.dataset.pauta;
    }
  }
});

// Cargar e Imprimir el Inventario Único desde SQLite
async function cargarInventario() {
  try {
    const res = await fetch('/api/inventario');
    const items = await res.json();

    const tablaMed = document.getElementById('tabla-medicamentos');
    const tablaAseo = document.getElementById('tabla-aseo');

    tablaMed.innerHTML = '';
    tablaAseo.innerHTML = '';

    // Poblar las listas desplegables
    poblarSelects(items);

    items.forEach(item => {
      const isMed = esMedicamento(item);
      const unidadLabel = isMed ? 'cajas' : 'unidades';

      const badgeColor = item.stock > 0 ? 'bg-success' : 'bg-danger';
      const badgeTexto = item.stock > 0 ? `${item.stock} ${unidadLabel}` : 'Agotado (0)';

      const fila = `
        <tr>
          <td class="fw-bold text-light">${item.nombre}</td>
          <td><span class="badge ${badgeColor} fs-6">${badgeTexto}</span></td>
          <td class="small text-secondary">${item.pauta || 'N/A'}</td>
          <td class="text-end">
            <button class="btn btn-warning btn-sm fw-bold me-1" onclick="usarUnidades(${item.id}, 1)" ${item.stock === 0 ? 'disabled' : ''}>
              - Usar 1
            </button>
            <button class="btn btn-outline-warning btn-sm fw-bold" onclick="usarUnidades(${item.id}, 5)" ${item.stock === 0 ? 'disabled' : ''}>
              - Usar 5
            </button>
          </td>
        </tr>
      `;

      if (isMed) {
        tablaMed.innerHTML += fila;
      } else {
        tablaAseo.innerHTML += fila;
      }
    });

  } catch (error) {
    console.error('Error al cargar inventario:', error);
  }
}

// Cargar Personal de Turno
async function cargarPersonal() {
  try {
    const res = await fetch('/api/personal');
    const lista = await res.json();

    const tabla = document.getElementById('tabla-personal');
    tabla.innerHTML = '';

    lista.forEach(p => {
      tabla.innerHTML += `
        <tr>
          <td class="fw-bold text-light">${p.nombre}</td>
          <td><span class="badge bg-secondary">${p.rol}</span></td>
          <td class="small text-secondary">${p.area}</td>
          <td class="small">${p.horario}</td>
          <td class="small text-warning">🍎 ${p.colacion}</td>
          <td><span class="badge bg-success">${p.estado}</span></td>
        </tr>
      `;
    });
  } catch (error) {
    console.error('Error al cargar personal:', error);
  }
}

// Descontar N unidades (1 o 5)
async function usarUnidades(id, cantidad) {
  try {
    const res = await fetch('/api/inventario/usar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, cantidad })
    });
    const data = await res.json();
    if (data.success) cargarInventario();
  } catch (error) {
    console.error('Error:', error);
  }
}

// Guardar Medicamento
document.getElementById('form-med').addEventListener('submit', async (e) => {
  e.preventDefault();
  const selectVal = document.getElementById('med-select').value;
  let nombre = '';

  if (!selectVal) {
    alert('Por favor seleccione un medicamento.');
    return;
  }

  if (selectVal === '__NUEVO__') {
    nombre = document.getElementById('med-nombre-nuevo').value.trim();
    if (!nombre) return;
  } else {
    nombre = selectVal;
  }

  const cantidad = document.getElementById('med-cantidad').value;
  const pauta = document.getElementById('med-pauta').value;

  const res = await fetch('/api/inventario/agregar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, cantidad, categoria: 'medicamento', pauta })
  });

  const data = await res.json();

  if (data.success) {
    document.getElementById('med-select').value = '';
    document.getElementById('div-med-nuevo').style.display = 'none';
    document.getElementById('med-nombre-nuevo').value = '';
    document.getElementById('med-nombre-nuevo').required = false;

    bootstrap.Modal.getInstance(document.getElementById('modalAgregarMedicamento')).hide();
    await cargarInventario();
  }
});

// Guardar Artículo de Aseo
document.getElementById('form-aseo').addEventListener('submit', async (e) => {
  e.preventDefault();
  const selectVal = document.getElementById('aseo-select').value;
  let nombre = '';

  if (!selectVal) {
    alert('Por favor seleccione un artículo.');
    return;
  }

  if (selectVal === '__NUEVO__') {
    nombre = document.getElementById('aseo-nombre-nuevo').value.trim();
    if (!nombre) return;
  } else {
    nombre = selectVal;
  }

  const cantidad = document.getElementById('aseo-cantidad').value;
  const pauta = document.getElementById('aseo-pauta').value;

  const res = await fetch('/api/inventario/agregar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, cantidad, categoria: 'aseo', pauta })
  });

  const data = await res.json();

  if (data.success) {
    document.getElementById('aseo-select').value = '';
    document.getElementById('div-aseo-nuevo').style.display = 'none';
    document.getElementById('aseo-nombre-nuevo').value = '';
    document.getElementById('aseo-nombre-nuevo').required = false;

    bootstrap.Modal.getInstance(document.getElementById('modalAgregarAseo')).hide();
    await cargarInventario();
  }
});

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  generarCodigosQR();
  cargarInventario();
  cargarPersonal();
});