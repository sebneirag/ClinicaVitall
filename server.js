const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('virtual') || nameLower.includes('vbox') || nameLower.includes('vethernet') || nameLower.includes('docker') || nameLower.includes('wsl')) continue;
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIpAddress();

// Conexión a SQLite
const db = new sqlite3.Database('./clinica_vital.db', (err) => {
  if (err) {
    console.error('Error SQLite:', err.message);
  } else {
    console.log('Base de datos clinica_vital.db conectada correctamente.');
    inicializarBD();
  }
});

function inicializarBD() {
  // 1. Tabla Inventario
  db.run(`
    CREATE TABLE IF NOT EXISTS inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      categoria TEXT NOT NULL,
      pauta TEXT,
      precio_unitario REAL DEFAULT 0,
      stock_minimo INTEGER DEFAULT 10,
      stock_maximo INTEGER DEFAULT 20,
      prioridad TEXT DEFAULT 'Media',
      es_sos INTEGER DEFAULT 0
    )
  `, () => {
    db.get('SELECT COUNT(*) as total FROM inventario', (err, row) => {
      if (row && row.total === 0) {
        const stmt = db.prepare(`
          INSERT INTO inventario 
          (nombre, stock, categoria, pauta, precio_unitario, stock_minimo, stock_maximo, prioridad, es_sos) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run('Sertralina 50mg', 15, 'medicamento', 'Mañana: 1, Tarde: 0, Noche: 1 (sueño), SOS: 1', 8500, 10, 20, 'Media', 0);
        stmt.run('Fluoxetina 20mg', 15, 'medicamento', 'Mañana: 1, Tarde: 1, Noche: 0, SOS: 0', 7200, 10, 20, 'Media', 0);
        stmt.run('Clonazepam 2mg (SOS)', 15, 'medicamento', 'Mañana: 0, Tarde: 0, Noche: 1 (sueño), SOS: 1 (Crisis)', 12000, 10, 25, 'Alta', 1);
        stmt.run('Quetiapina 100mg (SOS)', 15, 'medicamento', 'Mañana: 0, Tarde: 0, Noche: 1 (sueño), SOS: 1 (Crisis)', 15500, 10, 25, 'Alta', 1);
        stmt.run('Escitalopram 10mg', 15, 'medicamento', 'Mañana: 1, Tarde: 0, Noche: 0, SOS: 0', 9800, 10, 20, 'Media', 0);

        stmt.run('Cloro Concentrado 5L', 15, 'aseo', 'Desinfección general e higienización', 4500, 10, 20, 'Alta', 0);
        stmt.run('Detergente Clínico Multiuso', 14, 'aseo', 'Lavado de ropa de cama y uniformes', 8900, 8, 18, 'Alta', 0);
        stmt.run('Clorhexidina Jabón 1L', 14, 'aseo', 'Higiene antiséptica de personal y residentes', 11000, 8, 18, 'Alta', 0);
        stmt.run('Bolsas Basura Amarillas (Residuos)', 15, 'aseo', 'Gestión de residuos clínicos', 6000, 6, 15, 'Media', 0);
        stmt.run('Jabón Antiséptico 1L', 13, 'aseo', 'Higiene de manos y sanitización', 5500, 6, 15, 'Media', 0);
        stmt.run('Toallas de Papel (Paquete 8 rollos)', 13, 'aseo', 'Secado e higiene rápida', 4200, 4, 12, 'Baja', 0);

        stmt.finalize();
      }
    });
  });

  // 2. Tabla Personal
  db.run(`
    CREATE TABLE IF NOT EXISTS personal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL,
      area TEXT NOT NULL,
      horario TEXT NOT NULL,
      colacion TEXT NOT NULL,
      dias TEXT NOT NULL,
      estado TEXT DEFAULT 'En Turno'
    )
  `, () => {
    db.get('SELECT COUNT(*) as total FROM personal', (err, row) => {
      if (row && row.total === 0) {
        const stmt = db.prepare('INSERT INTO personal (nombre, rol, area, horario, colacion, dias, estado) VALUES (?, ?, ?, ?, ?, ?, ?)');
        stmt.run('María González Tapia', 'TENS de Turno', 'Enfermería y Fármacos', '08:00 - 20:00 hrs', '13:30 - 14:30 hrs', 'Lunes, Miércoles, Viernes, Domingo', 'En Turno');
        stmt.run('Camila Valenzuela P.', 'TENS de Apoyo', 'Enfermería y Residencia', '08:00 - 20:00 hrs', '14:30 - 15:30 hrs', 'Martes, Jueves, Sábado', 'En Turno');
        stmt.run('Juan Pérez Morales', 'Auxiliar de Aseo', 'Aseo e Higiene', '07:30 - 16:30 hrs', '12:30 - 13:30 hrs', 'Lunes, Martes, Miércoles, Jueves, Viernes', 'En Turno');
        stmt.run('Rosa Espinoza Soto', 'Cocinera Principal', 'Cocina y Nutrición', '07:00 - 16:00 hrs', '12:00 - 13:00 hrs', 'Todos los días', 'En Turno');
        stmt.run('Dr. Carlos Silva R.', 'Jefe de Turno', 'Jefatura y Supervisión', '08:00 - 18:00 hrs', '14:00 - 15:00 hrs', 'Lunes, Martes, Miércoles, Jueves, Viernes', 'En Turno');
        stmt.finalize();
      }
    });
  });

  // 3. Tabla Historial de Consumo
  db.run(`
    CREATE TABLE IF NOT EXISTS historial_consumo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_nombre TEXT NOT NULL,
      categoria TEXT NOT NULL,
      cantidad INTEGER NOT NULL,
      usuario TEXT NOT NULL,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Tabla Mensajes TENS
  db.run(`
    CREATE TABLE IF NOT EXISTS mensajes_tens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      usuario TEXT NOT NULL,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      leido INTEGER DEFAULT 0
    )
  `);

  // 5. Tabla Pacientes (Creación y Migración Preventiva)
  db.run(`
    CREATE TABLE IF NOT EXISTS pacientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      rut TEXT NOT NULL,
      edad INTEGER NOT NULL,
      diagnostico TEXT NOT NULL,
      imagen_ficha TEXT DEFAULT 'ficha1.png',
      fecha_ingreso TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, () => {
    db.run("ALTER TABLE pacientes ADD COLUMN imagen_ficha TEXT DEFAULT 'ficha1.png'", () => {});

    db.get('SELECT COUNT(*) as total FROM pacientes', (err, row) => {
      if (row && row.total === 0) {
        const stmt = db.prepare('INSERT INTO pacientes (nombre, rut, edad, diagnostico, imagen_ficha) VALUES (?, ?, ?, ?, ?)');
        stmt.run('Camila Soto Morales', '18.452.120-K', 16, 'Trastorno Depresivo Mayor', 'ficha1.png');
        stmt.run('Valentina Morales Rojas', '19.821.433-2', 17, 'Trastorno Bipolar T-1', 'ficha2.png');
        stmt.run('Sofía Henríquez Silva', '20.123.456-7', 15, 'Trastorno Ansioso Depresivo', 'ficha3.png');
        stmt.run('Isidora Tapia Fuentes', '21.987.654-3', 16, 'Trastorno Adaptativo Severo', 'ficha4.png');
        stmt.finalize();
        console.log('4 Pacientes iniciales creadas en base de datos.');
      }
    });
  });
}

// Configuración IP
app.get('/api/config', (req, res) => {
  res.json({ ip: LOCAL_IP, port: PORT });
});

// APIs Pacientes (CRUD)
app.get('/api/pacientes', (req, res) => {
  db.all('SELECT * FROM pacientes ORDER BY id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/pacientes', (req, res) => {
  const { nombre, rut, edad, diagnostico, imagen_ficha } = req.body;
  if (!nombre || !rut || !edad) {
    return res.status(400).json({ error: 'Faltan datos obligatorios del residente.' });
  }

  const imgFinal = (imagen_ficha && imagen_ficha.trim()) ? imagen_ficha.trim() : 'ficha1.png';

  db.run(
    'INSERT INTO pacientes (nombre, rut, edad, diagnostico, imagen_ficha) VALUES (?, ?, ?, ?, ?)',
    [nombre.trim(), rut.trim(), parseInt(edad, 10), (diagnostico || 'Evaluación General').trim(), imgFinal],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

app.put('/api/pacientes/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, rut, edad, diagnostico, imagen_ficha } = req.body;
  const imgFinal = (imagen_ficha && imagen_ficha.trim()) ? imagen_ficha.trim() : 'ficha1.png';

  db.run(
    'UPDATE pacientes SET nombre = ?, rut = ?, edad = ?, diagnostico = ?, imagen_ficha = ? WHERE id = ?',
    [nombre.trim(), rut.trim(), parseInt(edad, 10), (diagnostico || 'Evaluación General').trim(), imgFinal, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.delete('/api/pacientes/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM pacientes WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// VISTA COMPLETA AL ESCANEAR EL QR: Muestra la Ficha Gráfica y Opciones de Descarga
app.get('/ficha/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM pacientes WHERE id = ?', [id], (err, paciente) => {
    if (err || !paciente) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ficha No Encontrada</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        </head><body class="bg-dark text-light text-center p-5">
          <h3>⚠️ Ficha Clínica No Encontrada</h3>
          <p class="text-secondary">El código QR escaneado no pertenece a una paciente activa o ha sido dada de alta.</p>
        </body></html>
      `);
    }

    const archivoImagen = paciente.imagen_ficha ? paciente.imagen_ficha : 'ficha1.png';
    const rutaImagen = `/images/${archivoImagen}`;

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ficha Clínica Digital - ${paciente.nombre}</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
          body { background-color: #0f172a; color: #f8fafc; padding: 15px; font-family: system-ui, -apple-system, sans-serif; }
          .card-ficha { background-color: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 20px; margin: 0 auto; max-width: 650px; text-align: left; }
          .badge-clinica { background-color: #0284c7; color: #fff; font-size: 0.85rem; padding: 6px 14px; border-radius: 20px; font-weight: bold; }
          .img-ficha { width: 100%; border-radius: 10px; border: 2px solid #475569; background-color: #0f172a; }
        </style>
      </head>
      <body>
        <div class="container my-2">
          <div class="card-ficha shadow-lg">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <span class="badge-clinica">📋 CLÍNICA VITAL SpA — FICHA CLÍNICA DIGITAL</span>
              <span class="badge bg-success">Residente Activa</span>
            </div>

            <h3 class="fw-bold text-light mb-1">${paciente.nombre}</h3>
            <p class="text-info small mb-3">
              <strong>RUT:</strong> ${paciente.rut} &nbsp;|&nbsp; 
              <strong>Edad:</strong> ${paciente.edad} Años &nbsp;|&nbsp; 
              <strong>Diagnóstico:</strong> <span class="text-warning fw-bold">${paciente.diagnostico}</span>
            </p>

            <div class="mb-3 text-center">
              <img src="${rutaImagen}" onerror="this.src='/images/ficha1.png'" class="img-ficha shadow" alt="Ficha Clínica de ${paciente.nombre}">
            </div>

            <div class="row g-2">
              <div class="col-6">
                <a href="${rutaImagen}" download="${paciente.nombre.replace(/\s+/g, '_')}_Ficha.png" class="btn btn-success w-100 fw-bold py-2">
                  📥 Descargar Ficha
                </a>
              </div>
              <div class="col-6">
                <a href="${rutaImagen}" target="_blank" class="btn btn-outline-info w-100 fw-bold py-2">
                  🔍 Ver Imagen HD
                </a>
              </div>
            </div>

            <div class="mt-3 text-center">
              <button onclick="window.print()" class="btn btn-secondary btn-sm w-100">🖨️ Imprimir Documento</button>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    res.send(html);
  });
});

// APIs Complementarias de Inventario, Supervisión, Consumo y Login
app.get('/api/inventario', (req, res) => {
  db.all('SELECT * FROM inventario ORDER BY id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/inventario/usar', (req, res) => {
  const { id, cantidad, usuario } = req.body;
  const cantNum = parseInt(cantidad, 10) || 1;
  const user = usuario || 'Usuario TENS';

  db.get('SELECT * FROM inventario WHERE id = ?', [id], (err, producto) => {
    if (err || !producto) return res.status(404).json({ error: 'Producto no encontrado' });

    if (producto.stock <= 0 || producto.stock < cantNum) {
      return res.status(400).json({ error: 'Debe reponer stock. El producto se encuentra agotado.' });
    }

    db.run('UPDATE inventario SET stock = stock - ? WHERE id = ?', [cantNum, id], function(err) {
      if (err) return res.status(500).json({ error: err.message });

      db.run(
        'INSERT INTO historial_consumo (producto_nombre, categoria, cantidad, usuario) VALUES (?, ?, ?, ?)',
        [producto.nombre.trim(), producto.categoria, cantNum, user],
        () => res.json({ success: true, stockRestante: producto.stock - cantNum })
      );
    });
  });
});

app.post('/api/inventario/agregar', (req, res) => {
  const { nombre, cantidad, categoria, pauta, precio_unitario, stock_minimo, stock_maximo, prioridad, es_sos } = req.body;
  const nomLimpio = (nombre || '').trim();
  const cantNum = parseInt(cantidad, 10) || 1;
  const precio = parseFloat(precio_unitario) || 5000;
  
  const defaultMin = categoria === 'medicamento' ? 10 : (prioridad === 'Alta' ? 8 : prioridad === 'Media' ? 6 : 4);
  const defaultMax = categoria === 'medicamento' ? 20 : 15;
  const minStock = parseInt(stock_minimo, 10) || defaultMin;
  const maxStock = parseInt(stock_maximo, 10) || defaultMax;

  db.get('SELECT * FROM inventario WHERE LOWER(TRIM(nombre)) = LOWER(?)', [nomLimpio], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    if (row) {
      db.run(
        `UPDATE inventario SET stock = stock + ?, pauta = CASE WHEN ? != "" THEN ? ELSE pauta END, precio_unitario = CASE WHEN ? > 0 THEN ? ELSE precio_unitario END WHERE id = ?`,
        [cantNum, (pauta || '').trim(), (pauta || '').trim(), precio, precio, row.id],
        (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true, action: 'updated' });
        }
      );
    } else {
      db.run(
        `INSERT INTO inventario (nombre, stock, categoria, pauta, precio_unitario, stock_minimo, stock_maximo, prioridad, es_sos) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [nomLimpio, cantNum, categoria, pauta || 'N/A', precio, minStock, maxStock, prioridad || 'Media', es_sos ? 1 : 0],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true, action: 'inserted', id: this.lastID });
        }
      );
    }
  });
});

app.get('/api/supervision/reorden', (req, res) => {
  const sql = `
    SELECT 
      i.*,
      COALESCE(c.total_consumido, 0) AS consumo_semanal,
      (COALESCE(c.total_consumido, 0) * i.precio_unitario) AS costo_consumo_semanal,
      CASE WHEN i.stock <= i.stock_minimo THEN (i.stock_maximo - i.stock) ELSE 0 END AS cantidad_a_pedir,
      CASE WHEN i.stock <= i.stock_minimo THEN ((i.stock_maximo - i.stock) * i.precio_unitario) ELSE 0 END AS costo_total_estimado
    FROM inventario i
    LEFT JOIN (
      SELECT LOWER(TRIM(producto_nombre)) as nom, SUM(cantidad) as total_consumido
      FROM historial_consumo WHERE fecha >= datetime('now', '-7 days')
      GROUP BY LOWER(TRIM(producto_nombre))
    ) c ON LOWER(TRIM(i.nombre)) = c.nom
    ORDER BY CASE i.prioridad WHEN 'Alta' THEN 1 WHEN 'Media' THEN 2 ELSE 3 END, (i.stock <= i.stock_minimo) DESC, i.nombre ASC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    let presupuestoTotal = 0;
    let gastoTotalConsumo = 0;
    let itemsEnAlerta = 0;

    rows.forEach(r => {
      presupuestoTotal += r.costo_total_estimado;
      gastoTotalConsumo += r.costo_consumo_semanal;
      if (r.stock <= r.stock_minimo) itemsEnAlerta++;
    });

    res.json({ resumen: { presupuestoTotal, gastoTotalConsumo, itemsEnAlerta, totalProductos: rows.length }, detalles: rows });
  });
});

app.get('/api/consumo/semanal', (req, res) => {
  const sql = `
    SELECT 
       hc.producto_nombre, hc.categoria, hc.usuario, SUM(hc.cantidad) as total_consumido, 
       MAX(datetime(hc.fecha, 'localtime')) as ultima_fecha, COALESCE(i.precio_unitario, 0) as precio_unitario,
       (SUM(hc.cantidad) * COALESCE(i.precio_unitario, 0)) as costo_total_consumo
     FROM historial_consumo hc
     LEFT JOIN inventario i ON LOWER(TRIM(hc.producto_nombre)) = LOWER(TRIM(i.nombre))
     WHERE hc.fecha >= datetime('now', '-7 days') 
     GROUP BY LOWER(TRIM(hc.producto_nombre)), hc.categoria, hc.usuario
     ORDER BY total_consumido DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    let gastoTotalSemanal = 0;
    rows.forEach(r => { gastoTotalSemanal += r.costo_total_consumo; });
    res.json({ gastoTotalSemanal, detalles: rows });
  });
});

app.post('/api/mensajes', (req, res) => {
  const { tipo, mensaje, usuario } = req.body;
  if (!mensaje || !mensaje.trim()) return res.status(400).json({ error: 'Mensaje vacío.' });

  db.run(
    'INSERT INTO mensajes_tens (tipo, mensaje, usuario) VALUES (?, ?, ?)',
    [tipo || 'Falta Stock / Sugerencia', mensaje.trim(), usuario || 'Personal TENS'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

app.get('/api/mensajes', (req, res) => {
  db.all('SELECT *, datetime(fecha, "localtime") as fecha_local FROM mensajes_tens ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/personal', (req, res) => {
  db.all('SELECT * FROM personal ORDER BY id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    res.json({ success: true, role: 'admin', nombreUsuario: 'Administrador', userKey: 'admin' });
  } else if (username === 'tens' && password === 'tens123') {
    res.json({ success: true, role: 'usuario', nombreUsuario: 'TENS 1', userKey: 'tens' });
  } else if (username === 'AA' && password === 'AA123') {
    res.json({ success: true, role: 'usuario', nombreUsuario: 'TENS AA', userKey: 'AA' });
  } else {
    res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor Clínica Vital activo en puerto ${PORT}`);
});