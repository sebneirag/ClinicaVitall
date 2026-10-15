// Validar Sesión al cargar la página (sessionStorage)
if (sessionStorage.getItem('session') !== 'active') {
    window.location.href = 'login.html';
}

document.getElementById('btnLogout').addEventListener('click', () => {
    sessionStorage.clear();
    window.location.href = 'login.html';
});

// Cargar Inventario
async function cargarInventario() {
    try {
        const res = await fetch('/api/inventario');
        const items = await res.json();

        const tablaMed = document.getElementById('tablaMedicamentos');
        const tablaAseo = document.getElementById('tablaAseo');

        tablaMed.innerHTML = '';
        tablaAseo.innerHTML = '';

        items.forEach(item => {
            const badgeClass = item.stock > 5 ? 'bg-dark text-white' : (item.stock > 0 ? 'bg-warning text-dark' : 'bg-danger text-white');
            const row = `
                <tr>
                    <td class="fw-bold text-dark">${item.nombre}</td>
                    <td><span class="badge ${badgeClass} fs-6 px-3 py-2">${item.stock} ${item.unidad_medida}</span></td>
                    <td class="text-secondary fw-semibold">${item.detalle}</td>
                    <td>
                        <button class="btn btn-warning btn-sm me-2 fw-bold text-dark border-dark" onclick="usarItem(${item.id})" ${item.stock === 0 ? 'disabled' : ''}>
                            - Usar 1 ${item.unidad_medida.slice(0, -1)}
                        </button>
                        <button class="btn btn-danger btn-sm fw-bold border-dark" onclick="eliminarItem(${item.id})">
                            🗑️ Eliminar
                        </button>
                    </td>
                </tr>
            `;
            if (item.tipo === 'medicamento') tablaMed.innerHTML += row;
            else tablaAseo.innerHTML += row;
        });
    } catch (err) {
        console.error("Error al cargar inventario:", err);
    }
}

// Descontar 1 unidad/caja
async function usarItem(id) {
    const res = await fetch('/api/inventario/usar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.success) {
        cargarInventario();
    } else {
        alert(data.error || 'No queda stock disponible');
    }
}

