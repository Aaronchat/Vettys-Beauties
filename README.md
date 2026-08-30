# Vetty's Beauties

A lightweight, mobile-first strip-club empire game that starts in Belton, Texas. It uses plain HTML, CSS, and JavaScript: no build step, package install, React, or Vite.

## Run the game

Open `index.html` in a browser. The game saves automatically in that browser using the existing save key:

`vettys-beauties-v01-save`

Old saves using that key continue through the built-in save migration and cleanup.

## Current game: v1.9

### Starting state

A New Game owns only Belton and starts with:

- Cash: $10,000
- Building: Level 1 of 5
- Capacity: 2 performers at Level 1
- Starting performer: Zella
- Starting gross revenue: $1,500 before facility bonuses
- Starting projected net: $400 per week

### Locations and empire state

The Locations panel is grouped by region. North America currently contains:

- Belton, Texas — owned from the start
- Austin, Texas — purchasable for $500,000

Cash and Week are shared across the empire. Buildings, facilities, rosters, managers, promotions, events, notifications, ledger, and club history belong to individual properties. Advance One Week settles every owned property, then combines all property results into the shared cash balance.

Austin opens at Building Level 1 with all facilities at Level 1, no performers, and Ted as manager. It develops independently from Belton. Each property has its own contract market. Hiring a performer creates a contract only at that club and does not move or alter her contract at another club. Performer transfers are not implemented.

### Buildings and facilities

The seven facilities are Bar, Main Stage, VIP, Private Dance Area, DJ Booth, Dressing Room, and Parking Lot.

Each facility level above Level 1 adds 5% to gross club revenue. A facility upgrade starts at $1,000 and doubles at each level. All seven facilities must reach the next level before the building can advance. Building upgrades start at $2,000 and also double at each level.

Building capacity is 2 / 3 / 4 / 5 / 6 performers across Levels 1–5.

### Performers and contracts

- The current pool includes Zella, Raven, Bambi, Candy, Cherry, Dallas, Cinnamon, Lola, Bella, Harley, and Scarlett.
- Performers are ranked F, E, D, C, B, or A.
- Rank determines both weekly revenue and the performer's share.
- Contracts last 26 weeks.
- Hiring or rehiring costs a $1,000 signing fee and respects building capacity.
- Renewal opens only when exactly 1 week remains.
- Each contract gets one renewal offer, from $1,000 to $5,000, with higher acceptance odds for larger offers.
- A rejected renewal costs nothing, but no second offer is allowed on that contract.
- Firing costs 50% of the remaining contract value.
- Expired or fired performers move to Former Performers and may return to the market.
- Training costs $5,000, lasts 4 weeks, and advances one rank.
- Training is disabled at Rank A.

Rank pay shares are F 20%, E 25%, D 30%, C 35%, B 40%, and A 50%.

### Property Managers

Each owned property has one active manager. Belton and Austin save their manager choices independently.

| Manager | Building Required | Weekly Salary | Automatic Renewal Offer |
| --- | ---: | ---: | ---: |
| Ted | Level 1 | Free | $1,000 / 50% |
| Susan | Level 2 | $500 | $2,000 / 70% |
| Barbara | Level 3 | $1,000 | $3,000 / 80% |
| Myrtle | Level 4 | $2,000 | $4,000 / 90% |
| Gertrude | Level 5 | $5,000 | $5,000 / 100% |

When a performer reaches 1 contract week remaining, the active manager uses the existing renewal-offer rules to make the manager's fixed offer. Manager salaries are recurring expenses. Accepted automatic renewal bonuses are recorded as one-time transactions. Myrtle and Gertrude also automatically schedule eligible performers for training, but managers may never have more than half of a property's signed roster training at once (rounded down).

Managers may automatically replace certain open performer slots. They do not transfer performers or give promotion advice.

### Promotions, events, and ledger

- One promotion per category may be bought each week.
- Promotion cost is $1,000 times the current Building Level.
- Promotion results are -100%, -75%, -50%, -25%, 0%, +25%, +50%, +75%, or +100%.
- Weekly random events can affect cash, Sheriff expenses, injuries, and performer availability.
- The Weekly Ledger separates performer revenue, facility effects, promotions, random events, one-time transactions, recurring expenses, and final net.
- Club History records major purchases, contract changes, promotions, and weekly surprises.
- Random events open as large notifications.
- A performer reaching 1 contract week remaining triggers a large renewal warning with a direct link to her profile.
- Every ledger category displays its own subtotal.
- Advance One Week stays visible below the collapsible Weekly Ledger.

### Building expenses

| Building | Property Tax | Operations | Advertising | Sheriff |
| --- | ---: | ---: | ---: | ---: |
| L1 | $100 | $500 | $100 | $100 |
| L2 | $200 | $750 | $150 | $150 |
| L3 | $400 | $1,250 | $250 | $250 |
| L4 | $750 | $2,000 | $400 | $400 |
| L5 | $1,250 | $3,500 | $750 | $750 |

## Code structure

- `index.html` — screen layout and script-loading order
- `styles.css` — all visual styling
- `assets/buildings/` — Building Level 1–5 artwork
- `assets/performers/` — performer portraits
- `src/data.js` — game constants, performer records, and asset paths
- `src/locations.js` — location catalog helpers, property creation, switching, and Austin purchase
- `src/state.js` — empire state, browser saves, legacy migration, history, and selected profile
- `src/economy.js` — revenue, expenses, promotions, events, ledger math, and weekly settlement
- `src/contracts.js` — hiring, renewals, firing, former performers, and market rules
- `src/managers.js` — property manager selection and automatic renewal behavior
- `src/training.js` — training and rank advancement
- `src/upgrades.js` — facility and building upgrades
- `src/render.js` — all screen drawing
- `src/main.js` — button connections and startup

The files are ordinary browser scripts loaded in that order. Keep the order in `index.html` unless their dependencies are deliberately changed.

## Planned, not implemented

- Locations beyond Belton and Austin
- Performer transfers
- Regional performer markets
- Multiple currencies, travel costs, and travel time
- Manager promotion recommendations
- Fast-tracked construction, loans, and bankruptcy systems
- Special Austin events

The multi-location engine is intentionally data-driven so another location can be added to the catalog without rebuilding the game.
