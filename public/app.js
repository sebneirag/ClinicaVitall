if (!sessionStorage.getItem('authenticated')) {
  window.location.href = 'login.html';
}

const userRole = sessionStorage.getItem('role') || 'usuario';
const userName = sessionStorage.getItem('username') || 'Personal TENS';
const userKey = sessionStorage.getItem('userKey') || 'tens';

document.addEventListener('DOMContentLoaded', () => {
  configurarVistaSegunRol();
  cargarInventario();
  cargarPersonalTiempoReal();

  if (userKey === 'admin' || userKey === 'tens') {
    cargarPacientes();
  }

  if (userRole === 'admin') {
    cargarReporteSemanal();
    cargarSupervision();
    comprobarAlertasStockAdmin();
  }
});

document.getElementById('btn-logout').addEventListener('click', () => {
  sessionStorage.clear();
  window.location.href = 'login.html';
});

// Lógica de Permisos Estricta por Rol
function configurarVistaSegunRol() {
  const lblRol = document.getElementById('lbl-rol');
  const secMed = document.getElementById('sec-medicamentos');
  const secAseo = document.getElementById('sec-aseo');
  const liPacientes = document.getElementById('pacientes-tab-li');

  if (userKey === 'admin') {
    lblRol.textContent = `| Modo Administrador (${userName})`;
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'inline-block');
    document.querySelectorAll('.tens-only').forEach(el => el.style.display = 'none');

    if (secMed) secMed.style.display = 'block';
    if (secAseo) secAseo.style.display = 'block';
    if (liPacientes) liPacientes.style.display = 'block';

  } else if (userKey === 'tens') { // TENS 1: Solo Medicamentos + Fichas QR
    lblRol.textContent = `| Modo TENS 1 (${userName})`;
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tens-only').forEach(el => el.style.display = 'inline-block');

    if (secMed) secMed.style.display = 'block';
    if (secAseo) secAseo.style.display = 'none'; 
    if (liPacientes) liPacientes.style.display = 'block'; 

  } else if (userKey === 'AA') { // TENS AA: Solo Aseo (No ve Medicamentos ni QR)
    lblRol.textContent = `| Modo TENS AA (${userName})`;
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tens-only').forEach(el => el.style.display = 'inline-block');

    if (secMed) secMed.style.display = 'none'; // OCULTO MEDICAMENTOS PARA AA
    if (secAseo) secAseo.style.display = 'block'; // VISIBLE ASEO
    if (liPacientes) liPacientes.style.display = 'none'; // OCULTO QR
  }
}

function esMedicamento(item) {
  if (item.categoria && item.categoria.toLowerCase() === 'medicamento') return true;
  if (item.categoria && item.categoria.toLowerCase() === 'aseo') return false;
  const nom = item.nombre.toLowerCase();
  return nom.includes('mg') || nom.includes('sertralina') || nom.includes('fluoxetina') || 
         nom.includes('clonazepam') || nom.includes('quetiapina') || nom.includes('escitalopram');
}

// Cargar Residentes Menores de Edad desde BD
async function cargarPacientes() {
  try {
    const res = await fetch('/api/pacientes');
    const lista = await res.json();

    const container = document.getElementById('pacientes-container');
    if (!container) return;
    container.innerHTML = '';

    if (lista.length === 0) {
      container.innerHTML = `<div class="col-12 text-center text-muted py-4">No hay pacientes menores registradas actualmente.</div>`;
      return;
    }

    const baseUrl = window.location.origin;

    lista.forEach(p => {
      const urlFicha = `${baseUrl}/ficha/${p.id}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(urlFicha)}`;

      let adminBtns = '';
      if (userKey === 'admin') {
        adminBtns = `
          <div class="mt-3 pt-2 border-top border-secondary d-flex justify-content-end gap-2">
            <button class="btn btn-outline-warning btn-sm" onclick="abrirModalEditarPaciente(${p.id}, '${p.nombre}', '${p.rut}', ${p.edad}, '${p.diagnostico}')">✏️ Editar</button>
            <button class="btn btn-outline-danger btn-sm" onclick="eliminarPaciente(${p.id}, '${p.nombre}')">🗑️ Eliminar (Egreso)</button>
          </div>
        `;
      }

      container.innerHTML += `
        <div class="col-md-6">
          <div class="p-3 border border-secondary rounded bg-dark d-flex flex-column justify-content-between h-100">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <h5 class="fw-bold mb-1 text-light">${p.nombre}</h5>
                <p class="mb-1 text-secondary small"><strong>RUT:</strong> ${p.rut} | <span class="text-info font-monospace">${p.edad} Años</span></p>
                <p class="mb-2 text-secondary small"><strong>Diagnóstico:</strong> <span class="text-warning">${p.diagnostico}</span></p>
                <a href="/ficha/${p.id}" target="_blank" class="btn btn-outline-light btn-sm">Ver/Descargar Ficha</a>
              </div>
              <div class="text-center ms-2">
                <img src="${qrUrl}" class="qr-img" alt="QR ${p.nombre}">
                <div class="small text-muted mt-1">Escanear QR</div>
              </div>
            </div>
            ${adminBtns}
          </div>
        </div>
      `;
    });
  } catch (error) {
    console.error('Error al cargar pacientes:', error);
  }
}

