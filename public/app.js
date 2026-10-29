// Validar Autenticación
if (!sessionStorage.getItem('authenticated')) {
  window.location.href = 'login.html';
}

const userRole = sessionStorage.getItem('role') || 'usuario';

document.addEventListener('DOMContentLoaded', () => {
  configurarVistaSegunRol();
  generarCodigosQR();
  cargarInventario();
  cargarPersonalTiempoReal();

  if (userRole === 'admin') {
    cargarReporteSemanal();
  }
});

document.getElementById('btn-logout').addEventListener('click', () => {
  sessionStorage.clear();
  window.location.href = 'login.html';
});

// Configurar vista según el rol (TENS vs Admin)
function configurarVistaSegunRol() {
  const lblRol = document.getElementById('lbl-rol');

  if (userRole === 'admin') {
    lblRol.textContent = '| Modo Administrador (Control Total)';
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'inline-block');
  } else {
    lblRol.textContent = '| Modo Usuario (Personal de Turno / TENS)';
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  }
}

function esMedicamento(item) {
  if (item.categoria && item.categoria.toLowerCase() === 'medicamento') return true;
  if (item.categoria && item.categoria.toLowerCase() === 'aseo') return false;
  const nom = item.nombre.toLowerCase();
  return nom.includes('mg') || nom.includes('sertralina') || nom.includes('fluoxetina') || 
         nom.includes('clonazepam') || nom.includes('quetiapina') || nom.includes('escitalopram');
}

// Generar QR dinámicos con URL real del dominio
async function generarCodigosQR() {
  try {
    const baseUrl = window.location.origin;

    const urlFicha1 = `${baseUrl}/ficha/1`;
    const urlFicha2 = `${baseUrl}/ficha/2`;

    const qr1Url = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(urlFicha1)}`;
    const qr2Url = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(urlFicha2)}`;

    const img1 = document.getElementById('qr-residente-1');
    const img2 = document.getElementById('qr-residente-2');
    const link1 = document.getElementById('link-directo-1');
    const link2 = document.getElementById('link-directo-2');

    if (img1) img1.src = qr1Url;
    if (img2) img2.src = qr2Url;
    if (link1) link1.href = `/ficha/1`;
    if (link2) link2.href = `/ficha/2`;
  } catch (error) {
    console.error('Error al generar los códigos QR:', error);
  }
}

