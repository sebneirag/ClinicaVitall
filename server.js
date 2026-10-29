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

// Conexión a Base de Datos SQLite Autocontenida
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
      pauta TEXT
    )
  `, () => {
    db.get('SELECT COUNT(*) as total FROM inventario', (err, row) => {
      if (row && row.total === 0) {
        const stmt = db.prepare('INSERT INTO inventario (nombre, stock, categoria, pauta) VALUES (?, ?, ?, ?)');
        
        // Stock inicial: 5 cajas para medicamentos
        stmt.run('Sertralina 50mg', 5, 'medicamento', 'Mañana: 1, Tarde: 0, Noche: 1 (sueño), SOS: 1');
        stmt.run('Fluoxetina 20mg', 5, 'medicamento', 'Mañana: 1, Tarde: 1, Noche: 0, SOS: 0');
        stmt.run('Clonazepam 2mg', 5, 'medicamento', 'Mañana: 0, Tarde: 0, Noche: 1 (sueño), SOS: 1');
        stmt.run('Quetiapina 100mg', 5, 'medicamento', 'Mañana: 0, Tarde: 0, Noche: 1 (sueño), SOS: 1');
        stmt.run('Escitalopram 10mg', 5, 'medicamento', 'Mañana: 1, Tarde: 0, Noche: 0, SOS: 0');

        // Stock inicial: 3 a 5 unidades para aseo
        stmt.run('Cloro Concentrado 5L', 5, 'aseo', 'Desinfección general e higienización');
        stmt.run('Detergente Clínico Multiuso', 4, 'aseo', 'Lavado de ropa de cama y uniformes');
        stmt.run('Clorhexidina Jabón 1L', 4, 'aseo', 'Higiene antiséptica de personal y residentes');
        stmt.run('Bolsas Basura Amarillas (Residuos)', 5, 'aseo', 'Gestión de residuos clínicos');
        stmt.run('Jabón Antiséptico 1L', 3, 'aseo', 'Higiene de manos y sanitización');
        stmt.run('Toallas de Papel (Paquete 8 rollos)', 3, 'aseo', 'Secado e higiene rápida');

        stmt.finalize();
        console.log('Catálogo inicial cargado exitosamente.');
      }
    });
  });

  // 2. Tabla Personal de Turno
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
}

// Configuración IP
app.get('/api/config', (req, res) => {
  res.json({ ip: LOCAL_IP, port: PORT });
});

// Obtener Inventario
app.get('/api/inventario', (req, res) => {
  db.all('SELECT * FROM inventario ORDER BY id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Descontar Stock y Registrar en Historial con Validación
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
        (err) => {
          if (err) console.error('Error registrando historial:', err.message);
          res.json({ success: true, stockRestante: producto.stock - cantNum });
        }
      );
    });
  });
});

// Sumar Stock Existente o Agregar Insumo Nuevo (Sin duplicar filas)
app.post('/api/inventario/agregar', (req, res) => {
  const { nombre, cantidad, categoria, pauta } = req.body;
  const nomLimpio = (nombre || '').trim();
  const cantNum = parseInt(cantidad, 10) || 1;

  db.get('SELECT * FROM inventario WHERE LOWER(TRIM(nombre)) = LOWER(?)', [nomLimpio], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    if (row) {
      db.run(
        'UPDATE inventario SET stock = stock + ?, pauta = CASE WHEN ? != "" THEN ? ELSE pauta END WHERE id = ?',
        [cantNum, (pauta || '').trim(), (pauta || '').trim(), row.id],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true, action: 'updated' });
        }
      );
    } else {
      db.run(
        'INSERT INTO inventario (nombre, stock, categoria, pauta) VALUES (?, ?, ?, ?)',
        [nomLimpio, cantNum, categoria, pauta || 'N/A'],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true, action: 'inserted', id: this.lastID });
        }
      );
    }
  });
});

// Reporte Semanal Consolidado (Agrupa por producto sin filas duplicadas)
app.get('/api/consumo/semanal', (req, res) => {
  db.all(
    `SELECT 
       producto_nombre, 
       categoria, 
       SUM(cantidad) as total_consumido, 
       MAX(datetime(fecha, 'localtime')) as ultima_fecha
     FROM historial_consumo 
     WHERE fecha >= datetime('now', '-7 days') 
     GROUP BY LOWER(TRIM(producto_nombre)), categoria 
     ORDER BY total_consumido DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Personal de Turno
app.get('/api/personal', (req, res) => {
  db.all('SELECT * FROM personal ORDER BY id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Fichas Clínicas
app.get('/download-ficha/:id', (req, res) => {
  const id = req.params.id;
  const fileName = id === '1' ? 'ficha1.png' : 'ficha2.png';
  let filePath = path.join(__dirname, 'public', 'images', fileName);

  res.download(filePath, `Ficha_Medica_Residente_${id}.png`, (err) => {
    if (err) res.redirect(`/ficha/${id}`);
  });
});

app.get('/ficha/:id', (req, res) => {
  const id = req.params.id;
  const nombreImagen = id === '1' ? 'ficha1.png' : 'ficha2.png';
  const nombrePaciente = id === '1' ? 'Camila Soto Morales' : 'Valentina Morales Rojas';

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Ficha Médica - ${nombrePaciente}</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        body { background-color: #121212; color: #ffffff; text-align: center; padding: 15px; font-family: system-ui; }
        .card-ficha { background-color: #1e1e1e; border: 1px solid #333; border-radius: 12px; padding: 15px; margin-bottom: 20px; }
        .img-ficha { max-width: 100%; border-radius: 8px; border: 2px solid #444; }
        .btn-descarga { background-color: #198754; color: #fff; font-size: 1.1rem; border-radius: 30px; font-weight: bold; padding: 12px 20px; text-decoration: none; display: block; }
      </style>
    </head>
    <body>
      <div class="container my-2">
        <span class="badge bg-success mb-2 px-3 py-2">Clínica Vital SpA</span>
        <h3 class="fw-bold mt-1 mb-1">${nombrePaciente}</h3>
        <p class="text-secondary small mb-3">Ficha Clínica Digital Oficial</p>
        
        <a href="/download-ficha/${id}" class="btn-descarga mb-3 shadow">📥 Descargar Ficha al Teléfono</a>

        <div class="card-ficha">
          <img src="/images/${nombreImagen}" class="img-ficha" onerror="this.src='/images/QR%20${id}.png'" alt="Ficha Médica">
        </div>
      </div>
    </body>
    </html>
  `;
  res.send(html);
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    res.json({ success: true, role: 'admin' });
  } else if (username === 'tens' && password === 'tens123') {
    res.json({ success: true, role: 'usuario' });
  } else {
    res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor Clínica Vital activo en el puerto ${PORT}`);
});