const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Obtener IP de Red Local (Wi-Fi / Ethernet real)
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('virtual') || nameLower.includes('vbox') || nameLower.includes('vethernet') || nameLower.includes('docker') || nameLower.includes('wsl')) {
      continue;
    }
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIpAddress();

// Conectar SQLite
const db = new sqlite3.Database('./clinica_vital.db', (err) => {
  if (err) {
    console.error('Error al conectar SQLite:', err.message);
  } else {
    console.log('Base de datos clinica_vital.db conectada correctamente.');
    inicializarBD();
  }
});

function inicializarBD() {
  // Tabla Inventario
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
        
        // Catálogo de Medicamentos Inicial (Sin duplicados)
        stmt.run('Sertralina 50mg', 10, 'medicamento', 'Mañana: 1, Tarde: 0, Noche: 1 (sueño), SOS: 1');
        stmt.run('Fluoxetina 20mg', 15, 'medicamento', 'Mañana: 1, Tarde: 1, Noche: 0, SOS: 0');
        stmt.run('Clonazepam 2mg', 8, 'medicamento', 'Mañana: 0, Tarde: 0, Noche: 1 (sueño), SOS: 1');
        stmt.run('Quetiapina 100mg', 12, 'medicamento', 'Mañana: 0, Tarde: 0, Noche: 1 (sueño), SOS: 1');
        stmt.run('Escitalopram 10mg', 20, 'medicamento', 'Mañana: 1, Tarde: 0, Noche: 0, SOS: 0');
        stmt.run('Amitriptilina 25mg', 12, 'medicamento', 'Mañana: 0, Tarde: 0, Noche: 1 (sueño), SOS: 1');
        stmt.run('Venlafaxina 75mg', 7, 'medicamento', 'Mañana: 1, Tarde: 0, Noche: 0, SOS: 0');

        // Catálogo de Artículos de Aseo Inicial
        stmt.run('Cloro Concentrado 5L', 8, 'aseo', 'Desinfección general e higienización');
        stmt.run('Detergente Clínico Multiuso', 15, 'aseo', 'Lavado de ropa de cama y uniformes');
        stmt.run('Clorhexidina Jabón 1L', 12, 'aseo', 'Higiene antiséptica de personal y residentes');
        stmt.run('Bolsas Basura Amarillas (Residuos)', 50, 'aseo', 'Gestión de residuos clínicos');
        stmt.run('Jabón Antiséptico 1L', 14, 'aseo', 'Higiene de manos y sanitización');
        stmt.run('Toallas de Papel (Paquete 8 rollos)', 10, 'aseo', 'Secado e higiene rápida');

        stmt.finalize();
        console.log('Catálogo inicial único cargado en la base de datos.');
      }
    });
  });

  // Tabla Personal de Turno
  db.run(`
    CREATE TABLE IF NOT EXISTS personal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL,
      area TEXT NOT NULL,
      horario TEXT NOT NULL,
      colacion TEXT NOT NULL,
      estado TEXT DEFAULT 'En Turno'
    )
  `, () => {
    db.get('SELECT COUNT(*) as total FROM personal', (err, row) => {
      if (row && row.total === 0) {
        const stmt = db.prepare('INSERT INTO personal (nombre, rol, area, horario, colacion, estado) VALUES (?, ?, ?, ?, ?, ?)');
        stmt.run('María González Tapia', 'TENS de Turno', 'Enfermería y Fármacos', '08:00 - 20:00 hrs', '13:30 - 14:30 hrs', 'En Turno');
        stmt.run('Camila Valenzuela P.', 'TENS de Apoyo', 'Enfermería y Residencia', '08:00 - 20:00 hrs', '14:30 - 15:30 hrs', 'En Turno');
        stmt.run('Juan Pérez Morales', 'Auxiliar de Aseo', 'Aseo e Higiene', '07:30 - 16:30 hrs', '12:30 - 13:30 hrs', 'En Turno');
        stmt.run('Rosa Espinoza Soto', 'Cocinera Principal', 'Cocina y Nutrición', '07:00 - 16:00 hrs', '12:00 - 13:00 hrs', 'En Turno');
        stmt.run('Dr. Carlos Silva R.', 'Jefe de Turno', 'Jefatura y Supervisión', '08:00 - 18:00 hrs', '14:00 - 15:00 hrs', 'En Turno');
        stmt.finalize();
      }
    });
  });
}