// Cargar Tabla de Inventario manteniéndose en 0 si se agota
async function cargarInventario() {
  try {
    const res = await fetch('/api/inventario');
    const items = await res.json();

    const tablaMed = document.getElementById('tabla-medicamentos');
    const tablaAseo = document.getElementById('tabla-aseo');

    tablaMed.innerHTML = '';
    tablaAseo.innerHTML = '';

    if (userRole === 'admin') {
      poblarSelects(items);
    }

    items.forEach(item => {
      const isMed = esMedicamento(item);
      const unidadLabel = isMed ? 'cajas' : 'unidades';

      const badgeColor = item.stock > 0 ? 'bg-success' : 'bg-danger';
      const badgeTexto = item.stock > 0 ? `${item.stock} ${unidadLabel}` : 'Agotado (0)';
      const botonTexto = isMed ? '- Usar 1 Caja' : '- Usar 1 Unidad';
      const btnEstilo = item.stock > 0 ? 'btn-warning' : 'btn-outline-danger';

      const fila = `
        <tr>
          <td class="fw-bold text-light">${item.nombre}</td>
          <td><span class="badge ${badgeColor} fs-6">${badgeTexto}</span></td>
          <td class="small text-secondary">${item.pauta || 'N/A'}</td>
          <td class="text-end">
            <button class="btn ${btnEstilo} btn-sm fw-bold px-3" onclick="usarUnidad(${item.id}, ${item.stock})">
              ${botonTexto}
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

// Descontar unidad o emitir alerta si el stock es 0
async function usarUnidad(id, stockActual) {
  if (stockActual <= 0) {
    alert('⚠️ Debe reponer stock. El producto se encuentra agotado.');
    return;
  }

  try {
    const res = await fetch('/api/inventario/usar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, cantidad: 1, usuario: userRole === 'admin' ? 'Administrador' : 'TENS de Turno' })
    });
    
    const data = await res.json();
    
    if (data.success) {
      cargarInventario();
      if (userRole === 'admin') cargarReporteSemanal();
    } else if (data.error) {
      alert(`⚠️ ${data.error}`);
    }
  } catch (error) {
    console.error('Error al descontar unidad:', error);
  }
}

// Personal de Turno en Tiempo Real
async function cargarPersonalTiempoReal() {
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const hoyIndex = new Date().getDay();
  const diaHoy = diasSemana[hoyIndex];

  const lblDia = document.getElementById('lbl-dia-actual');
  if (lblDia) lblDia.textContent = diaHoy;

  try {
    const res = await fetch('/api/personal');
    const lista = await res.json();

    const tabla = document.getElementById('tabla-personal');
    tabla.innerHTML = '';

    lista.forEach(p => {
      const leTocaHoy = p.dias.includes('Todos') || p.dias.includes(diaHoy);
      const estadoBadge = leTocaHoy ? '<span class="badge bg-success">En Turno Hoy</span>' : '<span class="badge bg-secondary">Fuera de Turno</span>';

      tabla.innerHTML += `
        <tr class="${leTocaHoy ? '' : 'opacity-50'}">
          <td class="fw-bold text-light">${p.nombre}</td>
          <td><span class="badge bg-secondary">${p.rol}</span></td>
          <td class="small text-secondary">${p.area}</td>
          <td class="small">${p.horario}</td>
          <td class="small text-warning">🍎 ${p.colacion}</td>
          <td>${estadoBadge}</td>
        </tr>
      `;
    });
  } catch (error) {
    console.error('Error personal:', error);
  }
}

// Cargar Reporte de Consumo Semanal (Consolidado)
async function cargarReporteSemanal() {
  try {
    const res = await fetch('/api/consumo/semanal');
    const historial = await res.json();

    const tbody = document.getElementById('tabla-reporte-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (historial.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No hay consumos registrados en los últimos 7 días.</td></tr>`;
      return;
    }

    historial.forEach(h => {
      const unidad = h.categoria === 'medicamento' ? 'cajas' : 'unidades';
      tbody.innerHTML += `
        <tr>
          <td class="fw-bold text-light">${h.producto_nombre}</td>
          <td><span class="badge bg-secondary text-capitalize">${h.categoria}</span></td>
          <td class="fw-bold text-warning fs-6">${h.total_consumido} ${unidad}</td>
          <td class="small text-secondary">${h.ultima_fecha || 'Reciente'}</td>
        </tr>
      `;
    });
  } catch (error) {
    console.error('Error al cargar reporte:', error);
  }
}

// Exportar Reporte Consolidado a CSV / Excel
function exportarCSV() {
  fetch('/api/consumo/semanal')
    .then(res => res.json())
    .then(data => {
      if (data.length === 0) {
        alert('No hay consumos registrados para exportar.');
        return;
      }

      let csv = 'Producto,Categoria,Total_Consumido_Semanal,Ultima_Fecha_Registro\n';
      data.forEach(row => {
        csv += `"${row.producto_nombre}","${row.categoria}",${row.total_consumido},"${row.ultima_fecha}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `Consumo_Semanal_Consolidado_Clinica_Vital_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
}

function poblarSelects(itemsEnBD) {
  const selectMed = document.getElementById('med-select');
  const selectAseo = document.getElementById('aseo-select');
  if (!selectMed || !selectAseo) return;

  selectMed.innerHTML = `<option value="">-- Seleccionar medicamento --</option>`;
  selectAseo.innerHTML = `<option value="">-- Seleccionar artículo de aseo --</option>`;

  itemsEnBD.filter(item => esMedicamento(item)).forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.nombre;
    opt.textContent = `${m.nombre} (Stock actual: ${m.stock} cajas)`;
    selectMed.appendChild(opt);
  });
  selectMed.innerHTML += `<option value="__NUEVO__">➕ Registrar NUEVO medicamento...</option>`;

  itemsEnBD.filter(item => !esMedicamento(item)).forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.nombre;
    opt.textContent = `${a.nombre} (Stock actual: ${a.stock} unidades)`;
    selectAseo.appendChild(opt);
  });
  selectAseo.innerHTML += `<option value="__NUEVO__">➕ Registrar NUEVO artículo...</option>`;
}

// Control de selección en Modales de Admin
document.getElementById('med-select')?.addEventListener('change', (e) => {
  const val = e.target.value;
  const divNuevo = document.getElementById('div-med-nuevo');
  const inputNuevo = document.getElementById('med-nombre-nuevo');
  if (divNuevo) divNuevo.style.display = val === '__NUEVO__' ? 'block' : 'none';
  if (inputNuevo) inputNuevo.required = val === '__NUEVO__';
});

document.getElementById('aseo-select')?.addEventListener('change', (e) => {
  const val = e.target.value;
  const divNuevo = document.getElementById('div-aseo-nuevo');
  const inputNuevo = document.getElementById('aseo-nombre-nuevo');
  if (divNuevo) divNuevo.style.display = val === '__NUEVO__' ? 'block' : 'none';
  if (inputNuevo) inputNuevo.required = val === '__NUEVO__';
});

// Guardar Medicamento (Admin)
document.getElementById('form-med')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const selectVal = document.getElementById('med-select').value;
  let nombre = selectVal === '__NUEVO__' ? document.getElementById('med-nombre-nuevo').value.trim() : selectVal;
  if (!nombre) return;

  const cantidad = document.getElementById('med-cantidad').value;
  const pauta = document.getElementById('med-pauta').value;

  const res = await fetch('/api/inventario/agregar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, cantidad, categoria: 'medicamento', pauta })
  });

  const data = await res.json();
  if (data.success) {
    bootstrap.Modal.getInstance(document.getElementById('modalAgregarMedicamento')).hide();
    cargarInventario();
  }
});

// Guardar Aseo (Admin)
document.getElementById('form-aseo')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const selectVal = document.getElementById('aseo-select').value;
  let nombre = selectVal === '__NUEVO__' ? document.getElementById('aseo-nombre-nuevo').value.trim() : selectVal;
  if (!nombre) return;

  const cantidad = document.getElementById('aseo-cantidad').value;
  const pauta = document.getElementById('aseo-pauta').value;

  const res = await fetch('/api/inventario/agregar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, cantidad, categoria: 'aseo', pauta })
  });

  const data = await res.json();
  if (data.success) {
    bootstrap.Modal.getInstance(document.getElementById('modalAgregarAseo')).hide();
    cargarInventario();
  }
});