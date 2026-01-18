// Detail page functionality
document.addEventListener('DOMContentLoaded', function() {
    // Get listing ID from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const listingId = urlParams.get('id') || 49599459;
    
    // Find the listing
    const listing = listings.find(l => l.id == listingId);
    
    if (!listing) {
        console.error('Listing not found');
        return;
    }
    
    // Populate the page
    populateListingDetails(listing);
    setupGallery(listing.images);
    setupCalendar(listing);
    setupGuestSelector(listing);
});

function populateListingDetails(listing) {
    // Title and meta
    document.getElementById('listingTitle').textContent = listing.title;
    document.getElementById('listingRating').textContent = listing.rating;
    document.getElementById('reviewCount').textContent = listing.reviews;
    document.getElementById('listingLocation').textContent = listing.location;
    
    // Superhost badge
    const superhostBadge = document.getElementById('superhostBadge');
    if (!listing.badge) {
        superhostBadge.style.display = 'none';
    }
    
    // Host info
    document.getElementById('hostName').textContent = listing.host;
    document.getElementById('propertyStats').textContent = 
        `${listing.guests} guests · ${listing.bedrooms} bedrooms · ${listing.beds} beds · ${listing.baths} baths`;
    
    // About section
    document.getElementById('aboutSpace').textContent = listing.aboutSpace;
    document.getElementById('theSpace').textContent = listing.theSpace;
    
    // Price
    document.getElementById('priceAmount').textContent = listing.price;
    document.getElementById('cardRating').textContent = listing.rating;
    document.getElementById('cardReviews').textContent = listing.reviews;
    document.getElementById('nightlyRate').textContent = listing.price;
    
    // Amenities
    const amenitiesGrid = document.getElementById('amenitiesGrid');
    const amenityIcons = {
        'Ocean view': '🌊',
        'Hot tub': '♨️',
        'Fire pit': '🔥',
        'Beach access': '🏖️',
        'Whale watching': '🐋',
        'Fast WiFi': '📶',
        'Kitchen': '🍳',
        'Dedicated workspace': '💻',
        'Free parking': '🚗',
        'Pet friendly': '🐕'
    };
    
    listing.amenities.forEach(amenity => {
        const icon = amenityIcons[amenity] || '✓';
        amenitiesGrid.innerHTML += `
            <div class="amenity-item">
                <span class="amenity-icon">${icon}</span>
                <span>${amenity}</span>
            </div>
        `;
    });
    
    // House rules
    const rulesList = document.getElementById('rulesList');
    listing.houseRules.forEach(rule => {
        rulesList.innerHTML += `<li>${rule}</li>`;
    });
    
    // Update booking links
    document.querySelectorAll('a[href*="airbnb.com"]').forEach(link => {
        link.href = listing.airbnbUrl;
    });
}

function setupGallery(images) {
    if (!images || images.length === 0) return;
    
    const mainImage = document.getElementById('mainImage');
    const thumbs = document.querySelectorAll('.gallery-thumb');
    
    // Set main image
    mainImage.src = images[0];
    
    // Set thumbnail images
    thumbs.forEach((thumb, index) => {
        if (images[index + 1]) {
            thumb.src = images[index + 1];
            thumb.addEventListener('click', () => {
                // Swap with main image
                const currentMain = mainImage.src;
                mainImage.src = thumb.src;
                thumb.src = currentMain;
                
                // Add animation
                mainImage.style.opacity = '0';
                setTimeout(() => {
                    mainImage.style.opacity = '1';
                }, 50);
            });
        }
    });
    
    // Click main image to cycle through
    let currentIndex = 0;
    mainImage.addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % images.length;
        mainImage.style.opacity = '0';
        setTimeout(() => {
            mainImage.src = images[currentIndex];
            mainImage.style.opacity = '1';
        }, 150);
    });
}

// =============================================
// CALENDAR FUNCTIONALITY
// =============================================

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let checkInDate = null;
let checkOutDate = null;
let selectingCheckOut = false;
let currentListing = null;
let bookedDates = []; // Array of {check_in, check_out} objects

// Fetch booked dates from API
async function fetchBookedDates(listingId) {
    try {
        const response = await fetch(`/api/reservations/dates/${listingId}`);
        if (response.ok) {
            bookedDates = await response.json();
            renderCalendar(); // Re-render with booked dates
        }
    } catch (error) {
        console.error('Error fetching booked dates:', error);
    }
}

