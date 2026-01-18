require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { initGoogleCalendar, addReservationToCalendar, updateCalendarEvent, deleteCalendarEvent } = require('./googleCalendar');

// Initialize Stripe (optional - only if keys are configured)
let stripe = null;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (stripeSecretKey && stripeSecretKey.trim() && stripeSecretKey.startsWith('sk_')) {
    try {
        stripe = require('stripe')(stripeSecretKey);
        console.log('✅ Stripe initialized');
    } catch (error) {
        console.log('⚠️  Stripe: Failed to initialize. Payment processing disabled.');
        stripe = null;
    }
} else {
    console.log('⚠️  Stripe: Secret key not configured. Payment processing disabled.');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Google Calendar (optional - works without it)
initGoogleCalendar();

// Admin credentials from environment variables
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'cloud-nine-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Auth middleware - protects admin routes
const requireAdmin = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized. Please login.' });
};

// Protect admin.html - redirect to login if not authenticated
app.get('/admin.html', (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    return res.redirect('/admin-login.html');
});

// Serve static files after auth check
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
            service_fee REAL DEFAULT 0,
            tax REAL DEFAULT 0,
            total_price REAL NOT NULL,
            num_nights INTEGER NOT NULL,
            special_requests TEXT,
            status TEXT DEFAULT 'pending',
            payment_status TEXT DEFAULT 'pending',
            payment_intent_id TEXT,
            payment_method TEXT,
            google_event_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Add payment columns if they don't exist (for existing databases)
    db.run(`ALTER TABLE reservations ADD COLUMN payment_status TEXT DEFAULT 'pending'`, (err) => {
        if (err && !err.message.includes('duplicate column')) console.error(err);
    });
    db.run(`ALTER TABLE reservations ADD COLUMN payment_intent_id TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) console.error(err);
    });
    db.run(`ALTER TABLE reservations ADD COLUMN payment_method TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) console.error(err);
    });
    // Add tax column if it doesn't exist (for existing databases)
    db.run(`ALTER TABLE reservations ADD COLUMN tax REAL DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) console.error(err);
    });
    
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
// ADMIN AUTH ROUTES
// =============================================

// Admin login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // Check username
        if (username !== ADMIN_USERNAME) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        let isValidPassword = false;
        
        if (ADMIN_PASSWORD_HASH) {
            // Compare with stored hash
            isValidPassword = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
        } else {
            // Fallback: if no hash is set, use default password (for initial setup only)
            // IMPORTANT: Set ADMIN_PASSWORD_HASH in production!
            const defaultPassword = process.env.ADMIN_PASSWORD || 'CloudNine2024!';
            isValidPassword = password === defaultPassword;
            if (isValidPassword) {
                console.log('⚠️  Using default admin password. Please set ADMIN_PASSWORD_HASH for security.');
            }
        }

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Set session
        req.session.isAdmin = true;
        req.session.username = username;
        
        console.log(`✅ Admin logged in: ${username}`);
        res.json({ message: 'Login successful', username });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
    const username = req.session.username;
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        console.log(`👋 Admin logged out: ${username}`);
        res.json({ message: 'Logged out successfully' });
    });
});

// Check auth status
app.get('/api/admin/check', (req, res) => {
    if (req.session && req.session.isAdmin) {
        res.json({ authenticated: true, username: req.session.username });
    } else {
        res.json({ authenticated: false });
    }
});

// =============================================
// API ROUTES
// =============================================

// Get all reservations (protected)
app.get('/api/reservations', requireAdmin, async (req, res) => {
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
            tax,
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
                nightly_rate, cleaning_fee, service_fee, tax, total_price, num_nights,
                special_requests
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            tax || 0,
            total_price,
            num_nights,
            special_requests || null
        ]);

        let newReservation = await dbGet('SELECT * FROM reservations WHERE id = ?', [result.lastID]);
        
        // Add to Google Calendar
        const calendarEvent = await addReservationToCalendar(newReservation);
        if (calendarEvent) {
            await dbRun('UPDATE reservations SET google_event_id = ? WHERE id = ?', [calendarEvent.id, newReservation.id]);
            newReservation.google_event_id = calendarEvent.id;
        }
        
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

// Update reservation status (protected)
app.patch('/api/reservations/:id', requireAdmin, async (req, res) => {
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

// Delete reservation (protected)
app.delete('/api/reservations/:id', requireAdmin, async (req, res) => {
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

// =============================================
// STRIPE PAYMENT ROUTES
// =============================================

// Get Stripe publishable key (for frontend)
app.get('/api/stripe/config', (req, res) => {
    if (!stripe) {
        return res.status(503).json({ error: 'Stripe not configured' });
    }
    res.json({ 
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY 
    });
});

// Create Payment Intent
app.post('/api/create-payment-intent', async (req, res) => {
    try {
        if (!stripe) {
            return res.status(503).json({ error: 'Stripe payment processing not available' });
        }

        const { 
            amount, 
            currency = 'usd',
            metadata = {}
        } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe expects cents
            currency: currency,
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                ...metadata,
                integration: 'cloud-nine-vacation-rental'
            }
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create reservation with payment
app.post('/api/reservations/with-payment', async (req, res) => {
    try {
        const {
            payment_intent_id,
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
            tax,
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

        // Verify payment if Stripe is configured and payment_intent_id provided
        let paymentIntent = null;
        let paymentMethodType = 'none';
        if (stripe && payment_intent_id) {
            try {
                paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
                
                if (paymentIntent.status !== 'succeeded') {
                    return res.status(400).json({ 
                        error: 'Payment not completed',
                        payment_status: paymentIntent.status
                    });
                }

                // Get payment method details
                if (paymentIntent.payment_method) {
                    const paymentMethod = await stripe.paymentMethods.retrieve(paymentIntent.payment_method);
                    paymentMethodType = paymentMethod.type;
                }
            } catch (error) {
                console.error('Stripe payment verification error:', error.message);
                return res.status(400).json({ error: 'Payment verification failed' });
            }
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
            // Refund the payment if dates are no longer available and Stripe is configured
            if (stripe && payment_intent_id) {
                try {
                    await stripe.refunds.create({
                        payment_intent: payment_intent_id,
                        reason: 'requested_by_customer'
                    });
                } catch (error) {
                    console.error('Refund error:', error.message);
                }
            }
            
            return res.status(409).json({ 
                error: 'These dates are already booked' + (stripe && payment_intent_id ? '. Your payment has been refunded.' : '.'),
                conflicts 
            });
        }

        // Insert new reservation with payment info
        const result = await dbRun(`
            INSERT INTO reservations (
                listing_id, guest_name, guest_email, guest_phone,
                check_in, check_out, adults, children, infants, pets,
                nightly_rate, cleaning_fee, service_fee, tax, total_price, num_nights,
                special_requests, status, payment_status, payment_intent_id, payment_method
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            tax || 0,
            total_price,
            num_nights,
            special_requests || null,
            'confirmed', // Auto-confirm paid reservations
            'paid',
            payment_intent_id,
            paymentMethodType
        ]);

        let newReservation = await dbGet('SELECT * FROM reservations WHERE id = ?', [result.lastID]);
        
        // Add to Google Calendar
        const calendarEvent = await addReservationToCalendar(newReservation);
        if (calendarEvent) {
            await dbRun('UPDATE reservations SET google_event_id = ? WHERE id = ?', [calendarEvent.id, newReservation.id]);
            newReservation.google_event_id = calendarEvent.id;
        }
        
        console.log(`✅ Paid reservation #${newReservation.id} created for ${guest_name} - $${total_price}`);
        
        res.status(201).json({
            message: 'Reservation created successfully',
            reservation: newReservation
        });
    } catch (error) {
        console.error('Error creating reservation:', error);
        res.status(500).json({ error: error.message });
    }
});

