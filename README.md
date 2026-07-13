# RaktaSetu — real-time blood donation matching (MERN)

A blood donation platform where people request a blood group and compatible donors in the same city are notified **live** (Socket.io). Includes login for three account types (donor, requester, hospital) and a live database of blood available across hospitals.

## Stack

- **MongoDB** + Mongoose — users, blood requests, hospital inventory
- **Express** — REST API with JWT auth
- **React** (Vite) — client
- **Node.js** + **Socket.io** — real-time donor matching and live inventory updates

## Features

- **Three roles, one login**: donors, requesters (patients/families), hospitals
- **Registration collects name, blood group, city, phone** (hospitals register stock instead of a blood group)
- **Real-time matching**: creating a request instantly notifies every available, blood-compatible donor in that city via their private socket room; the requester gets a live alert when a donor accepts
- **Medically correct compatibility**: uses the standard ABO/Rh red-cell table (e.g. O− donors match every request; AB+ patients match every donor)
- **Donor availability toggle** and a searchable donor directory
- **Hospital blood inventory**: hospitals maintain units per blood group; the public stock page and per-group totals update live on every save
- **Request lifecycle**: open → matched → fulfilled/cancelled
- **Built-in chatbot**: a floating assistant (bottom-right, logged-in users) that answers blood-compatibility questions, reports live hospital stock straight from the database, and explains how the platform works. Works out of the box with a rule-based engine; add `ANTHROPIC_API_KEY` to `server/.env` to upgrade it to a Claude-powered assistant that's grounded in the same live data. If the AI call ever fails, it silently falls back to the rule-based answers.

## Run it locally

Prerequisites: Node 18+, MongoDB running locally (or a MongoDB Atlas URI).

### 1. Server

```bash
cd server
cp .env.example .env        # edit MONGO_URI and JWT_SECRET
npm install
npm run seed                # optional: demo hospitals + donors (password123)
npm run dev                 # http://localhost:5000
```

### 2. Client

```bash
cd client
npm install
npm run dev                 # http://localhost:5173
```

If your API isn't on localhost:5000, create `client/.env` with:

```
VITE_API_URL=https://your-api/api
VITE_SOCKET_URL=https://your-api
```

## Try the real-time matching

1. Open two browsers (or one normal + one incognito).
2. Browser A: log in as donor `aarav@demo.com` / `password123` (O−, Pokhara).
3. Browser B: register as a requester in **Pokhara** and create a request for any blood group.
4. Browser A gets an instant toast + the request appears on the dashboard. Click **I can donate** — Browser B is notified live with the donor's name and phone.

## API overview

| Method | Route | Who | Purpose |
|---|---|---|---|
| POST | /api/auth/register | anyone | Sign up (donor/requester/hospital) |
| POST | /api/auth/login | anyone | Log in |
| PATCH | /api/auth/availability | donor | Toggle donation availability |
| POST | /api/requests | requester/hospital | Create request + live-match donors |
| GET | /api/requests/for-me | donor | Open requests this donor can serve |
| POST | /api/requests/:id/accept | donor | Accept; requester notified live |
| PATCH | /api/requests/:id/status | requester | Mark fulfilled / cancelled |
| GET | /api/donors | logged in | Search compatible donors |
| GET | /api/inventory | logged in | Blood stock across hospitals |
| GET | /api/inventory/summary | logged in | Total units per blood group |
| PUT | /api/inventory | hospital | Set stock (broadcasts live) |
| POST | /api/chat | logged in | Chatbot (Claude if key set, rule-based otherwise) |

## Notes & known limits

- Contact phone numbers are visible to matched users by design — mention this in your privacy notice if you deploy publicly.
- City matching is exact-string (lowercased). For production, use geocoding + radius search (MongoDB `$geoNear`).
- JWT is stored in localStorage for simplicity; use httpOnly cookies for a hardened deployment.