// Check if a date is booked
function isDateBooked(date) {
    for (const booking of bookedDates) {
        const checkIn = new Date(booking.check_in);
        const checkOut = new Date(booking.check_out);
        checkIn.setHours(0, 0, 0, 0);
        checkOut.setHours(0, 0, 0, 0);
        
        if (date >= checkIn && date < checkOut) {
            return true;
        }
    }
    return false;
}

// Check if a date range conflicts with any booking
function hasConflict(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    for (const booking of bookedDates) {
        const checkIn = new Date(booking.check_in);
        const checkOut = new Date(booking.check_out);
        checkIn.setHours(0, 0, 0, 0);
        checkOut.setHours(0, 0, 0, 0);
        
        // Check if ranges overlap
        if (start < checkOut && end > checkIn) {
            return true;
        }
    }
    return false;
}

function setupCalendar(listing) {
    currentListing = listing;
    
    // Fetch booked dates for this listing
    fetchBookedDates(listing.id);
    
    const calendarContainer = document.getElementById('calendarContainer');
    const checkinGroup = document.getElementById('checkinGroup');
    const checkoutGroup = document.getElementById('checkoutGroup');
    const prevMonth = document.getElementById('prevMonth');
    const nextMonth = document.getElementById('nextMonth');
    const clearDates = document.getElementById('clearDates');
    
    // Toggle calendar on date input click
    checkinGroup.addEventListener('click', () => {
        selectingCheckOut = false;
        checkinGroup.classList.add('active');
        checkoutGroup.classList.remove('active');
        calendarContainer.classList.add('active');
        document.getElementById('guestDropdown').classList.remove('active');
        document.getElementById('guestInput').classList.remove('active');
    });
    
    checkoutGroup.addEventListener('click', () => {
        selectingCheckOut = true;
        checkoutGroup.classList.add('active');
        checkinGroup.classList.remove('active');
        calendarContainer.classList.add('active');
        document.getElementById('guestDropdown').classList.remove('active');
        document.getElementById('guestInput').classList.remove('active');
    });
    
    // Navigation
    prevMonth.addEventListener('click', (e) => {
        e.stopPropagation();
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendar();
    });
    
    nextMonth.addEventListener('click', (e) => {
        e.stopPropagation();
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar();
    });
    
    // Clear dates
    clearDates.addEventListener('click', (e) => {
        e.stopPropagation();
        checkInDate = null;
        checkOutDate = null;
        selectingCheckOut = false;
        document.getElementById('checkinDate').value = '';
        document.getElementById('checkoutDate').value = '';
        updatePriceBreakdown();
        renderCalendar();
    });
    
    // Close calendar when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.date-selection')) {
            calendarContainer.classList.remove('active');
            checkinGroup.classList.remove('active');
            checkoutGroup.classList.remove('active');
        }
    });
    
    renderCalendar();
}

function renderCalendar() {
    const calendarDays = document.getElementById('calendarDays');
    const calendarMonth = document.getElementById('calendarMonth');
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    calendarMonth.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    
    // Get first day of month and number of days
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let html = '';
    
    // Empty cells for days before first of month
    for (let i = 0; i < firstDay; i++) {
        html += '<button class="calendar-day empty"></button>';
    }
    
    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const dateStr = formatDate(date);
        const isPast = date < today;
        const isBooked = isDateBooked(date);
        
        let classes = ['calendar-day'];
        
        if (isPast || isBooked) {
            classes.push('disabled');
        }
        
        if (isBooked) {
            classes.push('booked');
        }
        
        if (date.getTime() === today.getTime()) {
            classes.push('today');
        }
        
        if (checkInDate && dateStr === formatDate(checkInDate)) {
            classes.push('selected', 'range-start');
        }
        
        if (checkOutDate && dateStr === formatDate(checkOutDate)) {
            classes.push('selected', 'range-end');
        }
        
        if (checkInDate && checkOutDate && date > checkInDate && date < checkOutDate) {
            classes.push('in-range');
        }
        
        html += `<button class="${classes.join(' ')}" data-date="${dateStr}" ${(isPast || isBooked) ? 'disabled' : ''}>${day}</button>`;
    }
    
    calendarDays.innerHTML = html;
    
    // Add click handlers to days
    calendarDays.querySelectorAll('.calendar-day:not(.disabled):not(.empty)').forEach(dayBtn => {
        dayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const selectedDate = new Date(dayBtn.dataset.date);
            handleDateSelection(selectedDate);
        });
    });
}