// CRUD Handlers para Pacientes
document.getElementById('form-agregar-paciente')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = document.getElementById('pac-nombre').value;
  const rut = document.getElementById('pac-rut').value;
  const edad = document.getElementById('pac-edad').value;
  const diagnostico = document.getElementById('pac-diag').value;

  const res = await fetch('/api/pacientes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, rut, edad, diagnostico })
  });

  const data = await res.json();
  if (data.success) {
    bootstrap.Modal.getInstance(document.getElementById('modalAgregarPaciente')).hide();
    document.getElementById('form-agregar-paciente').reset();
    cargarPacientes();
  }
});

function abrirModalEditarPaciente(id, nombre, rut, edad, diagnostico) {
  document.getElementById('edit-pac-id').value = id;
  document.getElementById('edit-pac-nombre').value = nombre;
  document.getElementById('edit-pac-rut').value = rut;
  document.getElementById('edit-pac-edad').value = edad;
  document.getElementById('edit-pac-diag').value = diagnostico;

  const modal = new bootstrap.Modal(document.getElementById('modalEditarPaciente'));
  modal.show();
}

document.getElementById('form-editar-paciente')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-pac-id').value;
  const nombre = document.getElementById('edit-pac-nombre').value;
  const rut = document.getElementById('edit-pac-rut').value;
  const edad = document.getElementById('edit-pac-edad').value;
  const diagnostico = document.getElementById('edit-pac-diag').value;

  const res = await fetch(`/api/pacientes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, rut, edad, diagnostico })
  });

  const data = await res.json();
  if (data.success) {
    bootstrap.Modal.getInstance(document.getElementById('modalEditarPaciente')).hide();
    cargarPacientes();
  }
});

async function eliminarPaciente(id, nombre) {
  if (confirm(`¿Confirma el egreso y eliminación de la residente "${nombre}" de la residencia?`)) {
    const res = await fetch(`/api/pacientes/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      cargarPacientes();
    }
  }
}

