# BitesSpeed Contact Identification Service

A contact identification and consolidation service built with Hono and deployed on Cloudflare Workers.

## Deployed Application

**Live URL:** https://bitespeed-identify.parasraina-33.workers.dev

## API Usage

### Identify Contact

**Endpoint:** `POST /identify`

**Request Body:**
```json
{
  "email": "user@example.com",
  "phoneNumber": "1234567890"
}
```

**Response:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["user@example.com"],
    "phoneNumbers": ["1234567890"],
    "secondaryContactIds": []
  }
}
```

### Test the Deployment

```bash
curl -X POST https://bitespeed-identify.parasraina-33.workers.dev/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "phoneNumber": "1234567890"}'
```

## Local Development

### Prerequisites

- Bun runtime

### Setup

1. Install dependencies:
```bash
bun install
```

2. Start development server:
```bash
bun run start
```

The server will run at `http://localhost:3001`

### Available Commands

- `bun run start` - Start local development server
- `bun run dev` - Start with file watching
- `bun run deploy` - Deploy to Cloudflare Workers

## Architecture

- **Runtime:** Bun
- **Framework:** Hono
- **Database:** Cloudflare D1 (SQLite)
- **Deployment:** Cloudflare Workers

## Features

- Contact identification and linking
- Automatic primary/secondary contact management
- Email and phone number consolidation
- RESTful API interface 