function handleDateSelection(date) {
    if (!selectingCheckOut || !checkInDate) {
        // Selecting check-in date
        checkInDate = date;
        checkOutDate = null;
        selectingCheckOut = true;
        document.getElementById('checkinDate').value = formatDisplayDate(date);
        document.getElementById('checkoutDate').value = '';
        document.getElementById('checkinGroup').classList.remove('active');
        document.getElementById('checkoutGroup').classList.add('active');
    } else {
        // Selecting check-out date
        if (date <= checkInDate) {
            // If selected date is before check-in, make it the new check-in
            checkInDate = date;
            checkOutDate = null;
            document.getElementById('checkinDate').value = formatDisplayDate(date);
            document.getElementById('checkoutDate').value = '';
        } else {
            checkOutDate = date;
            document.getElementById('checkoutDate').value = formatDisplayDate(date);
            selectingCheckOut = false;
            document.getElementById('checkoutGroup').classList.remove('active');
            
            // Close calendar after both dates selected
            setTimeout(() => {
                document.getElementById('calendarContainer').classList.remove('active');
            }, 300);
        }
    }
    
    updatePriceBreakdown();
    renderCalendar();
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function formatDisplayDate(date) {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// =============================================
// GUEST SELECTOR FUNCTIONALITY
// =============================================

let guests = {
    adults: 1,
    children: 0,
    infants: 0,
    pets: 0
};

function setupGuestSelector(listing) {
    const guestInput = document.getElementById('guestInput');
    const guestDropdown = document.getElementById('guestDropdown');
    const maxGuests = listing.guests || 10;
    
    // Toggle dropdown
    guestInput.addEventListener('click', (e) => {
        e.stopPropagation();
        guestInput.classList.toggle('active');
        guestDropdown.classList.toggle('active');
        document.getElementById('calendarContainer').classList.remove('active');
        document.getElementById('checkinGroup').classList.remove('active');
        document.getElementById('checkoutGroup').classList.remove('active');
    });
    
    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.guest-selection')) {
            guestInput.classList.remove('active');
            guestDropdown.classList.remove('active');
        }
    });
    
    // Guest buttons
    document.querySelectorAll('.guest-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const type = btn.dataset.type;
            const action = btn.dataset.action;
            
            if (action === 'increase') {
                if (type === 'pets') {
                    if (guests.pets < 2) guests.pets++;
                } else if (type === 'infants') {
                    if (guests.infants < 5) guests.infants++;
                } else {
                    const totalGuests = guests.adults + guests.children;
                    if (totalGuests < maxGuests) {
                        guests[type]++;
                    }
                }
            } else {
                if (type === 'adults') {
                    if (guests.adults > 1) guests.adults--;
                } else {
                    if (guests[type] > 0) guests[type]--;
                }
            }
            
            updateGuestDisplay();
        });
    });
    
    updateGuestDisplay();
}

function updateGuestDisplay() {
    // Update counts
    document.getElementById('adultCount').textContent = guests.adults;
    document.getElementById('childCount').textContent = guests.children;
    document.getElementById('infantCount').textContent = guests.infants;
    document.getElementById('petCount').textContent = guests.pets;
    
    // Update display text
    const totalGuests = guests.adults + guests.children;
    let displayText = `${totalGuests} guest${totalGuests !== 1 ? 's' : ''}`;
    
    if (guests.infants > 0) {
        displayText += `, ${guests.infants} infant${guests.infants !== 1 ? 's' : ''}`;
    }
    
    if (guests.pets > 0) {
        displayText += `, ${guests.pets} pet${guests.pets !== 1 ? 's' : ''}`;
    }
    
    document.getElementById('guestCount').textContent = displayText;
    
    // Update button states
    const maxGuests = currentListing?.guests || 10;
    const totalCount = guests.adults + guests.children;
    
    document.querySelectorAll('.guest-btn').forEach(btn => {
        const type = btn.dataset.type;
        const action = btn.dataset.action;
        
        if (action === 'decrease') {
            if (type === 'adults') {
                btn.disabled = guests.adults <= 1;
            } else {
                btn.disabled = guests[type] <= 0;
            }
        } else {
            if (type === 'pets') {
                btn.disabled = guests.pets >= 2;
            } else if (type === 'infants') {
                btn.disabled = guests.infants >= 5;
            } else {
                btn.disabled = totalCount >= maxGuests;
            }
        }
    });
}

// =============================================
// PRICE CALCULATION
// =============================================

// Store calculated prices
let calculatedPrices = {
    nights: 0,
    nightlyRate: 0,
    subtotal: 0,
    cleaningFee: 199,
    tax: 0,
    total: 0
};