// Configuración IP
app.get('/api/config', (req, res) => {
  res.json({ ip: LOCAL_IP, port: PORT });
});

// Descarga Directa de Ficha en Teléfono
app.get('/download-ficha/:id', (req, res) => {
  const id = req.params.id;
  const fileName = id === '1' ? 'ficha1.png' : 'ficha2.png';
  let filePath = path.join(__dirname, 'public', 'images', fileName);

  res.download(filePath, `Ficha_Medica_Residente_${id}.png`, (err) => {
    if (err) {
      const altPath = path.join(__dirname, 'public', 'images', `QR ${id}.png`);
      res.download(altPath, `Ficha_Medica_Residente_${id}.png`);
    }
  });
});

// Visor QR Móvil
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
        body { background-color: #121212; color: #ffffff; text-align: center; padding: 15px; font-family: system-ui, -apple-system, sans-serif; }
        .card-ficha { background-color: #1e1e1e; border: 1px solid #333; border-radius: 12px; padding: 15px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
        .img-ficha { max-width: 100%; height: auto; border-radius: 8px; border: 2px solid #444; }
        .btn-descarga { background-color: #198754; color: #fff; font-size: 1.1rem; border-radius: 30px; font-weight: bold; padding: 12px 20px; text-decoration: none; display: block; }
        .btn-descarga:hover { background-color: #157347; color: #fff; }
      </style>
    </head>
    <body>
      <div class="container my-2">
        <span class="badge bg-success mb-2 px-3 py-2">Clínica Vital SpA</span>
        <h3 class="fw-bold mt-1 mb-1">${nombrePaciente}</h3>
        <p class="text-secondary small mb-3">Ficha Clínica Digital Oficial</p>
        
        <a href="/download-ficha/${id}" class="btn-descarga mb-3 shadow">
          📥 Descargar Ficha al Teléfono
        </a>

        <div class="card-ficha">
          <img src="/images/${nombreImagen}" class="img-ficha" onerror="this.src='/images/QR%20${id}.png'" alt="Ficha Médica">
        </div>

        <p class="text-muted small">⚠️ Documento confidencial de uso exclusivo para el personal de turno.</p>
      </div>
    </body>
    </html>
  `;
  res.send(html);
});

// API Endpoints
app.get('/api/inventario', (req, res) => {
  db.all('SELECT * FROM inventario ORDER BY id ASC', [], (err, rows) => {
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

// Endpoint de Descuento (Soporta descontar de 1 a 5 unidades)
app.post('/api/inventario/usar', (req, res) => {
  const { id, cantidad } = req.body;
  const cantNum = Math.min(Math.max(parseInt(cantidad, 10) || 1, 1), 5);

  db.run(`
    UPDATE inventario 
    SET stock = CASE WHEN stock >= ? THEN stock - ? ELSE 0 END 
    WHERE id = ? AND stock > 0
  `, [cantNum, cantNum, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});

// Endpoint para Sumar Stock o Agregar Producto Nuevo Evitando Duplicados por Nombre
app.post('/api/inventario/agregar', (req, res) => {
  const { nombre, cantidad, categoria, pauta } = req.body;
  const cantNum = parseInt(cantidad, 10) || 1;

  db.get('SELECT * FROM inventario WHERE LOWER(nombre) = LOWER(?) AND categoria = ?', [nombre, categoria], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (row) {
      db.run('UPDATE inventario SET stock = stock + ?, pauta = COALESCE(?, pauta) WHERE id = ?', [cantNum, pauta, row.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, action: 'updated' });
      });
    } else {
      db.run('INSERT INTO inventario (nombre, stock, categoria, pauta) VALUES (?, ?, ?, ?)', [nombre, cantNum, categoria, pauta || 'N/A'], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, action: 'inserted', id: this.lastID });
      });
    }
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`Servidor Clínica Vital SpA Activo:`);
  console.log(` - Acceso Local PC: http://localhost:${PORT}`);
  console.log(` - Acceso Celular (Wi-Fi): http://${LOCAL_IP}:${PORT}`);
  console.log(`====================================================`);
});