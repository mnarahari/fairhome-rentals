const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Database file path
const DB_FILE = path.join(__dirname, 'reservations.json');

// Initialize database
function initDB() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ reservations: [], nextId: 1 }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Initialize on startup
let db = initDB();
console.log('Database initialized successfully');

// =============================================
// API ROUTES
// =============================================

// Get all reservations
app.get('/api/reservations', (req, res) => {
    try {
        db = initDB(); // Refresh from file
        const sorted = [...db.reservations].sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        );
        res.json(sorted);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get reservation by ID
app.get('/api/reservations/:id', (req, res) => {
    try {
        db = initDB();
        const reservation = db.reservations.find(r => r.id === parseInt(req.params.id));
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
app.post('/api/reservations', (req, res) => {
    try {
        db = initDB();
        
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
        const checkInDate = new Date(check_in);
        const checkOutDate = new Date(check_out);
        
        const conflicts = db.reservations.filter(r => {
            if (r.listing_id !== (listing_id || 49599459) || r.status === 'cancelled') {
                return false;
            }
            const rCheckIn = new Date(r.check_in);
            const rCheckOut = new Date(r.check_out);
            
            return (checkInDate < rCheckOut && checkOutDate > rCheckIn);
        });

        if (conflicts.length > 0) {
            return res.status(409).json({ 
                error: 'These dates are already booked', 
                conflicts 
            });
        }

        // Create new reservation
        const newReservation = {
            id: db.nextId++,
            listing_id: listing_id || 49599459,
            guest_name,
            guest_email,
            guest_phone: guest_phone || null,
            check_in,
            check_out,
            adults: adults || 1,
            children: children || 0,
            infants: infants || 0,
            pets: pets || 0,
            nightly_rate,
            cleaning_fee: cleaning_fee || 199,
            service_fee,
            total_price,
            num_nights,
            special_requests: special_requests || null,
            status: 'pending',
            created_at: new Date().toISOString()
        };

        db.reservations.push(newReservation);
        saveDB(db);
        
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
app.patch('/api/reservations/:id', (req, res) => {
    try {
        db = initDB();
        const { status } = req.body;
        const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                error: 'Invalid status. Must be: pending, confirmed, cancelled, or completed' 
            });
        }

        const index = db.reservations.findIndex(r => r.id === parseInt(req.params.id));
        
        if (index === -1) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        db.reservations[index].status = status;
        saveDB(db);

        res.json({ 
            message: 'Reservation updated', 
            reservation: db.reservations[index] 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete reservation
app.delete('/api/reservations/:id', (req, res) => {
    try {
        db = initDB();
        const index = db.reservations.findIndex(r => r.id === parseInt(req.params.id));
        
        if (index === -1) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        db.reservations.splice(index, 1);
        saveDB(db);

        res.json({ message: 'Reservation deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get booked dates for a listing (to block on calendar)
app.get('/api/reservations/dates/:listing_id', (req, res) => {
    try {
        db = initDB();
        const bookedDates = db.reservations
            .filter(r => r.listing_id === parseInt(req.params.listing_id) && r.status !== 'cancelled')
            .map(r => ({ check_in: r.check_in, check_out: r.check_out }))
            .sort((a, b) => new Date(a.check_in) - new Date(b.check_in));
        
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
║                                                    ║
╚════════════════════════════════════════════════════╝
    `);
});
