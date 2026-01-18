// Admin Dashboard JavaScript

let reservations = [];
let currentFilter = 'all';
let adminMonth = new Date().getMonth();
let adminYear = new Date().getFullYear();

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadReservations();
    setupEventListeners();
    renderAdminCalendar();
});

// Load reservations from API
async function loadReservations() {
    try {
        const response = await fetch('/api/reservations');
        reservations = await response.json();
        updateStats();
        renderReservationsTable();
        renderAdminCalendar();
    } catch (error) {
        console.error('Error loading reservations:', error);
    }
}

// Update statistics
function updateStats() {
    const total = reservations.length;
    const pending = reservations.filter(r => r.status === 'pending').length;
    const confirmed = reservations.filter(r => r.status === 'confirmed').length;
    const revenue = reservations
        .filter(r => r.status !== 'cancelled')
        .reduce((sum, r) => sum + r.total_price, 0);
    
    document.getElementById('totalReservations').textContent = total;
    document.getElementById('pendingReservations').textContent = pending;
    document.getElementById('confirmedReservations').textContent = confirmed;
    document.getElementById('totalRevenue').textContent = '$' + revenue.toLocaleString();
}

// Render reservations table
function renderReservationsTable() {
    const tbody = document.getElementById('reservationsTableBody');
    const emptyState = document.getElementById('emptyState');
    
    let filtered = reservations;
    if (currentFilter !== 'all') {
        filtered = reservations.filter(r => r.status === currentFilter);
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    tbody.innerHTML = filtered.map(r => `
        <tr data-id="${r.id}">
            <td>#${r.id}</td>
            <td>
                <div class="guest-cell">
                    <strong>${r.guest_name}</strong>
                    <span>${r.guest_email}</span>
                </div>
            </td>
            <td>
                <div class="dates-cell">
                    <span>${formatDate(r.check_in)}</span>
                    <span class="arrow">→</span>
                    <span>${formatDate(r.check_out)}</span>
                </div>
            </td>
            <td>${r.adults + r.children} guests</td>
            <td><strong>$${r.total_price.toLocaleString()}</strong></td>
            <td>
                <span class="status-badge status-${r.status}">${r.status}</span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view-btn" onclick="viewReservation(${r.id})" title="View Details">👁️</button>
                    ${r.status === 'pending' ? `
                        <button class="action-btn confirm-btn" onclick="updateStatus(${r.id}, 'confirmed')" title="Confirm">✓</button>
                    ` : ''}
                    ${r.status !== 'cancelled' ? `
                        <button class="action-btn cancel-btn" onclick="updateStatus(${r.id}, 'cancelled')" title="Cancel">✕</button>
                    ` : ''}
                    <button class="action-btn delete-btn" onclick="deleteReservation(${r.id})" title="Delete">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Format date for display
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// View reservation details
function viewReservation(id) {
    const r = reservations.find(res => res.id === id);
    if (!r) return;
    
    const detail = document.getElementById('reservationDetail');
    detail.innerHTML = `
        <div class="detail-grid">
            <div class="detail-section">
                <h3>Guest Information</h3>
                <p><strong>Name:</strong> ${r.guest_name}</p>
                <p><strong>Email:</strong> ${r.guest_email}</p>
                <p><strong>Phone:</strong> ${r.guest_phone || 'Not provided'}</p>
            </div>
            <div class="detail-section">
                <h3>Stay Details</h3>
                <p><strong>Check-in:</strong> ${formatFullDate(r.check_in)}</p>
                <p><strong>Checkout:</strong> ${formatFullDate(r.check_out)}</p>
                <p><strong>Nights:</strong> ${r.num_nights}</p>
                <p><strong>Guests:</strong> ${r.adults} adults, ${r.children} children, ${r.infants} infants</p>
                ${r.pets > 0 ? `<p><strong>Pets:</strong> ${r.pets}</p>` : ''}
            </div>
            <div class="detail-section">
                <h3>Pricing</h3>
                <p><strong>Nightly Rate:</strong> $${r.nightly_rate}</p>
                <p><strong>Subtotal:</strong> $${(r.nightly_rate * r.num_nights).toLocaleString()}</p>
                <p><strong>Cleaning Fee:</strong> $${r.cleaning_fee}</p>
                <p><strong>Service Fee:</strong> $${r.service_fee}</p>
                <p class="total"><strong>Total:</strong> $${r.total_price.toLocaleString()}</p>
            </div>
            <div class="detail-section full-width">
                <h3>Special Requests</h3>
                <p>${r.special_requests || 'None'}</p>
            </div>
            <div class="detail-section full-width">
                <h3>Status</h3>
                <div class="status-actions">
                    <span class="status-badge status-${r.status}">${r.status}</span>
                    <div class="status-buttons">
                        ${r.status !== 'confirmed' ? `<button class="status-btn confirm" onclick="updateStatus(${r.id}, 'confirmed'); closeDetailModal();">Confirm</button>` : ''}
                        ${r.status !== 'cancelled' ? `<button class="status-btn cancel" onclick="updateStatus(${r.id}, 'cancelled'); closeDetailModal();">Cancel</button>` : ''}
                        ${r.status !== 'completed' && r.status === 'confirmed' ? `<button class="status-btn complete" onclick="updateStatus(${r.id}, 'completed'); closeDetailModal();">Mark Complete</button>` : ''}
                    </div>
                </div>
            </div>
            <div class="detail-section full-width">
                <p class="created-at">Booked on ${new Date(r.created_at).toLocaleString()}</p>
            </div>
        </div>
    `;
    
    document.getElementById('detailModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('active');
    document.body.style.overflow = '';
}

// Update reservation status
async function updateStatus(id, status) {
    if (!confirm(`Are you sure you want to ${status === 'cancelled' ? 'cancel' : status} this reservation?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/reservations/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            loadReservations();
        } else {
            alert('Failed to update reservation');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to update reservation');
    }
}

// Delete reservation
async function deleteReservation(id) {
    if (!confirm('Are you sure you want to permanently delete this reservation?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/reservations/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadReservations();
        } else {
            alert('Failed to delete reservation');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to delete reservation');
    }
}

// Admin Calendar
function renderAdminCalendar() {
    const calendarDays = document.getElementById('adminCalendarDays');
    const calendarMonth = document.getElementById('adminCalendarMonth');
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    calendarMonth.textContent = `${monthNames[adminMonth]} ${adminYear}`;
    
    const firstDay = new Date(adminYear, adminMonth, 1).getDay();
    const daysInMonth = new Date(adminYear, adminMonth + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let html = '';
    
    // Empty cells
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="admin-calendar-day empty"></div>';
    }
    
    // Days
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(adminYear, adminMonth, day);
        const dateStr = date.toISOString().split('T')[0];
        
        // Check if date is booked
        const booking = getBookingForDate(date);
        let classes = ['admin-calendar-day'];
        let tooltip = '';
        
        if (date < today) {
            classes.push('past');
        }
        
        if (booking) {
            if (booking.status === 'confirmed') {
                classes.push('booked');
            } else if (booking.status === 'pending') {
                classes.push('pending');
            }
            tooltip = `${booking.guest_name} (${booking.status})`;
        }
        
        html += `<div class="${classes.join(' ')}" data-date="${dateStr}" ${tooltip ? `title="${tooltip}"` : ''}>
            <span class="day-number">${day}</span>
            ${booking ? `<span class="booking-indicator"></span>` : ''}
        </div>`;
    }
    
    calendarDays.innerHTML = html;
}

function getBookingForDate(date) {
    for (const r of reservations) {
        if (r.status === 'cancelled') continue;
        
        const checkIn = new Date(r.check_in);
        const checkOut = new Date(r.check_out);
        checkIn.setHours(0, 0, 0, 0);
        checkOut.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        
        if (date >= checkIn && date < checkOut) {
            return r;
        }
    }
    return null;
}

// Setup event listeners
function setupEventListeners() {
    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            renderReservationsTable();
        });
    });
    
    // Calendar navigation
    document.getElementById('prevMonthAdmin').addEventListener('click', () => {
        adminMonth--;
        if (adminMonth < 0) {
            adminMonth = 11;
            adminYear--;
        }
        renderAdminCalendar();
    });
    
    document.getElementById('nextMonthAdmin').addEventListener('click', () => {
        adminMonth++;
        if (adminMonth > 11) {
            adminMonth = 0;
            adminYear++;
        }
        renderAdminCalendar();
    });
    
    // Close modal
    document.getElementById('closeDetailModal').addEventListener('click', closeDetailModal);
    document.getElementById('detailModal').addEventListener('click', (e) => {
        if (e.target.id === 'detailModal') closeDetailModal();
    });
    
    // Auto-refresh every 30 seconds
    setInterval(loadReservations, 30000);
}

