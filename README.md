# Small Shop Management System

An offline-first retail management and Point of Sale (POS) web application designed for small shops and retail stores.

---

## Overview

The **Small Shop Management System** is a lightweight, responsive, and resilient management platform tailored for neighborhood stores, retail outlets, and small business owners. It functions seamlessly online and offline, ensuring daily checkout, stock tracking, and accounting operations continue uninterrupted during internet outages.

---

## The Problem

Small retail businesses frequently encounter intermittent network connectivity, power dips, or slow internet in brick-and-mortar environments. Traditional cloud-only billing software freezes during outages, stalling customer queues and losing transactions. Conversely, traditional desktop-only software lacks multi-device syncing, cloud backup, and role-based security. 

This system solves both problems by providing an **offline-first hybrid architecture**: transactions execute instantly against local IndexedDB storage and sync automatically to Google Cloud Firestore whenever network connectivity is available.

---

## Features

- **Inventory & Stock Management**: Real-time stock levels, low-stock warnings, out-of-stock badges, minimum stock alerts, and automated stock history tracking.
- **Point of Sale (POS) & Fast Billing**: Quick-add barcode/SKU code search, quantity selectors, live bill calculator, discount calculations, multiple payment methods (Cash, UPI/Card, Credit/Dues), and instant printable receipts/invoices.
- **Sales & Purchase Management**: Record sales, track supplier purchases, adjust unit costs, and perform safe sale reversals with automatic stock restoration.
- **Customer & Supplier Accounts**: Maintain customer ledgers, credit tracking, outstanding balances, and supplier purchase records.
- **Expense Tracking**: Categorized shop operating expenses (Utilities, Rent, Transport, Maintenance, Salaries, etc.) with date-based records.
- **Profit & Business Reports**: Real-time calculation of Gross Sales, Cost of Goods Sold (COGS), Operating Expenses, Net Estimated Profit, and daily/monthly breakdowns.
- **Role-Based Access Control**:
  - **Owner**: Full access to all modules, staff management, audit logs, data deletion, financial reports, shop settings, and backup/restore.
  - **Staff**: Operational access restricted to POS billing, sales, product viewing, customer entry, and purchases without financial deletion or security override capabilities.
- **Offline-First Resilience**: Transactions are committed locally to browser IndexedDB storage and queued for background synchronization.
- **Bidirectional Cloud Sync**: Automatic Firestore synchronization on network reconnect with idempotency and duplicate prevention.
- **Data Conflict Detection**: Detects remote stock changes and prevents silent overrides.
- **Security & Audit Logs**: Immutable chronological record of logins, sales, purchases, product modifications, and staff actions.
- **Data Backup & Safe Restore**: Owner-controlled sanitized JSON backup export and schema-validated merge restore.
- **Responsive & Installable UI**: Optimized for desktops, tablets, and mobile devices with PWA manifest integration.

---

## Technology Stack

- **Frontend & App Framework**: Next.js (App Router), React, TypeScript
- **Styling**: Vanilla CSS with modern Glassmorphism, CSS Variables, and CSS Grid/Flexbox
- **Authentication**: Firebase Authentication (Email/Password)
- **Cloud Database**: Google Cloud Firestore with granular Security Rules
- **Local Database**: IndexedDB (native browser storage)
- **Deployment**: Vercel-ready with edge routing and optimized production bundling
- **Version Control**: Git & GitHub

---

## Architecture

```text
┌────────────────────────────────────────────────────────┐
│                   User Interface (UI)                  │
│       (Dashboard, POS Billing, Products, Reports)      │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             React Context / State Layer                │
│       (ShopContext, AuthContext, Role Guard)           │
└─────────────┬────────────────────────────┬─────────────┘
              │                            │
              ▼ (Direct read/write)        ▼ (Background replication)
┌──────────────────────────┐    ┌────────────────────────┐
│   Local Browser Storage  │    │       Sync Queue       │
│        (IndexedDB)       │───►│ (Offline Retry Buffer) │
└──────────────────────────┘    └──────────┬─────────────┘
                                           │ (When Online)
                                           ▼
                                ┌────────────────────────┐
                                │ Google Cloud Firestore │
                                │   + Security Rules     │
                                └────────────────────────┘
```

