import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { Customer, Order, Campaign, CommunicationLog } from './db.js';
import { parseSegmentQuery, generateCampaignMessage, generateDashboardInsights } from './ai.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CHANNEL_SERVICE_URL = process.env.CHANNEL_SERVICE_URL || 'http://localhost:6000';
const CRM_BACKEND_URL = process.env.CRM_BACKEND_URL || `http://localhost:${PORT}`;

app.use(cors());
app.use(express.json());

// Log requests
app.use((req, res, next) => {
  console.log(`[CRM Backend] ${req.method} ${req.path}`);
  next();
});

// -------------------------------------------------------------
// CUSTOMER & ORDER APIS
// -------------------------------------------------------------

// Get all customers
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await Customer.find({});
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create customer
app.post('/api/customers', async (req, res) => {
  try {
    const { name, email, phone, city } = req.body;
    if (!name || !email || !phone || !city) {
      return res.status(400).json({ error: "Missing required customer fields." });
    }
    const newCustomer = await Customer.create({ name, email, phone, city, totalSpend: 0 });
    res.status(201).json(newCustomer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all orders
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find({}).populate('customerId');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create order
app.post('/api/orders', async (req, res) => {
  try {
    const { customerId, amount, category } = req.body;
    if (!customerId || !amount || !category) {
      return res.status(400).json({ error: "Missing required order fields." });
    }

    // Find customer to make sure they exist
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found." });
    }

    const orderAmount = parseFloat(amount);
    const newOrder = await Order.create({
      customerId,
      amount: orderAmount,
      category,
      date: new Date()
    });

    // Update customer's total spend
    await Customer.updateOne(
      { _id: customerId },
      { $inc: { totalSpend: orderAmount } }
    );

    res.status(201).json(newOrder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seed demo data route
app.post('/api/customers/seed', async (req, res) => {
  try {
    // Clear existing collections if using mongoose, or just rewrite if using MockModel
    // For our MockModel, we can just clear them by creating a reset function or deleting all items.
    // In our MockModel, we don't have a direct delete, but we can write one or just add new records.
    // Let's check: we want to seed 10-15 customers and 20 orders.
    // Let's check if they already have seeded data. If customers count > 0, we can skip or add.
    const count = await Customer.countDocuments({});
    if (count > 5) {
      return res.json({ message: "Database already has sufficient seeded data.", count });
    }

    const seedCustomers = [
      { name: "Aarav Sharma", email: "aarav@gmail.com", phone: "+919876543210", city: "Delhi" },
      { name: "Ananya Iyer", email: "ananya@gmail.com", phone: "+919876543211", city: "Mumbai" },
      { name: "Kabir Mehta", email: "kabir@gmail.com", phone: "+919876543212", city: "Bangalore" },
      { name: "Diya Joshi", email: "diya@gmail.com", phone: "+919876543213", city: "Delhi" },
      { name: "Vihaan Gupta", email: "vihaan@gmail.com", phone: "+919876543214", city: "Pune" },
      { name: "Riya Sen", email: "riya@gmail.com", phone: "+919876543215", city: "Kolkata" },
      { name: "Arjun Reddy", email: "arjun@gmail.com", phone: "+919876543216", city: "Hyderabad" },
      { name: "Ishaan Nair", email: "ishaan@gmail.com", phone: "+919876543217", city: "Chennai" },
      { name: "Meera Patel", email: "meera@gmail.com", phone: "+919876543218", city: "Mumbai" },
      { name: "Sai Kulkarni", email: "sai@gmail.com", phone: "+919876543219", city: "Pune" }
    ];

    const createdCustomers = [];
    for (const c of seedCustomers) {
      // Check if email already exists
      const existing = await Customer.findOne({ email: c.email });
      if (!existing) {
        const nc = await Customer.create({ ...c, totalSpend: 0 });
        createdCustomers.push(nc);
      } else {
        createdCustomers.push(existing);
      }
    }

    const categories = ["Clothing", "Electronics", "Books", "Home Decor", "Footwear"];

    // Seed orders
    const seedOrders = [
      { custIdx: 0, amount: 6500, category: "Electronics" }, // Aarav spent 6500 in Delhi
      { custIdx: 0, amount: 1500, category: "Clothing" },    // Aarav spent 1500 in Delhi (Total 8000)
      { custIdx: 1, amount: 8000, category: "Clothing" },    // Ananya spent 8000 in Mumbai
      { custIdx: 2, amount: 3500, category: "Books" },       // Kabir spent 3500 in Bangalore
      { custIdx: 3, amount: 1200, category: "Home Decor" },  // Diya spent 1200 in Delhi
      { custIdx: 4, amount: 4800, category: "Footwear" },    // Vihaan spent 4800 in Pune
      { custIdx: 4, amount: 2200, category: "Clothing" },    // Vihaan spent 2200 in Pune (Total 7000)
      { custIdx: 5, amount: 950, category: "Books" },       // Riya spent 950 in Kolkata
      { custIdx: 6, amount: 12000, category: "Electronics" }, // Arjun spent 12000 in Hyderabad
      { custIdx: 7, amount: 3000, category: "Clothing" },    // Ishaan spent 3000 in Chennai
      { custIdx: 8, amount: 5500, category: "Home Decor" },  // Meera spent 5500 in Mumbai
      { custIdx: 9, amount: 200, category: "Footwear" }     // Sai spent 200 in Pune
    ];

    for (const o of seedOrders) {
      const customer = createdCustomers[o.custIdx];
      await Order.create({
        customerId: customer._id,
        amount: o.amount,
        category: o.category,
        date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Random date in last 30 days
      });
      // Increment customer spend
      await Customer.updateOne(
        { _id: customer._id },
        { $inc: { totalSpend: o.amount } }
      );
    }

    res.json({ message: "Successfully seeded demo data.", customersAdded: createdCustomers.length, ordersAdded: seedOrders.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// SEGMENTATION & AI APIS
// -------------------------------------------------------------

// Evaluate segment filter and return count & matching customers
app.post('/api/segments/evaluate', async (req, res) => {
  try {
    const { filter } = req.body;
    if (!filter) {
      return res.status(400).json({ error: "Missing filter query object." });
    }
    const count = await Customer.countDocuments(filter);
    const customers = await Customer.find(filter);
    res.json({ count, customers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Segment Builder: translate NL description to Mongo Query
app.post('/api/ai/segment', async (req, res) => {
  try {
    const { queryText } = req.body;
    if (!queryText) {
      return res.status(400).json({ error: "Missing query text description." });
    }
    const filter = await parseSegmentQuery(queryText);
    res.json({ filter });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Campaign Copy Creator
app.post('/api/ai/generate-message', async (req, res) => {
  try {
    const { theme, channel } = req.body;
    if (!theme || !channel) {
      return res.status(400).json({ error: "Missing theme or channel description." });
    }
    const messageDetails = await generateCampaignMessage(theme, channel);
    res.json(messageDetails);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Insights for Dashboard
app.get('/api/ai/insights', async (req, res) => {
  try {
    const campaigns = await Campaign.find({});
    // Extract key stats of past campaigns
    const campaignsData = campaigns.map(c => ({
      name: c.name,
      channel: c.channel,
      stats: c.stats
    }));
    const insights = await generateDashboardInsights(campaignsData);
    res.json(insights);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// CAMPAIGN & WEBHOOK APIS
// -------------------------------------------------------------

// Create campaign
app.post('/api/campaigns', async (req, res) => {
  try {
    const { name, segmentFilter, segmentQueryText, message, channel } = req.body;
    if (!name || !segmentFilter || !message || !channel) {
      return res.status(400).json({ error: "Missing campaign creation parameters." });
    }

    const newCampaign = await Campaign.create({
      name,
      segmentFilter,
      segmentQueryText: segmentQueryText || "Custom Filter Rules",
      message,
      channel,
      status: "Pending",
      stats: { sent: 0, delivered: 0, read: 0, opened: 0, clicked: 0, failed: 0 }
    });

    res.status(201).json(newCampaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all campaigns
app.get('/api/campaigns', async (req, res) => {
  try {
    const campaigns = await Campaign.find({});
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// SYSTEM DESIGN: RATE-LIMITED DISPATCH QUEUE FOR SCALE
// -------------------------------------------------------------
const dispatchQueue = [];
let processingQueue = false;

async function processQueue() {
  if (processingQueue || dispatchQueue.length === 0) return;
  processingQueue = true;

  while (dispatchQueue.length > 0) {
    const item = dispatchQueue.shift();
    const { logId, recipient, message, callbackUrl } = item;

    try {
      // Dispatch message to Channel Service
      await axios.post(`${CHANNEL_SERVICE_URL}/api/channel/send`, {
        logId,
        recipient,
        message,
        callbackUrl
      });
    } catch (err) {
      console.error(`[Queue Worker] Failed to dispatch log ${logId} to simulator:`, err.message);
      // Automatically report delivery failure if the channel simulator is unreachable
      try {
        await axios.post(callbackUrl, {
          logId,
          status: 'Failed',
          timestamp: new Date()
        });
      } catch (innerErr) {
        console.error(`[Queue Worker] Failed to invoke internal callback for log ${logId}:`, innerErr.message);
      }
    }

    // Rate limiting: wait 50ms between dispatching messages
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  processingQueue = false;
}

function enqueueMessage(messageItem) {
  dispatchQueue.push(messageItem);
  processQueue();
}

// Launch / Send Campaign
app.post('/api/campaigns/:id/send', async (req, res) => {
  try {
    const campaignId = req.params.id;
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found." });
    }

    // Evaluate segment to get matching customers
    const customers = await Customer.find(campaign.segmentFilter);
    if (customers.length === 0) {
      return res.status(400).json({ error: "Target segment contains 0 customers. Cannot send campaign." });
    }

    // Update campaign status to 'Sent' and initialize stats
    await Campaign.updateOne(
      { _id: campaignId },
      {
        $set: {
          status: "Sent",
          "stats.sent": customers.length,
          "stats.delivered": 0,
          "stats.read": 0,
          "stats.opened": 0,
          "stats.clicked": 0,
          "stats.failed": 0
        }
      }
    );

    // Enqueue sending tasks asynchronously
    setTimeout(async () => {
      console.log(`[CRM Backend] Enqueueing campaign "${campaign.name}" for ${customers.length} recipients...`);
      for (const customer of customers) {
        try {
          const personalizedMsg = campaign.message.replace(/\{\{name\}\}/g, customer.name);
          const recipient = campaign.channel === 'Email' ? customer.email : customer.phone;

          // Create Communication Log
          const log = await CommunicationLog.create({
            campaignId: campaign._id,
            customerId: customer._id,
            recipient,
            message: personalizedMsg,
            status: "Sent",
            logs: [{ status: "Sent", timestamp: new Date() }]
          });

          // Push into our rate-limited dispatch queue
          enqueueMessage({
            logId: log._id,
            recipient,
            message: personalizedMsg,
            callbackUrl: `${CRM_BACKEND_URL}/api/campaigns/webhook`
          });
        } catch (err) {
          console.error(`[CRM Backend Send] Error processing customer ${customer._id}:`, err.message);
        }
      }
    }, 0);

    res.json({ success: true, message: "Campaign delivery queued.", sentCount: customers.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Retry Failed Campaign Messages
app.post('/api/campaigns/:id/retry-failed', async (req, res) => {
  try {
    const campaignId = req.params.id;
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found." });
    }

    // Find all failed communication logs for this campaign
    const failedLogs = await CommunicationLog.find({
      campaignId,
      status: 'Failed'
    });

    if (failedLogs.length === 0) {
      return res.json({ success: true, message: "No failed communications found to retry.", retriedCount: 0 });
    }

    // Decrement the failed count from the campaign statistics
    await Campaign.updateOne(
      { _id: campaignId },
      { $inc: { "stats.failed": -failedLogs.length } }
    );

    // Enqueue failed messages again
    setTimeout(async () => {
      console.log(`[CRM Backend Retry] Re-enqueueing ${failedLogs.length} failed messages...`);
      for (const log of failedLogs) {
        try {
          // Update status to Sent and add retry entry to log history
          await CommunicationLog.updateOne(
            { _id: log._id },
            {
              $set: { status: 'Sent' },
              $push: { logs: { status: 'Sent', timestamp: new Date() } }
            }
          );

          enqueueMessage({
            logId: log._id,
            recipient: log.recipient,
            message: log.message,
            callbackUrl: `${CRM_BACKEND_URL}/api/campaigns/webhook`
          });
        } catch (err) {
          console.error(`[CRM Backend Retry] Failed to retry log ${log._id}:`, err.message);
        }
      }
    }, 0);

    res.json({ success: true, message: "Retrying failed communications.", retriedCount: failedLogs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Webhook callback to update delivery status
app.post('/api/campaigns/webhook', async (req, res) => {
  try {
    const { logId, status, timestamp } = req.body;
    if (!logId || !status) {
      return res.status(400).json({ error: "Missing logId or status in callback." });
    }

    const log = await CommunicationLog.findById(logId);
    if (!log) {
      return res.status(404).json({ error: "Communication log not found." });
    }

    const oldStatus = log.status;

    // Only update and adjust counts if the status is actually new/progressed
    if (oldStatus !== status) {
      // Update Log
      await CommunicationLog.updateOne(
        { _id: logId },
        {
          $set: { status },
          $push: { logs: { status, timestamp: timestamp || new Date() } }
        }
      );

      // Adjust Campaign Stats
      const incFields = {};
      if (status === 'Delivered') {
        incFields['stats.delivered'] = 1;
      } else if (status === 'Read') {
        incFields['stats.read'] = 1;
      } else if (status === 'Opened') {
        incFields['stats.opened'] = 1;
      } else if (status === 'Clicked') {
        incFields['stats.clicked'] = 1;
      } else if (status === 'Failed') {
        incFields['stats.failed'] = 1;
      }

      if (Object.keys(incFields).length > 0) {
        await Campaign.updateOne(
          { _id: log.campaignId },
          { $inc: incFields }
        );
      }
      console.log(`[CRM Backend Webhook] Log ${logId} updated status from "${oldStatus}" to "${status}"`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[CRM Backend Webhook Error]:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Start CRM server
app.listen(PORT, () => {
  console.log(`🚀 CRM Backend Server running at http://localhost:${PORT}`);
});
