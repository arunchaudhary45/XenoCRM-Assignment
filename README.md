# 🚀 XCRM - AI-Native Mini CRM & Outreach Orchestrator

XCRM is a full-stack, AI-native Customer Relationship Management (CRM) application and multi-channel campaign manager built as a take-home engineering project for Xeno. It allows Direct-to-Consumer (DTC) and retail brands to ingest customer data, define specific target audiences using rule engines or Google Gemini natural language translation, compose personalized marketing templates, and track delivery analytics in real-time.

---

## 📸 Dashboard Preview & Visual Identity
The application implements a premium, modern, light-themed glassmorphism interface. 
* **Typography**: Beautifully rendered using the modern `Outfit` font from Google Fonts.
* **Color System**: Soft slate-white background grid matched with rich, professional crimson-red (`#dc2626`) accent highlights.
* **Layout Responsiveness**: Standard desktop side-nav collapses into a flexible horizontal navigation bar on mobile/tablet viewports (screen widths `<= 992px`) to maximize data workspace area.

---

## 🛠️ Technology Stack
The application is built using a modern, lightweight, and scalable full-stack ecosystem:

* **Frontend Client**:
  * **React.js (v19)**: Main interface component library.
  * **Vite**: High-performance dev server and compiler with Hot Module Replacement (HMR).
  * **Axios**: HTTP client for requesting data from CRM server endpoints.
  * **Vanilla CSS**: Premium light-themed layouts built using custom CSS tokens, modern glassmorphic card overlays, responsive flex/grid wrappers, and live statistics charts.
* **CRM Backend**:
  * **Node.js**: Javascript server-side runtime environment.
  * **Express.js (v4)**: REST API server gateway managing router endpoints and CORS policies.
  * **Google Generative AI SDK (`@google/generative-ai`)**: Integrating Google Gemini-1.5-Flash models for Natural Language query translation, copywriting drafts, and analytics.
* **Database Layer**:
  * **MongoDB Atlas & Mongoose (ODM)**: Standard schema modeling and data persistence.
  * **Local JSON DB Fallback**: A custom-built query evaluator mapping MongoDB filters (`$gt`, `$lt`, `$in`, `$regex`) directly to local file storage.
* **Tooling & Orchestration**:
  * **Concurrently**: Manages multiple server processes in a single terminal tab.
  * **Nodemon**: Automatically restarts Node servers on file changes.
  * **Python Subprocesses**: Runs integration flow telemetry validation tests (`test_flow.py`).

---

## 🏗️ Core Architecture Overview

XCRM is designed as a modular monorepo containing three core services:

```mermaid
graph TD
    A[React Client - Port 5173] -->|API Requests| B[CRM Backend Server - Port 5000]
    B -->|Asynchronous Queue| C[Channel Simulator - Port 6000]
    C -->|Simulated Delayed Webhooks| B
    B <-->|Mongoose / JSON Fallback| D[(Database Storage)]
```

