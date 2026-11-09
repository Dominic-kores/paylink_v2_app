
# PayLink v2 — Real-Time M-Pesa Payment Platform

## Overview

PayLink v2 is a full-stack payment-link application designed
for Kenyan merchants to create payment requests, receive
M-Pesa payments, and monitor transactions in real time.

The project extends PayLink v1 by integrating WebSockets,
email receipts, SMS alerts, merchant notifications,Africa's talking and
payment analytics.

## Project Objectives

- Integrate Socket.IO with Node.js and Express.
- Replace payment-status polling with real-time updates.
- Process M-Pesa STK Push payments via Safaricom Daraja.
- Send transactional HTML emails using Resend.
- Send merchant and customer SMS notifications.
- Store persistent notifications in PostgreSQL.
- Implement payment history with search filters and pagination.
- Visualise merchant revenue using dashboard charts.
- Apply authentication and role-based access foundations.

## Technologies Used

### Frontend
- React.js
- Vite
- Socket.IO Client
- React Router
- Recharts
- CSS

### Backend
- Node.js
- Express.js
- Socket.IO
- Prisma ORM v6
- PostgreSQL
- JWT Authentication
- bcryptjs

### External APIs
- Safaricom Daraja API
- Resend Email API
- Africa's Talking SMS API

## Core Features

### 1. Payment Links
Merchants can generate unique URLs that allow customers
to make payments using M-Pesa.

### 2. Real-Time Payments
Socket.IO delivers payment updates immediately after
the backend processes a payment callback.

### 3. Email Receipts
Successful payments can trigger formatted HTML receipts
containing the transaction amount, reference and date.

### 4. SMS Notifications
The application submits payment confirmation messages
to the payer and merchant.

### 5. Merchant Dashboard
Merchants can view total revenue, pending payments,
completed transactions and a seven-day revenue chart.

### 6. Payment History
Payments can be filtered by status, date and amount,
with server-side pagination.

### 7. Notifications
Merchants receive live notifications, unread badges
and auto-dismissing toast alerts. Notifications are
also stored for offline access.

## Getting Started

### Backend

```bash
cd server
npm install
npx prisma migrate dev
npx prisma generate
npm run dev
```

### Frontend

```bash
cd client
npm install
npm run dev
```

## Environment Variables
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/paylink_v2"

PORT=3001
NODE_ENV=development

CLIENT_URL=http://localhost:5173
PUBLIC_SERVER_URL=http://localhost:3001

JWT_SECRET=replace_with_a_long_random_secret

# Safaricom Daraja (Sandbox)
MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_sandbox_passkey
MPESA_CALLBACK_SECRET=replace_with_random_callback_secret

# Resend
RESEND_API_KEY=re_your_api_key
FROM_EMAIL="PayLink <onboarding@resend.dev>"

# Africa's Talking
AT_USERNAME=sandbox
AT_API_KEY=your_sandbox_api_key
AT_SENDER_ID=

## Testing

Use Thunder Client or Postman to test:

- Merchant registration and login
- Payment-link creation
- M-Pesa STK Push requests
- Payment callback processing
- Payment history and filters
- Analytics API
- Notification endpoints

Use a separate development database for simulated
M-Pesa callbacks.

## Live Application

Frontend: https://paylink-v2-app.vercel.app

Backend: https://paylinkv2app-production.up.railway.app

## Security

- Password hashing with bcrypt
- JWT authentication
- Merchant-specific database access
- Authenticated Socket.IO merchant rooms
- Callback idempotency checks
- Environment-based credential management

## Future Improvements

- WhatsApp payment confirmations
- Automated daily merchant summary emails
- Advanced revenue analytics
- Transaction reconciliation
- Background job queues and retries
- Multi-merchant settlement support
- Automated testing and CI/CD



## Author

Dominic Kores Kisioya

Full-Stack Software & AI Engineer
