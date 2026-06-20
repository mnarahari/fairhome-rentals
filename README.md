# StayScape - AirBnB Clone

A modern, beautiful web application for browsing property listings, inspired by AirBnB.

## 🎯 Project Overview

This is a multi-phase project to build a full-featured accommodation booking platform. Currently in **Phase 1**: Static listing display.

## 🚀 Current Features (Phase 1)

✅ **Beautiful Static Site**
- Modern, responsive design
- Grid layout for property listings
- High-quality images with hover effects
- Category filtering (Beach, City, Mountain, Countryside, Luxury)
- Search functionality by location
- Favorite/wishlist functionality
- Rating display
- Superhost badges

## 📁 Project Structure

```
airbnb-clone/
├── index.html          # Main HTML structure
├── styles.css          # All styling and responsive design
├── app.js             # JavaScript for interactivity and data
└── README.md          # This file
```

## 🎨 Design Features

- **Clean Navigation**: Sticky header with search bar and menu
- **Category Filters**: Quick filtering by property type
- **Responsive Grid**: Adapts to desktop, tablet, and mobile screens
- **Card Hover Effects**: Smooth animations and shadows
- **Modern Typography**: Using Inter font family
- **Color Scheme**: Primary accent color (#FF385C - AirBnB red)

## 🖥️ How to Run

Simply open `index.html` in your web browser:

```bash
# Option 1: Double-click the index.html file

# Option 2: Using Python's built-in server
python -m http.server 8000

# Option 3: Using Node.js http-server
npx http-server

# Then open http://localhost:8000 in your browser
```

## 📱 Responsive Breakpoints

- **Desktop**: 1280px and above (optimal viewing)
- **Tablet**: 768px - 1279px
- **Mobile**: Below 768px

## 🎯 Next Steps (Future Phases)

### Phase 2: Individual Listing Pages
- Detailed property pages
- Image galleries
- Amenities list
- Reviews section
- Map integration

### Phase 3: Booking System
- Date picker (check-in/check-out)
- Guest selection
- Price calculation
- Booking confirmation

### Phase 4: Backend Integration
- Database setup (listings, users, bookings)
- User authentication
- Real-time availability
- Payment processing

### Phase 5: Advanced Features
- User profiles
- Host dashboard
- Messaging system
- Advanced search filters

## 🛠️ Technologies Used

- **HTML5**: Semantic markup
- **CSS3**: Modern layouts (Grid, Flexbox), animations
- **Vanilla JavaScript**: No frameworks, pure JS
- **Google Fonts**: Inter font family
- **Unsplash API**: High-quality property images

## 📝 Sample Data

Currently includes 12 sample listings across different categories:
- Beach properties (Malibu, Miami Beach, Santorini)
- City apartments (New York, Los Angeles, Tokyo)
- Mountain retreats (Aspen, Swiss Alps)
- Countryside homes (Tuscany, Cotswolds)
- Luxury villas (Bali, Dubai)

## 🎨 Color Palette

```css
Primary: #FF385C (AirBnB red)
Text Primary: #222222
Text Secondary: #717171
Border: #DDDDDD
Background: #FFFFFF
Page Background: #F7F7F7
```

## 📄 License

This is a learning project for educational purposes.

## 🥾 Tour du Mont Blanc refuge availability checker

This repo also includes a scheduled Node.js job for checking refuge availability on
`https://www.montourdumontblanc.com/en/`.
Each scheduled run sends one summary email: `No availability` when nothing is
bookable, or `Availability found - act on it ASAP` when at least one configured
check has a booking link.

### Configure checks

Edit `tmb/checks.json`. The `checks` array can contain any number of
date/location/hotel combinations:

```json
{
  "checks": [
    {
      "id": "edelweiss-la-fouly-2026-08-07",
      "date": "2026-08-07",
      "location": "La Fouly",
      "hotelName": "Edelweiss",
      "refugeSlug": "hotel-edelweiss"
    },
    {
      "id": "auberge-mont-blanc-trient-2026-08-08",
      "date": "2026-08-08",
      "location": "Trient",
      "hotelName": "Auberge Mont-Blanc",
      "refugeSlug": "auberge-mont-blanc"
    }
  ]
}
```

Each scheduled run checks every configured row. The primary availability signal is
the presence of a `Book` link/button on the matching hotel card in the TMB search
results. If `refugeSlug` or `refugeUrl` is present and the hotel card cannot be
matched, the checker falls back to the refuge calendar page.

### Run locally

```bash
npm run tmb:check
```

To print email notifications that would be sent:

```bash
npm run tmb:check:dry-run-email
```

### Deploy to AWS

The AWS deployment uses:

- AWS Lambda for the checker
- EventBridge Schedule for periodic execution
- DynamoDB for per-check notification deduplication
- Amazon SES for email

Deploy with AWS SAM:

```bash
sam build
sam deploy --guided
```

Before enabling real email delivery, verify the `NotificationFromEmail` sender in
Amazon SES. If your AWS account is still in the SES sandbox, also verify
`mnarahari@gmail.com` and `anu.narahari@gmail.com` as recipients or request SES
production access.

For the full AWS runbook, including one-time invocation and log checks, see
[`docs/tmb-aws-deployment.md`](docs/tmb-aws-deployment.md).

---

**Current Status**: ✅ Phase 1 Complete - Static Listing Site
**Next Phase**: Individual listing detail pages with booking interface