function updatePriceBreakdown() {
    const priceBreakdown = document.getElementById('priceBreakdown');
    const reserveBtn = document.getElementById('reserveBtn');
    
    if (checkInDate && checkOutDate) {
        const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        const nightlyRate = currentListing?.price || 350;
        const subtotal = nights * nightlyRate;
        const cleaningFee = 199;
        const taxableAmount = subtotal + cleaningFee;
        const tax = Math.round(taxableAmount * 0.135 * 100) / 100; // 13.5% tax
        const total = taxableAmount + tax;
        
        // Store for later use
        calculatedPrices = { nights, nightlyRate, subtotal, cleaningFee, tax, total };
        
        document.getElementById('numNights').textContent = nights;
        document.getElementById('subtotal').textContent = subtotal.toLocaleString();
        document.getElementById('tax').textContent = tax.toLocaleString();
        document.getElementById('totalPrice').textContent = total.toLocaleString();
        
        priceBreakdown.style.display = 'block';
        reserveBtn.disabled = false;
        reserveBtn.textContent = 'Reserve';
        
        // Update reserve button to open reservation modal
        reserveBtn.onclick = () => {
            openReservationModal();
        };
    } else {
        priceBreakdown.style.display = 'none';
        reserveBtn.disabled = true;
        reserveBtn.textContent = 'Check availability';
        reserveBtn.onclick = null;
    }
}

// =============================================
// STRIPE PAYMENT INTEGRATION
// =============================================

let stripe = null;
let elements = null;
let cardElement = null;

// Initialize Stripe
async function initializeStripe() {
    try {
        const response = await fetch('/api/stripe/config');
        
        if (!response.ok) {
            console.log('Stripe not configured - payment processing disabled');
            return;
        }
        
        const { publishableKey, error } = await response.json();
        
        if (error || !publishableKey) {
            console.log('Stripe not configured - payment processing disabled');
            return;
        }
        
        stripe = Stripe(publishableKey);
        elements = stripe.elements({
            fonts: [
                {
                    cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
                }
            ]
        });
        
        // Create card element with custom styling
        const style = {
            base: {
                color: '#1E293B',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                fontSmoothing: 'antialiased',
                fontSize: '16px',
                '::placeholder': {
                    color: '#94A3B8'
                }
            },
            invalid: {
                color: '#EF4444',
                iconColor: '#EF4444'
            }
        };
        
        cardElement = elements.create('card', { 
            style: style,
            hidePostalCode: false
        });
        
        console.log('✅ Stripe initialized successfully');
    } catch (error) {
        console.error('Error initializing Stripe:', error);
    }
}

// Track if card element is mounted
let cardMounted = false;

// Mount card element when modal opens
function mountCardElement() {
    if (cardElement && !cardMounted) {
        const cardContainer = document.getElementById('card-element');
        if (cardContainer) {
            // Clear any existing content
            cardContainer.innerHTML = '';
            
            cardElement.mount('#card-element');
            cardMounted = true;
            
            // Handle real-time validation errors
            cardElement.on('change', (event) => {
                const displayError = document.getElementById('card-errors');
                if (event.error) {
                    displayError.textContent = event.error.message;
                    displayError.style.display = 'block';
                } else {
                    displayError.textContent = '';
                    displayError.style.display = 'none';
                }
            });
            
            console.log('✅ Card element mounted');
        }
    }
}

// Unmount card element when modal closes
function unmountCardElement() {
    if (cardElement && cardMounted) {
        cardElement.unmount();
        cardMounted = false;
        console.log('Card element unmounted');
    }
}

// =============================================
// RESERVATION MODAL FUNCTIONALITY
// =============================================

function openReservationModal() {
    const modal = document.getElementById('reservationModal');
    const summary = document.getElementById('reservationSummary');
    
    // Populate summary
    summary.innerHTML = `
        <div class="summary-row">
            <span>Check-in</span>
            <span>${formatDisplayDate(checkInDate)}</span>
        </div>
        <div class="summary-row">
            <span>Checkout</span>
            <span>${formatDisplayDate(checkOutDate)}</span>
        </div>
        <div class="summary-row">
            <span>Guests</span>
            <span>${document.getElementById('guestCount').textContent}</span>
        </div>
        <div class="summary-row">
            <span>$${calculatedPrices.nightlyRate} × ${calculatedPrices.nights} nights</span>
            <span>$${calculatedPrices.subtotal.toLocaleString()}</span>
        </div>
        <div class="summary-row">
            <span>Cleaning fee</span>
            <span>$${calculatedPrices.cleaningFee}</span>
        </div>
        <div class="summary-row">
            <span>Tax (13.5%)</span>
            <span>$${calculatedPrices.tax.toLocaleString()}</span>
        </div>
        <div class="summary-row total-row">
            <span>Total</span>
            <span>$${calculatedPrices.total.toLocaleString()}</span>
        </div>
    `;
    
    // Update payment amount on button
    document.getElementById('paymentAmount').textContent = calculatedPrices.total.toLocaleString();
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Mount Stripe card element
    setTimeout(() => {
        mountCardElement();
    }, 100);
}

