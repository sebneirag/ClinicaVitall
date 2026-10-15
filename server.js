const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3000;

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const LOCAL_IP = getLocalIp();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.redirect('/login.html');
});

const db = new sqlite3.Database('./clinica_vital.db', (err) => {
    if (err) console.error('Error al abrir la BD:', err.message);
    else console.log('Base de datos SQLite conectada correctamente.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS inventario (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT CHECK(tipo IN ('aseo', 'medicamento')),
        nombre TEXT UNIQUE NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        unidad_medida TEXT NOT NULL,
        detalle TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS personal (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        rol TEXT NOT NULL,
        turno TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS pacientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        habitacion TEXT NOT NULL,
        pauta_cuidados TEXT NOT NULL,
        qr_info TEXT NOT NULL
    )`);

    // Catálogo inicial
    db.get("SELECT COUNT(*) AS count FROM inventario", (err, row) => {
        if (row && row.count === 0) {
            const medicamentos = [
                ['medicamento', 'Sertralina 50mg', 10, 'cajas', '1 comp. diario en la Mañana (09:00 AM)'],
                ['medicamento', 'Fluoxetina 20mg', 8, 'cajas', '1 comp. diario en la Tarde (16:00 PM)'],
                ['medicamento', 'Escitalopram 10mg', 5, 'cajas', 'Uso SOS (Crisis de ansiedad / agitación)'],
                ['medicamento', 'Amitriptilina 25mg', 12, 'cajas', '1 comp. Noche para inducción del sueño (21:30 PM)'],
                ['medicamento', 'Venlafaxina 75mg', 7, 'cajas', '1 comp. diario con Almuerzo (13:00 PM)']
            ];

            const aseo = [
                ['aseo', 'Clorhexidina Jabón 1L', 12, 'bidones', 'Desinfectante corporal y superficies'],
                ['aseo', 'Papel Toalla Interdoblado', 35, 'paquetes', 'Paquete x 250 hojas'],
                ['aseo', 'Cloro Concentrado 5L', 8, 'bidones', 'Sanitización de pisos y baños'],
                ['aseo', 'Detergente Clínico Multiuso', 15, 'bidones', 'Bidón de 5 Litros'],
                ['aseo', 'Bolsas Basura Amarillas (Residuos)', 50, 'paquetes', 'Paquete de 10 unidades']
            ];

            const stmt = db.prepare("INSERT OR IGNORE INTO inventario (tipo, nombre, stock, unidad_medida, detalle) VALUES (?, ?, ?, ?, ?)");
            [...medicamentos, ...aseo].forEach(item => stmt.run(item));
            stmt.finalize();
        }
    });

    db.get("SELECT COUNT(*) AS count FROM personal", (err, row) => {
        if (row && row.count === 0) {
            db.run("INSERT INTO personal (nombre, rol, turno) VALUES ('Camila Fuentes', 'Enfermera Jefa', 'Diurno')");
            db.run("INSERT INTO personal (nombre, rol, turno) VALUES ('Valeria Rojas', 'TENS Cuidadora', 'Rotativo / Noche')");
            db.run("INSERT INTO personal (nombre, rol, turno) VALUES ('Carlos Mendoza', 'Auxiliar de Aseo', 'Diurno')");
        }
    });

    db.get("SELECT COUNT(*) AS count FROM pacientes", (err, row) => {
        if (row && row.count === 0) {
            // Se puede usar la ruta local o una URL pública HTTPS para el QR
            db.run(`INSERT INTO pacientes (nombre, habitacion, pauta_cuidados, qr_info) VALUES 
            ('Camila Soto Morales', 'Habitación 101', '3 Antidepresivos (Sertralina AM, Fluoxetina PM, Amitriptilina Noche) | 4 Cigarros/día', '/images/QR 1.png')`);

            db.run(`INSERT INTO pacientes (nombre, habitacion, pauta_cuidados, qr_info) VALUES 
            ('Valentina Morales Rojas', 'Habitación 102', '4 Antidepresivos (Escitalopram AM, Venlafaxina AM, Sertralina PM, Mirtazapina Noche) | 3 Cigarros/día', '/images/QR 2.png')`);
        }
    });
});

// API ENDPOINTS

app.post('/api/login', (req, res) => {
    const { usuario, password } = req.body;
    if (usuario === 'admin' && password === 'admin123') {
        res.json({ success: true, mensaje: 'Bienvenido a Clínica Vital' });
    } else {
        res.status(401).json({ success: false, mensaje: 'Usuario o contraseña incorrectos' });
    }
});

app.get('/api/inventario', (req, res) => {
    db.all("SELECT * FROM inventario ORDER BY id ASC", [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

app.post('/api/inventario/usar', (req, res) => {
    const { id } = req.body;
    db.run("UPDATE inventario SET stock = stock - 1 WHERE id = ? AND stock > 0", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(400).json({ error: 'El stock ya se encuentra en 0' });
        res.json({ success: true });
    });
});

app.post('/api/inventario/agregar', (req, res) => {
    const { tipo, nombre, stock, unidad_medida, detalle } = req.body;
    const nombreLimpio = nombre.trim();
    
    db.get("SELECT id FROM inventario WHERE LOWER(nombre) = LOWER(?)", [nombreLimpio], (err, row) => {
        if (row) {
            db.run("UPDATE inventario SET stock = stock + ? WHERE id = ?", [stock, row.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, mensaje: 'Stock sumado al producto existente' });
            });
        } else {
            db.run("INSERT INTO inventario (tipo, nombre, stock, unidad_medida, detalle) VALUES (?, ?, ?, ?, ?)", 
            [tipo, nombreLimpio, stock, unidad_medida, detalle], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, id: this.lastID });
            });
        }
    });
});

app.delete('/api/inventario/eliminar/:id', (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM inventario WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.get('/api/clinica-data', (req, res) => {
    db.all("SELECT * FROM personal", [], (err, personal) => {
        db.all("SELECT * FROM pacientes", [], (err, pacientes) => {
            res.json({ personal, pacientes, localIp: LOCAL_IP, port: PORT });
        });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================================`);
    console.log(` Servidor Clínica Vital corriendo en:`);
    console.log(` Local:   http://localhost:${PORT}`);
    console.log(` Red Wi-Fi: http://${LOCAL_IP}:${PORT}`);
    console.log(`=================================================`);
});