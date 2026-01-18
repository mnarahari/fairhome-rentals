// Your Airbnb Listing
const listings = [
    {
        id: 49599459,
        title: "Cloud Nine - A Charming Ocean View Home with Hot Tub",
        image: "images/IMG_1989.JPG",
        images: [
            "images/IMG_1989.JPG",
            "images/IMG_1990.JPG",
            "images/IMG_1991.JPG",
            "images/IMG_1992.JPG",
            "images/IMG_1993.JPG",
            "images/IMG_1994.JPG",
            "images/IMG_1996.JPG",
            "images/IMG_1997.JPG",
            "images/IMG_1998.JPG",
            "images/IMG_1999.JPG",
            "images/IMG_2001.JPG",
            "images/IMG_2002.JPG",
            "images/IMG_2004.JPG",
            "images/IMG_2005.JPG",
            "images/IMG_2006.JPG",
            "images/IMG_2007.jpg",
            "images/IMG_2008.JPG",
            "images/IMG_2009.JPG",
            "images/IMG_2010.JPG",
            "images/IMG_2011.JPG",
            "images/IMG_2012.JPG",
            "images/IMG_2013.JPG",
            "images/IMG_2014.JPG",
            "images/IMG_2015.JPG",
            "images/IMG_2016.JPG",
            "images/IMG_2017.JPG",
            "images/IMG_2018.JPG",
            "images/IMG_2019.JPG",
            "images/IMG_2020.JPG",
            "images/IMG_2021.JPG",
            "images/IMG_2022.JPG",
            "images/IMG_0997.jpg"
        ],
        location: "Belle Beach, Depoe Bay, Oregon",
        category: "beach",
        description: "10 guests · 4 bedrooms · 5 beds · 3 baths",
        guests: 10,
        bedrooms: 4,
        beds: 5,
        baths: 3,
        dates: "Available now",
        price: 350,
        rating: 4.89,
        reviews: 129,
        badge: "Superhost",
        host: "Cloud9",
        hostYears: 5,
        aboutSpace: "The Cloud Nine beach house lives up to its name. It is perfect for everyone and offers a variety of activities and amenities to ensure all guests enjoy their stay. The home is located in a charming and cozy neighborhood and is just a minute walk from the beach. Giant glass windows throughout the home and decks on every floor offer breathtaking views of the ocean and extravagant sunsets.",
        theSpace: "A day at Cloud Nine would start with waking up to the sound of crashing waves and drinking your morning coffee on the balcony while watching whales swim by. Afterward, you could enjoy time on the beach or take a walk through the charming and colorful neighborhood. End the day with a beautiful sunset and make memories climbing into the hot tub or toasting s'mores from your own fire pit in the backyard.",
        amenities: ["Ocean view", "Hot tub", "Fire pit", "Beach access", "Whale watching", "Fast WiFi", "Kitchen", "Dedicated workspace", "Free parking", "Pet friendly"],
        houseRules: ["Check-in: 4:00 PM", "Checkout: 11:00 AM", "Max 3 cars parking", "Quiet hours after 10 PM", "No smoking", "Pets allowed (max 2 dogs)"],
        airbnbUrl: "https://www.airbnb.com/rooms/49599459"
    }
];

// State
let currentFilter = 'all';
let favoriteListings = new Set();

// DOM Elements
const listingsGrid = document.getElementById('listingsGrid');
const filterButtons = document.querySelectorAll('.filter-btn');
const searchInput = document.getElementById('searchInput');

// Initialize the app
function init() {
    renderListings(listings);
    setupEventListeners();
}

// Render listings
function renderListings(listingsToRender) {
    listingsGrid.innerHTML = '';
    
    if (listingsToRender.length === 0) {
        listingsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 48px; color: var(--text-secondary);">
                <p style="font-size: 18px;">No listings found. Try adjusting your filters.</p>
            </div>
        `;
        return;
    }
    
    listingsToRender.forEach(listing => {
        const card = createListingCard(listing);
        listingsGrid.appendChild(card);
    });
}

// Create listing card
function createListingCard(listing) {
    const card = document.createElement('div');
    card.className = 'listing-card';
    card.dataset.id = listing.id;
    
    const isFavorite = favoriteListings.has(listing.id);
    
    card.innerHTML = `
        <div class="listing-image-container">
            <img src="${listing.image}" alt="${listing.title || listing.location}" class="listing-image">
            ${listing.badge ? `<span class="listing-badge">${listing.badge}</span>` : ''}
            <button class="favorite-btn" data-id="${listing.id}">
                ${isFavorite ? '❤️' : '🤍'}
            </button>
        </div>
        <div class="listing-info">
            ${listing.title ? `<div class="listing-title">${listing.title}</div>` : ''}
            <div class="listing-header">
                <div class="listing-location">${listing.location}</div>
                <div class="listing-rating">
                    <span class="star">★</span>
                    <span>${listing.rating}</span>
                </div>
            </div>
            <div class="listing-details">${listing.description || ''}</div>
            <div class="listing-details">${listing.dates}</div>
            <div class="listing-price">
                <span class="price-amount">$${listing.price}</span>
                <span class="price-period">night</span>
            </div>
        </div>
    `;
    
    return card;
}

// Filter listings
function filterListings(category) {
    currentFilter = category;
    
    if (category === 'all') {
        renderListings(listings);
    } else {
        const filtered = listings.filter(listing => listing.category === category);
        renderListings(filtered);
    }
}

// Search listings
function searchListings(query) {
    const searchTerm = query.toLowerCase().trim();
    
    if (!searchTerm) {
        filterListings(currentFilter);
        return;
    }
    
    let filtered = listings.filter(listing => 
        listing.location.toLowerCase().includes(searchTerm)
    );
    
    if (currentFilter !== 'all') {
        filtered = filtered.filter(listing => listing.category === currentFilter);
    }
    
    renderListings(filtered);
}

// Toggle favorite
function toggleFavorite(listingId) {
    const id = parseInt(listingId);
    
    if (favoriteListings.has(id)) {
        favoriteListings.delete(id);
    } else {
        favoriteListings.add(id);
    }
    
    // Re-render to update favorite button
    filterListings(currentFilter);
}

// Setup event listeners
function setupEventListeners() {
    // Filter buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            const category = button.dataset.category;
            filterListings(category);
        });
    });
    
    // Search input
    searchInput.addEventListener('input', (e) => {
        searchListings(e.target.value);
    });
    
    // Favorite buttons (using event delegation)
    listingsGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('favorite-btn')) {
            e.stopPropagation();
            const listingId = e.target.dataset.id;
            toggleFavorite(listingId);
        }
        
        // Card click - navigate to detail page
        const card = e.target.closest('.listing-card');
        if (card && !e.target.classList.contains('favorite-btn')) {
            const listingId = card.dataset.id;
            window.location.href = `detail.html?id=${listingId}`;
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

