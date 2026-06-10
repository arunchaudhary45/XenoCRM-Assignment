# 🚀 XCRM - AI-Native Mini CRM & Outreach Orchestrator

XCRM is a robust, full-stack, AI-native Customer Relationship Management (CRM) platform designed for Direct-to-Consumer (DTC) and retail brands to intelligently reach their shoppers. The application organizes customer profiles and purchase history, evaluates custom segments using natural language AI, drafts copy via a Gemini copywriter, and executes multi-channel marketing campaigns (WhatsApp, SMS, Email, and RCS) through an asynchronous callback simulator with built-in rate-limiting and manual delivery retry controls.

---

## 🏗️ Architecture & Component Layout

The monorepo is divided into three key services:

1. **[CRM Backend (Express API)](file:///c:/Users/arunc/OneDrive/Desktop/XCRM/backend)**:
   * Handles customer profiles, purchase orders, segment evaluation, and campaigns.
   * Integrates the **Google Gemini SDK** (with pattern-based heuristics fallbacks) and a rate-limited message dispatch queue.
2. **[Channel Service Simulator](file:///c:/Users/arunc/OneDrive/Desktop/XCRM/channel-service)**:
   * Acts as an asynchronous messaging gateway.
   * Simulates message delivery, open, and click events via timed callback webhooks to the CRM.
3. **[React Frontend (Vite + React)](file:///c:/Users/arunc/OneDrive/Desktop/XCRM/frontend)**:
   * A premium, light-themed glassmorphic user dashboard.
   * Displays statistics, live tracking status charts, audience builder, and campaigns.

---

## 🌟 Key Features

* **🎛️ Dual Audience Builder**:
  * Create audiences by stacking logical rules (e.g., total spend, city matches).
  * Build segments using natural language prompts (e.g., *"Customers in Delhi who spent more than 5000"*) translated to database query filters by Gemini AI.
* **📣 Campaign Orchestration & AI Copywriter**:
  * Design multi-channel campaigns (WhatsApp, SMS, Email, RCS).
  * Automatically draft copy using Gemini, incorporating dynamic text replacement variables like `{{name}}`.
* **📊 Live Analytics Dashboard**:
  * Monitor delivery stats in real-time (Sent, Delivered, Read, Opened, Clicked).
  * Built-in client-side polling visually showcases webhook logs progressing live.
* **🔄 Rate-Limiting & Manual Retry**:
  * Messages are dispatched through an asynchronous worker at a safe rate-limit of 20 messages per second (50ms interval).
  * Any failed communications present a **Retry** option to re-enqueue and salvage failed deliveries.
* **💾 Resilient Database Configuration**:
  * Integrates **MongoDB** (via Mongoose schemas) with a local JSON file-based database fallback (`mock_db.json`) if credentials are left blank.

---

## 🛠️ Environment Variables Configuration

Both the **Backend** and **Channel Service** read configurations from local `.env` files. 

### Backend Environment Configuration
Create a **`backend/.env`** file:
```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/xenocrm?retryWrites=true&w=majority
GEMINI_API_KEY=your_gemini_api_key_here
CHANNEL_SERVICE_URL=http://localhost:6000
```
* *Note: If `MONGO_URI` is empty, the server automatically reads/writes data locally to `backend/mock_db.json`. If `GEMINI_API_KEY` is empty, it uses pattern-matching fallbacks.*

### Channel Service Environment Configuration
Create a **`channel-service/.env`** file:
```env
PORT=6000
CRM_CALLBACK_URL=http://localhost:5000/api/campaigns/webhook
```

---

## 🚀 Installation & Running the Application

Ensure you have **Node.js (v18+)** installed.

### 1. Install Dependencies
Run from the repository root directory:
```bash
npm run install:all
```

### 2. Run All Services Concurrently
You can launch the Backend, Simulator, and React client concurrently in one single terminal window:
```bash
npm run start:all
```
Once initialized, navigate to:
👉 **[http://localhost:5173](http://localhost:5173)**

---

## 🧪 Automated Integration Testing

An automated Python script is provided to validate the entire backend and simulator queue callback flow:
```bash
python test_flow.py
```
This script runs services on isolated ports (`5050` and `6060`), seeds mock data, evaluates segments, parses AI queries, triggers a campaign launch, polls the callback webhook status progression, tests the manual retry endpoint, and shuts down cleanly.