### How Offline-First Operates:
1. **Immediate Execution**: When a sale or purchase is recorded, it is immediately validated and saved into the browser's local **IndexedDB**.
2. **Instant UI Update**: Local React state updates immediately without waiting for server network responses.
3. **Queue & Sync**: A sync task is queued. If online, the transaction is synced to Firestore immediately. If offline, the queue persists locally and triggers automatic synchronization once the browser reconnects.
4. **Duplicate Prevention**: Deterministic transaction IDs (`SALE-...`, `PUR-...`) prevent duplicate document creation in Firestore upon reconnection.

---

## Security

- **Database-Level Authorization**: Cloud Firestore Security Rules validate that unauthenticated or disabled users cannot read or write data.
- **Role Enforcement**: Deletions, settings changes, and audit log inspection are strictly restricted to the `owner` role at the database level.
- **Tamper-Resistant Logs**: The `audit_logs` and `stockHistory` collections are append-only (`allow update, delete: if false`).
- **Account Protection**: Staff members cannot elevate their own permissions or reactivate disabled accounts.
- **Zero Credential Exposure**: Passwords are handled exclusively by Firebase Authentication and never stored in application collections.

---

## Installation & Setup

### Prerequisites
- Node.js (v18.0.0 or later)
- npm or yarn
- A Firebase project with Authentication (Email/Password) and Cloud Firestore enabled.

### Step 1: Clone Repository
```bash
git clone https://github.com/mahathikanneboina-rgb/small-shop-management-system.git
cd small-shop-management-system
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your Firebase web application credentials:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Step 4: Deploy Firestore Rules
Deploy `firestore.rules` using Firebase CLI or copy the rules directly into the Firebase Console:
```bash
firebase deploy --only firestore:rules
```

### Step 5: Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Production Build

To test and generate the optimized production bundle:
```bash
npm run build
npm run start
```

---

## Project Structure

```text
small-shop-management/
├── public/                 # Static assets, icons, manifest.json
├── src/
│   ├── app/                # Next.js App Router pages
│   │   ├── audit-log/      # Immutable security & business audit logs
│   │   ├── billing/        # POS fast billing & invoice generation
│   │   ├── login/          # User authentication sign-in
│   │   ├── products/       # Product catalog & stock adjustment
│   │   ├── purchases/      # Supplier purchase order logging
│   │   ├── register/       # Staff/Owner self-registration
│   │   ├── reports/        # Profit, revenue & financial reports
│   │   ├── sales/          # Sales transaction history & reversal
│   │   ├── settings/       # Store profile, receipt settings, backup/restore
│   │   ├── staff/          # Staff account activation & role assignment
│   │   ├── stock-history/  # Detailed inventory movement trail
│   │   ├── sync-status/    # Real-time online/offline queue monitor
│   │   ├── globals.css     # Global responsive styles & design tokens
│   │   └── layout.tsx      # Root layout with providers & viewport
│   ├── components/         # Reusable UI components (Modals, Tables, Forms)
│   ├── context/            # Global state (AuthContext, ShopContext)
│   ├── lib/                # Firebase client initialization
│   ├── services/           # Business logic (IndexedDB, Sync, Audit, Export)
│   └── types/              # TypeScript interfaces & domain models
├── firestore.rules         # Cloud Firestore security rules
├── .env.example            # Template for environment configuration
└── package.json            # Scripts & project dependencies
```

---

## Future Improvements

The following features represent practical future roadmap items:
- **Physical Barcode Scanner Integration**: Hardware barcode scanner support via USB/Bluetooth HID listener.
- **Thermal Receipt Printer Support**: Direct ESC/POS thermal printing via Web Bluetooth / Web USB.
- **Advanced Tax & GST Filing**: Region-specific GST/VAT breakdown reports and CSV tax exports.
- **Multi-Outlet Support**: Multi-branch stock transfers and consolidated multi-store reporting.
- **Native Mobile Packaging**: Capacitor or React Native wrapper for mobile app stores.