function closeReservationModal() {
    document.getElementById('reservationModal').classList.remove('active');
    document.body.style.overflow = '';
    // Unmount card element when closing modal
    unmountCardElement();
}

function showConfirmation(reservation) {
    closeReservationModal();
    
    const modal = document.getElementById('confirmationModal');
    document.getElementById('confirmationId').textContent = reservation.id;
    
    document.getElementById('confirmationDetails').innerHTML = `
        <p><strong>Property:</strong> ${currentListing.title}</p>
        <p><strong>Check-in:</strong> ${formatDisplayDate(new Date(reservation.check_in))}</p>
        <p><strong>Checkout:</strong> ${formatDisplayDate(new Date(reservation.check_out))}</p>
        <p><strong>Guests:</strong> ${reservation.adults + reservation.children} guests</p>
        <p><strong>Total Paid:</strong> $${reservation.total_price.toLocaleString()}</p>
        <p><strong>Status:</strong> <span class="status-confirmed">Confirmed</span></p>
    `;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

async function submitReservation(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitReservation');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    const cardErrors = document.getElementById('card-errors');
    
    // Show loading state
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'flex';
    cardErrors.textContent = '';
    cardErrors.style.display = 'none';
    
    const reservationData = {
        listing_id: currentListing.id,
        guest_name: document.getElementById('guestName').value,
        guest_email: document.getElementById('guestEmail').value,
        guest_phone: document.getElementById('guestPhone').value,
        check_in: formatDate(checkInDate),
        check_out: formatDate(checkOutDate),
        adults: guests.adults,
        children: guests.children,
        infants: guests.infants,
        pets: guests.pets,
        nightly_rate: calculatedPrices.nightlyRate,
        cleaning_fee: calculatedPrices.cleaningFee,
        service_fee: 0,
        tax: calculatedPrices.tax,
        total_price: calculatedPrices.total,
        num_nights: calculatedPrices.nights,
        special_requests: document.getElementById('specialRequests').value
    };
    
    try {
        // Step 1: Create PaymentIntent on the server
        const intentResponse = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: calculatedPrices.total,
                currency: 'usd',
                metadata: {
                    listing_id: currentListing.id,
                    guest_email: reservationData.guest_email,
                    check_in: reservationData.check_in,
                    check_out: reservationData.check_out
                }
            })
        });
        
        const { clientSecret, paymentIntentId } = await intentResponse.json();
        
        if (!clientSecret) {
            throw new Error('Failed to create payment intent');
        }
        
        // Step 2: Confirm the payment with Stripe
        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: cardElement,
                billing_details: {
                    name: reservationData.guest_name,
                    email: reservationData.guest_email,
                    phone: reservationData.guest_phone || undefined
                }
            }
        });
        
        if (error) {
            // Payment failed - show error to user
            cardErrors.textContent = error.message;
            cardErrors.style.display = 'block';
            throw new Error(error.message);
        }
        
        if (paymentIntent.status === 'succeeded') {
            // Step 3: Create reservation with payment confirmation
            const response = await fetch('/api/reservations/with-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...reservationData,
                    payment_intent_id: paymentIntentId
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showConfirmation(data.reservation);
                document.getElementById('reservationForm').reset();
                
                // Clear card element
                if (cardElement) {
                    cardElement.clear();
                }
                
                // Reset dates
                checkInDate = null;
                checkOutDate = null;
                document.getElementById('checkinDate').value = '';
                document.getElementById('checkoutDate').value = '';
                updatePriceBreakdown();
                
                // Refresh booked dates
                fetchBookedDates(currentListing.id);
            } else {
                cardErrors.textContent = data.error || 'Failed to create reservation.';
                cardErrors.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Payment Error:', error);
        if (!cardErrors.textContent) {
            cardErrors.textContent = 'Payment failed. Please try again.';
            cardErrors.style.display = 'block';
        }
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

// Setup modal event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Stripe
    initializeStripe();
    
    // Close modal buttons
    document.getElementById('closeModal')?.addEventListener('click', closeReservationModal);
    document.getElementById('closeConfirmation')?.addEventListener('click', () => {
        document.getElementById('confirmationModal').classList.remove('active');
        document.body.style.overflow = '';
    });
    
    // Close on overlay click
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });
    
    // Form submission
    document.getElementById('reservationForm')?.addEventListener('submit', submitReservation);
});