1. **[React Frontend App (Vite)](file:///c:/Users/arunc/OneDrive/Desktop/XCRM/frontend)**: A single-page client application featuring live delivery statistics dashboards, an interactive rule configuration panel, and campaign drafts helpers.
2. **[CRM Backend (Express.js)](file:///c:/Users/arunc/OneDrive/Desktop/XCRM/backend)**: The orchestrator server that controls business logic, manages the database, enqueues dispatches, and handles webhook callback state adjustments.
3. **[Channel Service Simulator](file:///c:/Users/arunc/OneDrive/Desktop/XCRM/channel-service)**: A mockup microservice simulating email, SMS, and WhatsApp sending gateways, triggering delayed lifecycle events to verify end-to-end integration.

---

## 💾 Database Architecture & Data Schemas

The database layer in **[db.js](file:///c:/Users/arunc/OneDrive/Desktop/XCRM/backend/db.js)** handles schemas using **Mongoose** (for MongoDB) but features an automatic fallback to a local **[mock_db.json](file:///c:/Users/arunc/OneDrive/Desktop/XCRM/backend/mock_db.json)** file system. The database is organized into four main data collections:

### 1. Customer Schema (`Customer`)
Stores unique shopper profiles, metadata, and cumulative metrics:
* `name` (String): Shopper's full name.
* `email` (String): Unique email address.
* `phone` (String): Phone number (used for SMS/WhatsApp).
* `city` (String): City location (e.g., Delhi, Mumbai).
* `totalSpend` (Number): Aggregated spend across all orders (defaults to `0`).
* `createdAt` (Date): Creation timestamp.

### 2. Order Schema (`Order`)
Tracks historical order logs linked to customer records:
* `customerId` (ObjectId): Reference to the associated `Customer`.
* `amount` (Number): Transaction amount (INR).
* `category` (String): Item category (e.g., Clothing, Electronics, Books).
* `date` (Date): Purchase timestamp.

### 3. Campaign Schema (`Campaign`)
Stores metadata and aggregated telemetry of marketing efforts:
* `name` (String): Identifier name (e.g., Summer Flash Sale).
* `segmentFilter` (Object): The query conditions applied to select customers.
* `segmentQueryText` (String): Human-readable search query text (e.g., *"spent more than 5000"*).
* `message` (String): Campaign template body text (supporting name interpolation via `{{name}}`).
* `channel` (String): Target channel (`SMS`, `Email`, `WhatsApp`, `RCS`).
* `status` (String): Campaign lifecycle status (`Pending` or `Sent`).
* `stats` (Object): Aggregated counters:
  * `sent` (Number): Target count.
  * `delivered` (Number): Successful delivery confirmations.
  * `read` (Number): Read confirmations.
  * `opened` (Number): Open confirmations.
  * `clicked` (Number): Link click/conversion count.
  * `failed` (Number): Network or simulator transmission errors.

### 4. Communication Log Schema (`CommunicationLog`)
Holds the detailed transactional log of each individual message dispatch:
* `campaignId` (ObjectId): Links to the parent `Campaign`.
* `customerId` (ObjectId): Links to the recipient `Customer`.
* `recipient` (String): Phone or email address.
* `message` (String): Interpolated, personalized message body text.
* `status` (String): Individual message state (`Sent`, `Delivered`, `Read`, `Opened`, `Clicked`, `Failed`).
* `logs` (Array): Chronological timestamped event history.

---

## 🧙‍♂️ Google Gemini AI Integrations

The AI engine in **[ai.js](file:///c:/Users/arunc/OneDrive/Desktop/XCRM/backend/ai.js)** leverages the `@google/generative-ai` SDK to enable smart features. It falls back to robust heuristic logic if no `GEMINI_API_KEY` is provided:

1. **Natural Language Query Parsing (`parseSegmentQuery`)**:
   * Accepts natural language requests (e.g., *"spenders in Mumbai who bought items less than 2000"*) and asks Gemini to output raw, valid MongoDB query JSON.
   * *Fallback*: If Gemini is offline, a regex parser matches keywords like "spend", "Delhi", "Mumbai" to construct query filters.
2. **AI Copywriter & Copy Generation (`generateCampaignMessage`)**:
   * Analyzes themes (e.g., *"20% off winter coats"*) and channels to generate subject lines, CTA text, and copy templates utilizing the `{{name}}` placeholder.
3. **Smart Dashboard Insights (`generateDashboardInsights`)**:
   * Reads metrics from past campaigns and suggests insights (e.g., *"WhatsApp campaigns have a 24% higher click conversion rate"*) along with actionable target recommendations.

---

## 🚦 Campaign Dispatch Queue & Webhooks

To handle heavy messaging scale without crashing or hitting channel limits, XCRM implements a production-ready **asynchronous worker queue**:

### 1. The Rate-Limited Queue Worker
* When a campaign launches, it resolves the segment to fetch matching customer records.
* It wraps each message inside a task, pushes it into `dispatchQueue`, and starts processing.
* To avoid trigger blockages, a timer waits **50 milliseconds** between dispatches, rate-limiting outbound traffic to 20 messages/second.

### 2. Timed Webhook Simulator Callbacks
* Outbound messages are posted to the **Channel Service Simulator**.
* The simulator responds immediately with a `Queued` status, then kicks off a randomized asynchronous callback progression:
  1. **Transmitting**: 90% chance of successful `Delivered` webhook, 10% chance of `Failed` webhook.
  2. **Reading**: 80% chance of progressing to `Read` status after delivery.
  3. **Opening**: 60% chance of progressing to `Opened` status.
  4. **Clicking**: 30% chance of progressing to `Clicked` (Successful Conversion).
* If the simulator is shut down or fails, the CRM worker automatically registers the log status as `Failed`.

### 3. Smart Manual Retry Trigger
* Any message marked as `Failed` displays a **Retry** button in the campaign table.
* Clicking it invokes `POST /api/campaigns/:id/retry-failed`, which decrements the failed counter, shifts the logs back to `Sent`, and re-enqueues them through the rate-limiter.

---

## ⚙️ Configuration & Environment Variables

Make sure the configurations are populated in your local `.env` files.

### Backend Config (`backend/.env`)
Create **`backend/.env`**:
```env
PORT=5000
MONGO_URI=mongodb+srv://username:%23Password_18@cluster.mongodb.net/xenocrm?retryWrites=true&w=majority
GEMINI_API_KEY=
CHANNEL_SERVICE_URL=http://localhost:6000
```
> [!IMPORTANT]
> If your MongoDB Atlas password contains special characters (like `@`, `#`, `/`), they **must be URL-encoded** (e.g., `@` becomes `%40`, `#` becomes `%23`) to prevent Mongoose URI parsing crashes.
> If `GEMINI_API_KEY` is left blank, the system automatically uses mock heuristics.

### Channel Service Config (`channel-service/.env`)
Create **`channel-service/.env`**:
```env
PORT=6000
CRM_CALLBACK_URL=http://localhost:5000/api/campaigns/webhook
```

---

## 🚀 Step-by-Step Running Guide

### 1. Install Workspace Packages
Install dependencies across backend, simulator, and frontend packages simultaneously:
```bash
npm run install:all
```

### 2. Boot Up All Servers Concurrently
Start the Express API, the Channel Simulator, and the Vite React server concurrently:
```bash
npm run start:all
```
Once initialized, navigate to:
👉 **[http://localhost:5173/](http://localhost:5173/)**

---

## 🧪 Automated Integration Verification

You can run the automated script **[test_flow.py](file:///c:/Users/arunc/OneDrive/Desktop/XCRM/test_flow.py)** to execute isolated, end-to-end integration tests:
```bash
python test_flow.py
```

### Test Pipeline Checklist:
- [x] Launches mock instances of the CRM and Channel services on isolated ports (`5050` and `6060`).
- [x] Seeds the database with test profiles and purchase orders.
- [x] Evaluates target rules and translates a natural language segment.
- [x] Generates campaign copies and enqueues individual dispatches.
- [x] Simulates delayed webhook updates (`Delivered` ➔ `Read` ➔ `Opened` ➔ `Clicked`).
- [x] Triggers the campaign retry endpoint on failed dispatches.
- [x] Shuts down child server processes cleanly.