// Refund a reservation (protected)
app.post('/api/reservations/:id/refund', requireAdmin, async (req, res) => {
    try {
        if (!stripe) {
            return res.status(503).json({ error: 'Stripe payment processing not available' });
        }

        const reservation = await dbGet('SELECT * FROM reservations WHERE id = ?', [req.params.id]);
        
        if (!reservation) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        if (!reservation.payment_intent_id) {
            return res.status(400).json({ error: 'No payment found for this reservation' });
        }

        if (reservation.payment_status === 'refunded') {
            return res.status(400).json({ error: 'This reservation has already been refunded' });
        }

        // Create refund in Stripe
        const refund = await stripe.refunds.create({
            payment_intent: reservation.payment_intent_id,
            reason: 'requested_by_customer'
        });

        // Update reservation status
        await dbRun(
            'UPDATE reservations SET status = ?, payment_status = ? WHERE id = ?',
            ['cancelled', 'refunded', req.params.id]
        );

        const updated = await dbGet('SELECT * FROM reservations WHERE id = ?', [req.params.id]);
        
        console.log(`💸 Reservation #${req.params.id} refunded - $${reservation.total_price}`);
        
        res.json({ 
            message: 'Reservation refunded successfully',
            refund_id: refund.id,
            reservation: updated
        });
    } catch (error) {
        console.error('Error refunding reservation:', error);
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
