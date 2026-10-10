<p align="center">
  <img src="logo.svg" alt="UNTANGLED logo: a tangled thread that unravels into a straight line" width="110" />
</p>

<h1 align="center">UNTANGLED</h1>

<p align="center">
  <strong>Bookings, payments and customers for salons and barbershops in Kenya, in one simple app.</strong>
</p>

<p align="center">
  <a href="https://YOUR-USERNAME.github.io/YOUR-REPO/">Live demo</a> ·
  <a href="#features">Features</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#roadmap">Roadmap</a>
</p>

<!-- TODO: replace YOUR-USERNAME and YOUR-REPO in the Live demo link above with your GitHub Pages address. -->

---

## About

Many small salons and barbershops in Kenya run on phone calls, WhatsApp messages, and a notebook. UNTANGLED replaces that pile of notes with one mobile-friendly app that works even when the internet doesn't.

It is a web app built with plain HTML, CSS and JavaScript, and it installs on a phone like a normal app.

## The problem

I interviewed salon and barbershop owners before building anything. The same four problems kept coming up:

1. **Bookings arrive everywhere:** calls, WhatsApp and word of mouth, with nothing in one place.
2. **No-shows are painful.** Owners end up rescheduling or trying to squeeze in a walk-in at the last minute.
3. **Payments are hard to track.** They rely on customers showing an M-Pesa message, or on cash noted in a book.
4. **Slow days cost money**, and owners can't easily see when those days are.

Each feature below maps back to one of these.

## Features

**Bookings**
- Bookings with a customer, service, staff member, date and time, price and duration
- A service menu with prices and durations, and a choice of which staff member does which service
- **Double-booking protection:** a clash is blocked for scheduled bookings and flagged for walk-ins
- **Walk-ins** in one tap, and booking status (Booked, In chair, Done, No-show)
- **WhatsApp reminders** in one tap, with the message already written (no API needed)

**Payments**
- Record each payment as **Cash or M-Pesa**, saving the M-Pesa transaction code
- Codes are checked for format, and the **same code can't be used twice**
- Daily takings split into cash and M-Pesa, so the till and the phone can be matched at closing

**Customers and loyalty**
- Customer history built automatically from bookings: visits, spend, usual service, no-shows
- Search by name or phone, and filter for regulars, customers not seen in 30+ days, or a free visit due
- **Loyalty reward:** every Nth visit is free (set by the owner), applied at booking time
- One-tap WhatsApp **win-back** and reward messages

**Insights**
- **Free time today** for each staff member, with no-shows freeing up their slots
- **Busy and quiet days report:** averages by day of the week and hour of the day, plus the no-show rate

**Works like an app**
- Installable on Android and iPhone, with its own icon
- **Works offline**, because the app is saved on the phone

## Screenshots

| Dashboard | Bookings | Booking form |
|:---:|:---:|:---:|
| <img src="screenshots/dashboard.png" alt="Dashboard with today's stats and staff free time" width="230" /> | <img src="screenshots/bookings.png" alt="List of today's bookings with payment and status actions" width="230" /> | <img src="screenshots/booking-form.png" alt="Booking form recognising a returning customer and offering a loyalty reward" width="230" /> |

| Customers | Busy and quiet days |
|:---:|:---:|
| <img src="screenshots/customers.png" alt="Customer list with a free-visit badge and a not-seen-in-41-days badge" width="230" /> | <img src="screenshots/report.png" alt="Bar charts of bookings by weekday and by hour" width="230" /> |

*Screenshots use made-up demo data.*

## Getting started

There is nothing to install and no build step.

### Run it on your computer

```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
cd YOUR-REPO
```

Then either open `index.html` in your browser, or serve the folder so that offline mode works too:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

The service worker (offline mode) only runs over `http://localhost` or `https`, not when `index.html` is opened directly from disk.

### Try it with sample data

`dev-sample-data.js` creates about 45 days of fake bookings, so the report and customer list have something to show. The app does not load this file by itself.

1. Open the app and press `F12` to open the browser console.
2. Paste the **ADD** block from `dev-sample-data.js` and press Enter.
3. When you're done, paste the **REMOVE** block. It deletes only the fake bookings.

### Install it on a phone

Open the live demo on your phone.

- **Android (Chrome):** tap **Install** in the box under the stats, or use the browser menu and choose **Install app**.
- **iPhone (Safari):** tap **Share**, then **Add to Home Screen**.

## How it's built

**Stack:** HTML, CSS and vanilla JavaScript. Data is stored in the browser (`localStorage`). A service worker provides offline support. There are no frameworks and no build tools.

```
.
├── index.html              Page structure
├── style.css               Styling
├── app.js                  App logic: screens, bookings, payments, customers, reports
├── store.js                The only file that touches stored data
├── pwa.js                  Service worker registration and install prompt
├── sw.js                   Service worker (offline support)
├── manifest.webmanifest    App name, colours and icons
├── logo.svg                Logo, also used as the browser tab icon
├── icons/                  App icons, including a maskable Android icon
├── screenshots/            Images used in this README
└── dev-sample-data.js      Fake data for testing (not loaded by the app)
```

### Design decisions

- **Storage is isolated in `store.js`.** Every method is `async` even though `localStorage` is instant. When the app moves to a real backend, only `store.js` changes and `app.js` stays the same.
- **Customers are not stored separately.** A customer is everyone who shares a phone number, worked out from the bookings. Phone numbers are normalised, so `0712 345 678` and `254712345678` match.
- **A "visit" is a booking that has started and wasn't a no-show.** I chose this over relying on the "Done" status, because owners rarely update statuses all day, and counting only "Done" would undercount regulars.
- **No-shows are kept out of the busy-time counts** but reported on their own, so a no-show doesn't make a day look busy.
- **The report ignores days before the first booking** in a period, so a shop that just started using the app doesn't see empty days counted as "quiet".
- **Typed text is never inserted as HTML.** Elements are built with `textContent`, so a customer name can't inject markup.
- **The offline cache refreshes in the background.** The app opens from the saved copy instantly and updates itself for the next visit.

## Known limitations

- **Data lives in one browser on one device.** Phones and laptops don't share data, and clearing browser data (or using a private tab) deletes it. This is a Phase 1 limit, and the roadmap below fixes it.
- **There are no accounts or login yet**, so the app suits one shop on one device.
- **M-Pesa payments are entered by hand.** The app checks the code format and duplicates, but it does not confirm payments with Safaricom.
- **There are no automated tests yet.** I have tested the app by hand and in a headless browser.

## Roadmap

- [x] **Phase 1:** a working front end: bookings, payments, customers, loyalty, reports, offline app
- [ ] **Phase 2: backend.** Owner sign-up and login, a hosted database, and several shops separated securely so each sees only its own data. This lets staff use the app on any device.
- [ ] **Automatic M-Pesa payments** using Safaricom's Daraja API (STK Push)
- [ ] **SMS reminders** and a customer-facing **booking link**, so customers can request slots themselves
- [ ] Per-staff reports and the ability to export or back up data
- [ ] Automated tests

## Development notes

When you add a new file to the app, or change a cached file, update `sw.js`:

1. Add any new file to the `ASSETS` list.
2. Bump the cache name, for example `untangled-v1` to `untangled-v2`, so phones pick up the new version.

## About the author

Built by **[Your Name]** as a bootcamp project while training to become a full-stack software engineer.

- GitHub: [@YOUR-USERNAME](https://github.com/YOUR-USERNAME)
- Contact: your-email@example.com

<!-- TODO: replace the placeholders above, and consider adding a LICENSE file (for example MIT). -->

