const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Initialize SQLite Database
const DB_FILE = path.join(__dirname, 'reservations.db');
const db = new sqlite3.Database(DB_FILE);

// Create tables
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS reservations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            listing_id INTEGER NOT NULL,
            guest_name TEXT NOT NULL,
            guest_email TEXT NOT NULL,
            guest_phone TEXT,
            check_in DATE NOT NULL,
            check_out DATE NOT NULL,
            adults INTEGER DEFAULT 1,
            children INTEGER DEFAULT 0,
            infants INTEGER DEFAULT 0,
            pets INTEGER DEFAULT 0,
            nightly_rate REAL NOT NULL,
            cleaning_fee REAL DEFAULT 199,
            service_fee REAL NOT NULL,
            total_price REAL NOT NULL,
            num_nights INTEGER NOT NULL,
            special_requests TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ SQLite database initialized');
});

// Helper function to run queries with promises
const dbAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// =============================================
// API ROUTES
// =============================================

// Get all reservations
app.get('/api/reservations', async (req, res) => {
    try {
        const reservations = await dbAll('SELECT * FROM reservations ORDER BY created_at DESC');
        res.json(reservations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get reservation by ID
app.get('/api/reservations/:id', async (req, res) => {
    try {
        const reservation = await dbGet('SELECT * FROM reservations WHERE id = ?', [req.params.id]);
        if (reservation) {
            res.json(reservation);
        } else {
            res.status(404).json({ error: 'Reservation not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new reservation
app.post('/api/reservations', async (req, res) => {
    try {
        const {
            listing_id,
            guest_name,
            guest_email,
            guest_phone,
            check_in,
            check_out,
            adults,
            children,
            infants,
            pets,
            nightly_rate,
            cleaning_fee,
            service_fee,
            total_price,
            num_nights,
            special_requests
        } = req.body;

        // Validate required fields
        if (!guest_name || !guest_email || !check_in || !check_out) {
            return res.status(400).json({ 
                error: 'Missing required fields: guest_name, guest_email, check_in, check_out' 
            });
        }

        // Check for conflicting reservations
        const conflicts = await dbAll(`
            SELECT * FROM reservations 
            WHERE listing_id = ? 
            AND status != 'cancelled'
            AND ((check_in <= ? AND check_out > ?) 
                OR (check_in < ? AND check_out >= ?) 
                OR (check_in >= ? AND check_out <= ?))
        `, [listing_id || 49599459, check_in, check_in, check_out, check_out, check_in, check_out]);

        if (conflicts.length > 0) {
            return res.status(409).json({ 
                error: 'These dates are already booked', 
                conflicts 
            });
        }

        // Insert new reservation
        const result = await dbRun(`
            INSERT INTO reservations (
                listing_id, guest_name, guest_email, guest_phone,
                check_in, check_out, adults, children, infants, pets,
                nightly_rate, cleaning_fee, service_fee, total_price, num_nights,
                special_requests
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            listing_id || 49599459,
            guest_name,
            guest_email,
            guest_phone || null,
            check_in,
            check_out,
            adults || 1,
            children || 0,
            infants || 0,
            pets || 0,
            nightly_rate,
            cleaning_fee || 199,
            service_fee,
            total_price,
            num_nights,
            special_requests || null
        ]);

        const newReservation = await dbGet('SELECT * FROM reservations WHERE id = ?', [result.lastID]);
        
        console.log(`✅ New reservation #${newReservation.id} created for ${guest_name}`);
        
        res.status(201).json({
            message: 'Reservation created successfully',
            reservation: newReservation
        });
    } catch (error) {
        console.error('Error creating reservation:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update reservation status
app.patch('/api/reservations/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                error: 'Invalid status. Must be: pending, confirmed, cancelled, or completed' 
            });
        }

        const result = await dbRun('UPDATE reservations SET status = ? WHERE id = ?', [status, req.params.id]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        const updated = await dbGet('SELECT * FROM reservations WHERE id = ?', [req.params.id]);
        res.json({ message: 'Reservation updated', reservation: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete reservation
app.delete('/api/reservations/:id', async (req, res) => {
    try {
        const result = await dbRun('DELETE FROM reservations WHERE id = ?', [req.params.id]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        res.json({ message: 'Reservation deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get booked dates for a listing (to block on calendar)
app.get('/api/reservations/dates/:listing_id', async (req, res) => {
    try {
        const bookedDates = await dbAll(`
            SELECT check_in, check_out 
            FROM reservations 
            WHERE listing_id = ? AND status != 'cancelled'
            ORDER BY check_in
        `, [req.params.listing_id]);
        
        res.json(bookedDates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║                                                    ║
║   🏖️  Cloud Nine Beach House Server Running!       ║
║                                                    ║
║   Website:  http://localhost:${PORT}                 ║
║   API:      http://localhost:${PORT}/api/reservations║
║   Database: SQLite (reservations.db)               ║
║                                                    ║
╚════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) console.error(err);
        console.log('Database connection closed.');
        process.exit(0);
    });
});