// Eliminar producto
async function eliminarItem(id) {
    if (confirm('¿Estás seguro de eliminar este producto completamente del inventario?')) {
        const res = await fetch(`/api/inventario/eliminar/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            cargarInventario();
        } else {
            alert(data.error);
        }
    }
}

// Abrir Modal para Medicamentos o Aseo
function abrirModalAgregar(tipo) {
    document.getElementById('addTipo').value = tipo;
    const modalTitulo = document.getElementById('modalAgregarTitulo');
    const selectProducto = document.getElementById('selectProducto');

    if (tipo === 'medicamento') {
        modalTitulo.innerText = "Ingresar Stock de Medicamentos";
        selectProducto.innerHTML = `
            <option value="Sertralina 50mg|cajas|1 comp. diario en la Mañana (09:00 AM)">Sertralina 50mg (Cajas)</option>
            <option value="Fluoxetina 20mg|cajas|1 comp. diario en la Tarde (16:00 PM)">Fluoxetina 20mg (Cajas)</option>
            <option value="Escitalopram 10mg|cajas|Uso SOS (Crisis de ansiedad / agitación)">Escitalopram 10mg (Cajas SOS)</option>
            <option value="Amitriptilina 25mg|cajas|1 comp. Noche para inducción del sueño (21:30 PM)">Amitriptilina 25mg (Cajas Sueño)</option>
            <option value="Venlafaxina 75mg|cajas|1 comp. diario con Almuerzo (13:00 PM)">Venlafaxina 75mg (Cajas)</option>
            <option value="custom">➕ Nuevo medicamento personalizado...</option>
        `;
    } else {
        modalTitulo.innerText = "Ingresar Stock de Artículos de Aseo";
        selectProducto.innerHTML = `
            <option value="Clorhexidina Jabón 1L|bidones|Desinfectante corporal y superficies">Clorhexidina Jabón 1L (Bidones)</option>
            <option value="Papel Toalla Interdoblado|paquetes|Paquete x 250 hojas">Papel Toalla Interdoblado (Paquetes)</option>
            <option value="Cloro Concentrado 5L|bidones|Sanitización de pisos y baños">Cloro Concentrado 5L (Bidones)</option>
            <option value="Detergente Clínico Multiuso|bidones|Bidón de 5 Litros">Detergente Clínico Multiuso (Bidones)</option>
            <option value="Bolsas Basura Amarillas (Residuos)|paquetes|Paquete de 10 unidades">Bolsas Basura Amarillas (Paquetes)</option>
            <option value="custom">➕ Nuevo artículo de aseo personalizado...</option>
        `;
    }

    toggleNuevoProductoFields();
    new bootstrap.Modal(document.getElementById('modalAgregar')).show();
}

// Mostrar u Ocultar campos personalizados
function toggleNuevoProductoFields() {
    const val = document.getElementById('selectProducto').value;
    const fieldsCustom = document.getElementById('fieldsCustom');
    if (val === 'custom') {
        fieldsCustom.classList.remove('d-none');
        document.getElementById('customNombre').setAttribute('required', 'true');
        document.getElementById('customUnidad').setAttribute('required', 'true');
        document.getElementById('customDetalle').setAttribute('required', 'true');
    } else {
        fieldsCustom.classList.add('d-none');
        document.getElementById('customNombre').removeAttribute('required');
        document.getElementById('customUnidad').removeAttribute('required');
        document.getElementById('customDetalle').removeAttribute('required');
    }
}

// Enviar formulario
document.getElementById('formAgregar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const tipo = document.getElementById('addTipo').value;
    const selectVal = document.getElementById('selectProducto').value;
    const cantidad = parseInt(document.getElementById('addStock').value);
    let item = {};

    if (selectVal === 'custom') {
        item = {
            tipo: tipo,
            nombre: document.getElementById('customNombre').value,
            stock: cantidad,
            unidad_medida: document.getElementById('customUnidad').value,
            detalle: document.getElementById('customDetalle').value
        };
    } else {
        const parts = selectVal.split('|');
        item = {
            tipo: tipo,
            nombre: parts[0],
            stock: cantidad,
            unidad_medida: parts[1],
            detalle: parts[2]
        };
    }

    const res = await fetch('/api/inventario/agregar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
    });

    const data = await res.json();
    if (data.success) {
        bootstrap.Modal.getInstance(document.getElementById('modalAgregar')).hide();
        document.getElementById('formAgregar').reset();
        document.getElementById('fieldsCustom').classList.add('d-none');
        await cargarInventario();
    } else {
        alert(data.error || 'Error al agregar producto');
    }
});

// Cargar Personal y Residentes con QR compatible con cualquier red / 4G / 5G
async function cargarClinicaData() {
    try {
        const res = await fetch('/api/clinica-data');
        const { personal, pacientes, localIp, port } = await res.json();

        // Render Personal
        const containerPersonal = document.getElementById('cardsPersonal');
        containerPersonal.innerHTML = personal.map(p => `
            <div class="col-md-4 mb-3">
                <div class="card border-dark shadow-sm h-100">
                    <div class="card-body">
                        <h5 class="card-title fw-bold text-dark">${p.nombre}</h5>
                        <p class="card-text mb-1"><strong>Rol:</strong> ${p.rol}</p>
                        <p class="card-text text-muted"><small>Turno: ${p.turno}</small></p>
                    </div>
                </div>
            </div>
        `).join('');

        // Render Pacientes con detección inteligente de URL pública vs local
        const containerPacientes = document.getElementById('cardsPacientes');
        containerPacientes.innerHTML = pacientes.map(pac => {
            let fullTargetUrl;

            // Si qr_info es una URL web completa (ej: https://i.postimg.cc/...), la usa directo
            if (pac.qr_info.startsWith('http://') || pac.qr_info.startsWith('https://')) {
                fullTargetUrl = pac.qr_info;
            } else {
                // Si es una ruta local, arma el enlace de red local
                const pathEncoded = encodeURI(pac.qr_info);
                fullTargetUrl = `http://${localIp}:${port}${pathEncoded}`;
            }

            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fullTargetUrl)}`;

            return `
                <div class="col-md-6 mb-3">
                    <div class="card border-dark shadow-sm p-3">
                        <div class="d-flex align-items-center justify-content-between">
                            <div style="flex: 1; padding-right: 15px;">
                                <h5 class="fw-bold text-dark mb-1">${pac.nombre}</h5>
                                <span class="badge bg-dark mb-2">${pac.habitacion}</span>
                                <p class="mb-0 text-dark small"><strong>Pauta:</strong> ${pac.pauta_cuidados}</p>
                            </div>
                            <div class="text-center" style="width: 140px;">
                                <a href="${fullTargetUrl}" target="_blank">
                                    <img src="${qrApiUrl}" alt="QR Ficha ${pac.nombre}" class="img-fluid rounded border border-dark p-1 bg-white" title="Escanear con cámara para abrir Ficha Imagen">
                                </a>
                                <small class="d-block text-dark fw-bold mt-1" style="font-size:0.7rem;">Escanear QR con Celular</small>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error("Error al cargar datos de clínica:", err);
    }
}

// Inicialización
cargarInventario();
cargarClinicaData();