async function comprobarAlertasStockAdmin() {
  if (userRole !== 'admin') return;
  try {
    const res = await fetch('/api/supervision/reorden');
    const data = await res.json();

    if (data.resumen.itemsEnAlerta > 0) {
      const tbody = document.getElementById('tabla-alerta-stock-body');
      if (!tbody) return;
      tbody.innerHTML = '';

      const itemsCriticos = data.detalles.filter(item => item.stock <= item.stock_minimo);

      itemsCriticos.forEach(item => {
        const unidad = esMedicamento(item) ? 'cajas' : 'unidades';
        const stockTexto = item.stock === 0 ? 'Agotado (0)' : `${item.stock} ${unidad}`;
        const badgeColor = item.stock === 0 ? 'bg-danger' : 'bg-warning text-dark';

        tbody.innerHTML += `
          <tr>
            <td class="fw-bold text-light">${item.nombre} ${item.es_sos ? '<span class="badge bg-danger ms-1">SOS</span>' : ''}</td>
            <td><span class="badge ${badgeColor}">${stockTexto}</span></td>
            <td class="text-secondary">${item.stock_minimo} ${unidad}</td>
            <td class="fw-bold text-success">+${item.cantidad_a_pedir} ${unidad}</td>
            <td class="fw-bold text-warning">$${item.costo_total_estimado.toLocaleString('es-CL')} CLP</td>
          </tr>
        `;
      });

      document.getElementById('lbl-alerta-presupuesto').textContent = `$${data.resumen.presupuestoTotal.toLocaleString('es-CL')} CLP`;

      const modalEl = document.getElementById('modalAlertaStock');
      if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
      }
    }
  } catch (error) {
    console.error('Error al comprobar alertas de stock:', error);
  }
}

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

      let badgeColor = 'bg-success';
      let badgeTexto = `${item.stock} ${unidadLabel}`;

      if (item.stock <= 0) {
        badgeColor = 'bg-danger';
        badgeTexto = 'Agotado (0)';
      } else if (item.stock <= item.stock_minimo) {
        badgeColor = 'bg-warning text-dark';
        badgeTexto = `${item.stock} ${unidadLabel} (Mínimo: ${item.stock_minimo})`;
      }

      let badgePrioClass = 'bg-secondary';
      if (item.prioridad === 'Alta') badgePrioClass = 'bg-danger';
      else if (item.prioridad === 'Media') badgePrioClass = 'bg-warning text-dark';

      const botonTexto = isMed ? '- Usar 1 Caja' : '- Usar 1 Unidad';
      const btnEstilo = item.stock > 0 ? 'btn-warning' : 'btn-outline-danger';

      const fila = `
        <tr>
          <td class="fw-bold text-light">${item.nombre} ${item.es_sos ? '<span class="badge bg-danger ms-1">SOS</span>' : ''}</td>
          <td><span class="badge ${badgeColor} fs-6">${badgeTexto}</span></td>
          <td><span class="badge ${badgePrioClass}">${item.prioridad || 'Media'}</span></td>
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

async function usarUnidad(id, stockActual) {
  if (stockActual <= 0) {
    alert('⚠️ Debe reponer stock. El producto se encuentra agotado.');
    return;
  }

  try {
    const res = await fetch('/api/inventario/usar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, cantidad: 1, usuario: userName })
    });
    
    const data = await res.json();
    
    if (data.success) {
      cargarInventario();
      if (userRole === 'admin') {
        cargarReporteSemanal();
        cargarSupervision();
      }
    } else if (data.error) {
      alert(`⚠️ ${data.error}`);
    }
  } catch (error) {
    console.error('Error al descontar unidad:', error);
  }
}

async function cargarSupervision() {
  try {
    const res = await fetch('/api/supervision/reorden');
    const data = await res.json();

    document.getElementById('lbl-super-presupuesto').textContent = `$${data.resumen.presupuestoTotal.toLocaleString('es-CL')} CLP`;
    document.getElementById('lbl-super-gasto-consumo').textContent = `$${data.resumen.gastoTotalConsumo.toLocaleString('es-CL')} CLP`;
    document.getElementById('lbl-super-alertas').textContent = `${data.resumen.itemsEnAlerta} Productos`;

    const tbody = document.getElementById('tabla-supervision-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    data.detalles.forEach(item => {
      let badgePrio = item.prioridad === 'Alta' ? 'bg-danger' : item.prioridad === 'Media' ? 'bg-warning text-dark' : 'bg-secondary';
      let reordenTexto = item.cantidad_a_pedir > 0 ? `<span class="fw-bold text-warning">${item.cantidad_a_pedir}</span>` : `<span class="text-success">OK (0)</span>`;

      tbody.innerHTML += `
        <tr>
          <td><span class="badge ${badgePrio}">${item.prioridad}</span></td>
          <td class="fw-bold text-light">${item.nombre}</td>
          <td class="text-capitalize">${item.categoria}</td>
          <td>${item.stock} / <span class="text-secondary">${item.stock_minimo}</span></td>
          <td class="text-info fw-bold">${item.consumo_semanal}</td>
          <td class="fw-bold text-info">$${item.costo_consumo_semanal.toLocaleString('es-CL')} CLP</td>
          <td>${reordenTexto}</td>
          <td class="fw-bold text-warning">$${item.costo_total_estimado.toLocaleString('es-CL')} CLP</td>
        </tr>
      `;
    });

    cargarMensajesTens();
  } catch (error) {
    console.error('Error al cargar capa de supervisión:', error);
  }
}

async function cargarMensajesTens() {
  try {
    const res = await fetch('/api/mensajes');
    const mensajes = await res.json();

    const tbody = document.getElementById('tabla-mensajes-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (mensajes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No hay mensajes o sugerencias registradas.</td></tr>`;
      return;
    }

    mensajes.forEach(m => {
      tbody.innerHTML += `
        <tr>
          <td class="text-secondary">${m.fecha_local || m.fecha}</td>
          <td><span class="badge bg-warning text-dark">${m.tipo}</span></td>
          <td class="text-light">${m.mensaje}</td>
          <td class="text-info fw-bold">${m.usuario}</td>
        </tr>
      `;
    });
  } catch (error) {
    console.error('Error al cargar mensajes:', error);
  }
}

document.getElementById('form-mensaje-tens')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const tipo = document.getElementById('tens-msg-tipo').value;
  const mensaje = document.getElementById('tens-msg-texto').value;

  const res = await fetch('/api/mensajes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, mensaje, usuario: userName })
  });

  const data = await res.json();
  if (data.success) {
    alert('✅ Mensaje enviado exitosamente a Jefatura.');
    document.getElementById('tens-msg-texto').value = '';
    bootstrap.Modal.getInstance(document.getElementById('modalMensajeTens')).hide();
  }
});

