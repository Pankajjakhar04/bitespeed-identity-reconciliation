# Bitespeed – Identity Reconciliation Service

A production-ready web service that identifies and consolidates customer contacts across multiple purchases, even when different email addresses or phone numbers are used.

## 🌐 Live Endpoint

```
POST https://<your-render-app>.onrender.com/identify
```

> Replace the URL above with your deployed Render URL after hosting.

---

## 📋 Task Overview

FluxKart.com integrates Bitespeed to track customers who may use different contact details across orders. This service exposes a single `/identify` endpoint that:

- Links contacts sharing a phone number or email
- Designates the **oldest matching contact** as `primary`
- Tracks all subsequent contacts as `secondary`
- Merges two previously separate contact clusters when a request bridges them
- Returns a fully consolidated view of the customer's contact identity

---

## 🛠️ Tech Stack

| Layer       | Technology              |
|-------------|-------------------------|
| Runtime     | Node.js 18+             |
| Language    | TypeScript              |
| Framework   | Express.js              |
| ORM         | Prisma                  |
| Database    | PostgreSQL               |
| Hosting     | Render.com (free tier)  |

---

## 📐 Data Model

```prisma
model Contact {
  id             Int            @id @default(autoincrement())
  phoneNumber    String?
  email          String?
  linkedId       Int?           // FK → primary Contact.id
  linkPrecedence LinkPrecedence @default(primary)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  deletedAt      DateTime?

  linkedContact  Contact?  @relation("ContactLink", fields: [linkedId], references: [id])
  linkedContacts Contact[] @relation("ContactLink")
}

enum LinkPrecedence {
  primary
  secondary
}
```

---

## 🔌 API Reference

### `POST /identify`

**Request body** (JSON):

```json
{
  "email": "user@example.com",
  "phoneNumber": "1234567890"
}
```

> At least one of `email` or `phoneNumber` must be provided.  
> `phoneNumber` may be sent as a string or number.

**Response** (HTTP 200):

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["primary@example.com", "secondary@example.com"],
    "phoneNumbers": ["1234567890"],
    "secondaryContactIds": [23, 47]
  }
}
```

- `primaryContatctId` – ID of the oldest (primary) contact in the cluster
- `emails` – unique emails; primary contact's email is first
- `phoneNumbers` – unique phone numbers; primary contact's phone is first
- `secondaryContactIds` – IDs of all secondary contacts

### `GET /health`

Returns `{ "status": "ok", "timestamp": "..." }` – useful for uptime monitoring.

---

## ⚙️ Business Logic

| Scenario | Behaviour |
|---|---|
| No match found | Create new `primary` contact; return it |
| Exact match (same email **and** phone) | Return existing consolidated cluster |
| Partial match + new info | Create new `secondary` contact linked to the primary |
| Two separate clusters bridged by one request | Merge clusters; older primary wins; newer primary is demoted to `secondary` |

---

## 🚀 Running Locally

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (or a free Neon / Supabase instance)

### 1. Clone & install

```bash
git clone https://github.com/<your-username>/bitespeed-identity-reconciliation.git
cd bitespeed-identity-reconciliation
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your `DATABASE_URL`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
PORT=3000
NODE_ENV=development
```

### 3. Run database migrations

```bash
npx prisma migrate deploy
```

### 4. Start development server

```bash
npm run dev
```

The server starts at `http://localhost:3000`.

---

## 🏗️ Building for Production

```bash
npm run build
npm start
```

---

## ☁️ Deploying to Render

1. Push your code to a **GitHub** repository.
2. Go to [render.com](https://render.com) → **New → Web Service**.
3. Connect your GitHub repo.
4. Set the following:
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npx prisma migrate deploy && npm start`
5. Add environment variable `DATABASE_URL` pointing to your PostgreSQL instance.
6. Deploy – Render provides a free `.onrender.com` URL.

---

## 🧪 Example Scenarios

### Scenario 1 – New customer

```json
// Request
{ "email": "lorraine@hillvalley.edu", "phoneNumber": "123456" }

// Response
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": []
  }
}
```

### Scenario 2 – Same phone, new email → secondary created

```json
// Request
{ "email": "mcfly@hillvalley.edu", "phoneNumber": "123456" }

// Response
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

### Scenario 3 – Two separate clusters bridged → merge

```json
// Request  (george's email + biffsucks' phone)
{ "email": "george@hillvalley.edu", "phoneNumber": "717171" }

// Response  (george [id=11] is older → stays primary; biffsucks [id=27] demoted)
{
  "contact": {
    "primaryContatctId": 11,
    "emails": ["george@hillvalley.edu", "biffsucks@hillvalley.edu"],
    "phoneNumbers": ["919191", "717171"],
    "secondaryContactIds": [27]
  }
}
```

---

## 📁 Project Structure

```
.
├── prisma/
│   ├── schema.prisma            # Database schema
│   └── migrations/              # SQL migration history
├── src/
│   ├── index.ts                 # Express app bootstrap
│   ├── lib/
│   │   └── prisma.ts            # Prisma client singleton
│   ├── middleware/
│   │   └── errorHandler.ts      # Global error handler
│   ├── routes/
│   │   └── identify.ts          # POST /identify route
│   └── services/
│       └── contactService.ts    # Core reconciliation logic
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## 📝 License

MIT
