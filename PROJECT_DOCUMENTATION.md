# Small Shop Management System — Project Documentation

**A comprehensive technical specification, architecture overview, and viva reference guide.**

---

## 1. Project Objective

The **Small Shop Management System** is designed to provide retail shopkeepers, cashier staff, and small business owners with a dependable, offline-first Point of Sale (POS), inventory management, and business accounting web application. The core objective is zero downtime: ensuring that sales and inventory tracking continue smoothly regardless of network availability, while retaining the synchronization and backup benefits of cloud infrastructure.

---

## 2. Problem Statement

Small retail establishments face unique operational hurdles:
1. **Network Instability**: Internet connectivity can drop intermittently, halting traditional cloud-only POS systems and causing long checkout delays.
2. **Data Fragmentation**: Many small shops rely on paper ledgers or standalone single-PC spreadsheets that lack automated backups, audit trails, and multi-device access.
3. **Inventory Leakage**: Without real-time stock deductions and low-stock alerts, retailers experience out-of-stock lost sales or unaccounted stock shrinkage.
4. **Security Vulnerabilities**: Lack of role separation allows unauthorized changes to historical sales, prices, or account statuses.

---

## 3. Target Users & Personas

- **Shop Owner / Administrator**:
  - Sets up store details, tax rates, and receipt formatting.
  - Manages employee access (adding staff, changing roles, disabling accounts).
  - Inspects profit & loss reports, expense summaries, and the immutable security audit log.
  - Exports data backups and performs data restores.
- **Cashier / Staff Member**:
  - Processes fast customer checkouts at the billing counter.
  - Logs supplier purchases and creates customer accounts.
  - Views product stock levels and generates customer invoices.
  - Restricted from deleting transactions, altering settings, or viewing sensitive financial profit summaries.

---

## 4. Main Modules

| Module | Description | Primary User |
| :--- | :--- | :--- |
| **Dashboard** | High-level business overview: today's sales, revenue, low-stock warnings, and recent activity. | Owner / Staff |
| **Products & Inventory** | Add, edit, adjust stock, and set minimum stock alerts and product SKU/codes. | Owner / Staff |
| **Stock Movement History** | Chronological log of all stock increases, sales deductions, purchases, and corrections. | Owner / Staff |
| **Point of Sale (POS) Billing** | High-speed billing screen with barcode/code lookup, live totals, multiple payment modes, and printable receipts. | Owner / Staff |
| **Sales Management** | Historical sales log, invoice viewing, customer credit sales, and sale reversal/cancellation. | Owner / Staff |
| **Purchases** | Supplier purchase orders, cost recording, and automatic inventory incrementation. | Owner / Staff |
| **Customers & Ledger** | Customer contact management, total spend tracking, and outstanding credit balances. | Owner / Staff |
| **Suppliers** | Vendor directory with contact numbers and cumulative purchase tracking. | Owner / Staff |
| **Expense Tracker** | Categorized operational expense logging (Rent, Electricity, Salaries, Transport, etc.). | Owner / Staff |
| **Financial Reports** | Revenue, Cost of Goods Sold (COGS), Operating Expenses, and Net Profit calculations over daily/monthly ranges. | Owner |
| **Staff Management** | Staff activation, deactivation, and role assignment. | Owner |
| **Audit Log** | Immutable log recording all critical events (logins, sales, reversals, staff changes, backups). | Owner |
| **Sync Status** | Real-time connection monitor showing pending offline changes and retry controls. | Owner / Staff |
| **Settings & Backup** | Store details, receipt formatting, and JSON backup export/restore. | Owner |

---

## 5. Technology Stack & Rationale

- **Next.js (App Router)**: Provides modern React architecture, fast static pre-rendering, and seamless routing.
- **TypeScript**: Enforces strict type safety across transactions, products, stock movements, and audit records.
- **Vanilla CSS (Glassmorphic Theme)**: Lightweight, modular styling without heavy external CSS runtime overhead, maintaining fast initial load times.
- **IndexedDB**: Standard in-browser transactional database used as the primary, immediate persistence layer.
- **Firebase Authentication**: Industry-standard secure identity management for email/password credentials.
- **Google Cloud Firestore**: Scalable NoSQL cloud database providing multi-device synchronization and declarative security rules.

---

## 6. Architecture & System Flow

```text
  [ User Browser / PWA Client ]
               │
               ▼
      [ React Components ]
               │
               ▼
     [ Context / Services ]
       ├── AuthContext (User Session & Role)
       └── ShopContext (State & Operations)
               │
        ┌──────┴──────────────────────────┐
        ▼ (Synchronous / Instant)         ▼ (Asynchronous)
  [ IndexedDB Storage ]            [ Sync Queue Service ]
   - Products                       - Pending Queue
   - Transactions                   - Retry Logic
   - Audit Logs                     - Reconnection Hook
                                          │
                                          ▼ (When Online)
                             [ Cloud Firestore Database ]
                              - Rules Authorization
                              - Centralized Storage
```

---

## 7. Database Design & Entity Models

### Products (`Product`)
- `id` (string, UUID)
- `name` (string)
- `code` (string, unique barcode/SKU)
- `category` (string: Groceries, Beverages, Snacks, etc.)
- `costPrice` (number)
- `sellingPrice` (number)
- `quantity` (number)
- `minStock` (number)
- `unit` (string: pcs, kg, ltr, etc.)
- `createdAt` / `updatedAt` (ISO 8601 strings)

