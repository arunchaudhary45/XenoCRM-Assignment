# 🌐 XCRM Deployment Guide

This guide explains how to deploy the XCRM monorepo applications to production cloud platforms. We will deploy the services as follows:
1. **Channel Service Simulator** ➔ **Render** (Web Service)
2. **CRM Backend API** ➔ **Render** (Web Service)
3. **React Frontend App** ➔ **Vercel** (Static Web App)

---

## 📋 Prerequisites
Before you start, make sure you have:
* A **GitHub account** with your code pushed to a repository (e.g., `https://github.com/arunchaudhary45/XenoCRM-Assignment`).
* A **MongoDB Atlas account** with a cluster running, database created, and a database user configured.
* A **Google AI Studio API Key** (optional, for Gemini AI features).
* Accounts on **Render** (render.com) and **Vercel** (vercel.com).

---

## 1. 📡 Step 1: Deploy the Channel Service Simulator (Render)

The Channel Simulator mocks email, SMS, and WhatsApp dispatch channels. We deploy it first to obtain its live URL.

1. Log in to [Render](https://dashboard.render.com/) and click **New** ➔ **Web Service**.
2. Connect your GitHub repository.
3. Configure the following settings:
   * **Name**: `xcrm-channel-simulator`
   * **Language**: `Node`
   * **Root Directory**: `channel-service`
   * **Build Command**: `npm install`
   * **Start Command**: `node server.js`
   * **Instance Type**: `Free`
4. Click **Deploy Web Service**.
5. Once deployment is complete, copy your Web Service URL (e.g., `https://xcrm-channel-simulator.onrender.com`). Let's refer to this as **`LIVE_SIMULATOR_URL`**.

---

## 2. 🚀 Step 2: Deploy the CRM Backend (Render)

Now we deploy the core Express API which handles customer ingestion, audience logic, campaigns, and callbacks.

1. On your Render dashboard, click **New** ➔ **Web Service**.
2. Connect the same GitHub repository.
3. Configure the following settings:
   * **Name**: `xcrm-backend`
   * **Language**: `Node`
   * **Root Directory**: `backend`
   * **Build Command**: `npm install`
   * **Start Command**: `node server.js`
   * **Instance Type**: `Free`
4. Expand the **Advanced** section and click **Add Environment Variable**. Add the following variables:
   
   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `MONGO_URI` | `mongodb+srv://username:password@cluster.mongodb.net/xcrm?retryWrites=true&w=majority` | Your MongoDB Atlas connection URI. *Make sure special characters in the password (like `@` or `#`) are URL-encoded! (e.g., `@` ➔ `%40`)* |
   | `CHANNEL_SERVICE_URL` | `LIVE_SIMULATOR_URL` | The live URL of the Channel Simulator deployed in Step 1 (e.g., `https://xcrm-channel-simulator.onrender.com`). |
   | `CRM_BACKEND_URL` | *Leave empty during first deploy, or update after deploy* | The live URL of this backend service itself. Read below. |
   | `GEMINI_API_KEY` | `your_gemini_api_key_here` | (Optional) Your Google Gemini API Key. If left empty, the CRM falls back to local heuristic engines automatically. |

5. Click **Deploy Web Service**.
6. Once deployed, Render will generate a URL for your backend (e.g., `https://xcrm-backend.onrender.com`). Let's refer to this as **`LIVE_BACKEND_URL`**.
7. Go to your backend's **Environment** tab on Render, add a new environment variable `CRM_BACKEND_URL` set to `LIVE_BACKEND_URL` (e.g., `CRM_BACKEND_URL=https://xcrm-backend.onrender.com`), and save changes to trigger a redeploy. This ensures the simulator callbacks are correctly routed to the production backend URL!

---

## 3. 🎨 Step 3: Deploy the React Frontend (Vercel)

Vercel is the optimal choice for hosting React/Vite single-page applications.

1. Log in to [Vercel](https://vercel.com/) and click **Add New** ➔ **Project**.
2. Import your GitHub repository.
3. Configure the project settings:
   * **Framework Preset**: `Vite` (Vercel detects this automatically).
   * **Root Directory**: Click *Edit* and select the `frontend` folder.
   * **Build and Output Settings**: (Leave defaults: Build Command `npm run build`, Output Directory `dist`).
4. Expand the **Environment Variables** section and add:
   * **Key**: `VITE_API_BASE`
   * **Value**: `LIVE_BACKEND_URL/api` (e.g., `https://xcrm-backend.onrender.com/api`)
5. Click **Deploy**.
6. Once compilation finishes, Vercel will provide your production URL (e.g., `https://xeno-crm-assignment.vercel.app`).

---

## 🧪 Step 4: Verification and Testing in Production

1. Visit your live Frontend URL in your browser.
2. Click the **🧪 Seed Demo Data** button in the top right. Verify that:
   * The toast notification shows `"Seeding demo data..."` and then success.
   * The Customer Directory and Purchase Orders tables are populated with test data.
   * The AI Analytics card displays insights.
3. Go to the **Audience Builder** tab, write a query (e.g., *"spenders who spent more than 5000"*), and click **Check Segment Count**. Ensure it returns matching customers.
4. Go to the **Campaigns** tab:
   * Enter a campaign name.
   * Write or generate a message using AI.
   * Click **Launch Campaign**.
5. Go back to the **Dashboard** and watch the delivery status counters (`Delivered`, `Read`, `Opened`, `Clicked`) increment dynamically in real-time as the simulated webhooks execute.
6. If any message fails, try clicking the 🔄 **Retry** button inside the performance table to ensure re-queueing works perfectly.

---

## 💡 Troubleshooting & Production Tips

* **MongoDB Atlas IP Access List**: Ensure that your MongoDB Atlas cluster allows connections from anywhere (`0.0.0.0/0`) since Render's free tier services do not have static IP addresses. You can configure this in Atlas under **Network Access** ➔ **IP Access List**.
* **CORS Restrictions**: The Express backend has CORS enabled globally (`app.use(cors())`), meaning it will accept requests from any origin. For a strict production setup, you could specify your Vercel domain in the CORS settings.
* **Cold Starts**: Render's Free tier services spin down after 15 minutes of inactivity. When visiting the app for the first time in a while, the first request might take 30-50 seconds to respond as the backend and simulator wake up.