function exportarReporteSupervisionCSV() {
  fetch('/api/supervision/reorden')
    .then(res => res.json())
    .then(data => {
      let csv = 'Prioridad,Producto,Categoria,Stock_Actual,Stock_Minimo,Consumo_Semanal,Costo_Consumido_CLP,Cantidad_A_Pedir,Precio_Unitario_CLP,Costo_Reposicion_CLP\n';
      
      data.detalles.forEach(r => {
        csv += `"${r.prioridad}","${r.nombre}","${r.categoria}",${r.stock},${r.stock_minimo},${r.consumo_semanal},${r.costo_consumo_semanal},${r.cantidad_a_pedir},${r.precio_unitario},${r.costo_total_estimado}\n`;
      });

      csv += `\n"TOTAL MONTO REAL CONSUMIDO (A COBRAR):",${data.resumen.gastoTotalConsumo}\n`;
      csv += `"PRESUPUESTO TOTAL ESTIMADO DE REPOSICION:",${data.resumen.presupuestoTotal}\n`;

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `Informe_Supervision_Cobros_y_Presupuesto_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
}

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

async function cargarReporteSemanal() {
  try {
    const res = await fetch('/api/consumo/semanal');
    const data = await res.json();

    const tbody = document.getElementById('tabla-reporte-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    document.getElementById('lbl-reporte-total-cobro').textContent = `$${data.gastoTotalSemanal.toLocaleString('es-CL')} CLP`;

    if (data.detalles.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No hay consumos registrados en los últimos 7 días.</td></tr>`;
      return;
    }

    data.detalles.forEach(h => {
      const unidad = h.categoria === 'medicamento' ? 'cajas' : 'unidades';
      tbody.innerHTML += `
        <tr>
          <td class="fw-bold text-light">${h.producto_nombre}</td>
          <td><span class="badge bg-secondary text-capitalize">${h.categoria}</span></td>
          <td><span class="badge bg-info text-dark fw-bold">${h.usuario}</span></td>
          <td class="fw-bold text-warning">${h.total_consumido} ${unidad}</td>
          <td>$${h.precio_unitario.toLocaleString('es-CL')} CLP</td>
          <td class="fw-bold text-info">$${h.costo_total_consumo.toLocaleString('es-CL')} CLP</td>
          <td class="small text-secondary">${h.ultima_fecha || 'Reciente'}</td>
        </tr>
      `;
    });
  } catch (error) {
    console.error('Error al cargar reporte:', error);
  }
}

function exportarConsumoCSV() {
  fetch('/api/consumo/semanal')
    .then(res => res.json())
    .then(data => {
      let csv = 'Producto,Categoria,Usuario_Responsable,Total_Consumido_Semanal,Precio_Unitario_CLP,Costo_Consumido_CLP,Ultima_Fecha_Registro\n';
      data.detalles.forEach(row => {
        csv += `"${row.producto_nombre}","${row.categoria}","${row.usuario}",${row.total_consumido},${row.precio_unitario},${row.costo_total_consumo},"${row.ultima_fecha}"\n`;
      });

      csv += `\n"MONTO TOTAL REAL CONSUMIDO A COBRAR:",${data.gastoTotalSemanal}\n`;

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `Consumo_Semanal_Valorizado_Clinica_Vital_${new Date().toISOString().slice(0,10)}.csv`);
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

document.getElementById('form-med')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const selectVal = document.getElementById('med-select').value;
  let nombre = selectVal === '__NUEVO__' ? document.getElementById('med-nombre-nuevo').value.trim() : selectVal;
  if (!nombre) return;

  const cantidad = document.getElementById('med-cantidad').value;
  const precio_unitario = document.getElementById('med-precio').value;
  const pauta = document.getElementById('med-pauta').value;

  const res = await fetch('/api/inventario/agregar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, cantidad, categoria: 'medicamento', pauta, precio_unitario })
  });

  const data = await res.json();
  if (data.success) {
    bootstrap.Modal.getInstance(document.getElementById('modalAgregarMedicamento')).hide();
    cargarInventario();
    cargarSupervision();
  }
});

document.getElementById('form-aseo')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const selectVal = document.getElementById('aseo-select').value;
  let nombre = selectVal === '__NUEVO__' ? document.getElementById('aseo-nombre-nuevo').value.trim() : selectVal;
  if (!nombre) return;

  const cantidad = document.getElementById('aseo-cantidad').value;
  const precio_unitario = document.getElementById('aseo-precio').value;
  const pauta = document.getElementById('aseo-pauta').value;

  const res = await fetch('/api/inventario/agregar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, cantidad, categoria: 'aseo', pauta, precio_unitario })
  });

  const data = await res.json();
  if (data.success) {
    bootstrap.Modal.getInstance(document.getElementById('modalAgregarAseo')).hide();
    cargarInventario();
    cargarSupervision();
  }
});