### Sales (`Sale`)
- `id` (string, e.g. `SALE-1710000000000-XYZ`)
- `items` (Array of items: `productId`, `name`, `quantity`, `unitPrice`, `totalPrice`, `costPrice`)
- `subtotal` (number)
- `discount` (number)
- `tax` (number)
- `totalAmount` (number)
- `paymentMethod` (`Cash` | `Card` | `UPI` | `Credit` | `Split`)
- `customerId` / `customerName` (optional string)
- `status` (`Completed` | `Cancelled`)
- `createdBy` / `creatorName` (string)
- `createdAt` (ISO 8601 string)

### Stock History (`StockHistoryItem`)
- `id` (string)
- `productId` (string)
- `productName` (string)
- `changeQuantity` (number, + or -)
- `quantityBefore` (number)
- `quantityAfter` (number)
- `reason` (`Initial Stock` | `Stock Correction` | `Sale` | `Sale Reversal` | `Purchase`)
- `timestamp` (ISO 8601 string)
- `performedBy` (string)

### Purchases (`Purchase`)
- `id` (string, e.g. `PUR-...`)
- `productId` (string)
- `productName` (string)
- `supplierId` / `supplierName` (string)
- `quantity` (number)
- `costPrice` (number)
- `totalCost` (number)
- `createdAt` (ISO 8601 string)
- `createdBy` (string)

### Expenses (`Expense`)
- `id` (string)
- `category` (`Utilities` | `Rent` | `Salaries` | `Supplies` | `Maintenance` | `Other`)
- `amount` (number)
- `description` (string)
- `date` (string)
- `createdBy` (string)

### Audit Logs (`AuditLog`)
- `id` (string)
- `timestamp` (string)
- `userId` / `userName` / `userEmail` (string)
- `action` (string: `SALE_CREATED`, `SALE_CANCELLED`, `PURCHASE_CREATED`, `STAFF_DISABLED`, etc.)
- `entityType` (string)
- `entityId` (string)
- `description` (string)

---

## 8. Offline-First & Synchronization Mechanics

1. **Local-First Writes**:
   - Every operation (creating a sale, logging a purchase, adjusting stock) commits immediately to **IndexedDB**.
   - React state is updated synchronously so the UI responds in 0ms without waiting for network transport.
2. **Sync Queue Persistence**:
   - Each mutation enqueues a sync task in the `syncQueue` object store with operation type, collection name, document ID, payload, and retry count.
3. **Reconnection & Drain**:
   - The application listens to browser `online` events.
   - When online, `syncService.processQueue()` processes pending items in FIFO order, writing directly to Firestore using deterministic document IDs.
4. **Conflict Handling**:
   - Before applying updates, records check modification timestamps.
   - If a concurrent remote update exists, the system flags the conflict and records a `STOCK_CONFLICT_DETECTED` audit event rather than silently corrupting data.

---

## 9. Security & Access Control

1. **Authentication**:
   - Handled via Firebase Auth. Credentials and tokens are securely managed by the client SDK.
2. **Authorization & RBAC**:
   - `RoleGuard` component protects administrative routes (`/staff`, `/audit-log`, `/reports`, `/settings`).
   - `firestore.rules` enforces authorization at the database layer. Even if client-side code is manipulated, unauthorized Firestore calls are rejected.
3. **Disabled User Lockout**:
   - If an owner disables a staff account (`status: 'disabled'`), security rules immediately reject any subsequent read/write requests from that UID.
4. **Tamper Prevention**:
   - `stockHistory` and `audit_logs` collections have `allow update, delete: if false` in security rules, creating an immutable audit trail.

---

## 10. Business Logic & Mathematical Formulas

- **Sale Total**:
  $$\text{Total Amount} = \sum (\text{item.quantity} \times \text{item.unitPrice}) - \text{Discount} + \text{Tax}$$
- **Stock Movement**:
  - **Sale**: $\text{Stock}_{\text{new}} = \text{Stock}_{\text{current}} - \text{Quantity Sold}$
  - **Purchase**: $\text{Stock}_{\text{new}} = \text{Stock}_{\text{current}} + \text{Quantity Purchased}$
  - **Sale Reversal**: $\text{Stock}_{\text{new}} = \text{Stock}_{\text{current}} + \text{Quantity Returned}$
- **Cost of Goods Sold (COGS)**:
  $$\text{COGS} = \sum_{\text{completed sales}} (\text{item.quantity} \times \text{item.costPrice})$$
- **Estimated Net Profit**:
  $$\text{Net Profit} = \text{Total Sales Revenue} - \text{COGS} - \text{Total Operating Expenses}$$

---

## 11. Testing & Quality Assurance

- **Static Type Checking**: Full TypeScript compilation with strict null checks.
- **Production Build**: Verified with Next.js Turbopack compiler (`npm run build` completed with 0 errors).
- **Route Validation**: All 17 application routes pre-rendered statically.
- **Functional Validation**: Verified sale creation, stock deduction, sale reversal, credit transactions, customer balance tracking, expense calculation, and JSON backup export/restore.

---

## 12. Limitations & Future Scope

### Current Limitations:
- Single-store tenancy per database configuration.
- Standard web browser printing used for receipts rather than native thermal ESC/POS hardware drivers.

### Future Roadmap:
- Multi-branch inventory transfer and centralized reporting.
- Native mobile packaging (Capacitor/React Native).
- Hardware barcode scanner integration via WebHID / Web Bluetooth.
- Regional tax compliance reports (GST/VAT).
