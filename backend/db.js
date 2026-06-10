import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
let useMock = false;

if (!MONGO_URI) {
  console.warn("⚠️  No MONGO_URI found in .env. Falling back to Local JSON Database!");
  useMock = true;
}

// -------------------------------------------------------------
// MONGOOSE IMPLEMENTATION
// -------------------------------------------------------------

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  city: { type: String, required: true },
  totalSpend: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const orderSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

const campaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  segmentFilter: { type: Object, required: true },
  segmentQueryText: { type: String },
  message: { type: String, required: true },
  channel: { type: String, enum: ['SMS', 'Email', 'WhatsApp', 'RCS'], required: true },
  status: { type: String, enum: ['Pending', 'Sent'], default: 'Pending' },
  stats: {
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    failed: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now }
});

const communicationLogSchema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  recipient: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Sent', 'Delivered', 'Read', 'Opened', 'Clicked', 'Failed'], default: 'Pending' },
  logs: [{
    status: String,
    timestamp: { type: Date, default: Date.now }
  }],
  updatedAt: { type: Date, default: Date.now }
});

let Customer, Order, Campaign, CommunicationLog;

if (!useMock) {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("⚡ Connected to MongoDB Atlas successfully.");
    Customer = mongoose.model('Customer', customerSchema);
    Order = mongoose.model('Order', orderSchema);
    Campaign = mongoose.model('Campaign', campaignSchema);
    CommunicationLog = mongoose.model('CommunicationLog', communicationLogSchema);
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    console.warn("⚠️  Switching to Local JSON Database due to connection error!");
    useMock = true;
  }
}

// -------------------------------------------------------------
// LOCAL JSON DATABASE MOCK IMPLEMENTATION
// -------------------------------------------------------------

if (useMock) {
  const mockDbPath = path.resolve('mock_db.json');
  
  const initMockDb = () => {
    if (!fs.existsSync(mockDbPath)) {
      fs.writeFileSync(mockDbPath, JSON.stringify({
        customers: [],
        orders: [],
        campaigns: [],
        communicationlogs: []
      }, null, 2));
    }
  };
  
  initMockDb();

  const readData = () => {
    try {
      const data = fs.readFileSync(mockDbPath, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return { customers: [], orders: [], campaigns: [], communicationlogs: [] };
    }
  };

  const writeData = (data) => {
    fs.writeFileSync(mockDbPath, JSON.stringify(data, null, 2));
  };

  // Helper to generate a random MongoDB-like hex ID
  const generateId = () => {
    return Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  };

  // Basic MongoDB-like Query Evaluator
  const evaluateQuery = (item, query) => {
    if (!query || Object.keys(query).length === 0) return true;
    for (const key in query) {
      const condition = query[key];
      const val = item[key];

      // Handle simple equality (or string/ID checking)
      if (typeof condition !== 'object' || condition === null) {
        if (String(val) !== String(condition)) return false;
        continue;
      }

      // Handle operators like $gt, $lt, $in, $gte, $lte
      for (const op in condition) {
        const targetVal = condition[op];
        if (op === '$gt' && !(val > targetVal)) return false;
        if (op === '$gte' && !(val >= targetVal)) return false;
        if (op === '$lt' && !(val < targetVal)) return false;
        if (op === '$lte' && !(val <= targetVal)) return false;
        if (op === '$in') {
          const list = Array.isArray(targetVal) ? targetVal : [targetVal];
          if (!list.map(String).includes(String(val))) return false;
        }
        if (op === '$nin') {
          const list = Array.isArray(targetVal) ? targetVal : [targetVal];
          if (list.map(String).includes(String(val))) return false;
        }
        if (op === '$regex') {
          const regex = new RegExp(targetVal, condition['$options'] || '');
          if (!regex.test(val)) return false;
        }
      }
    }
    return true;
  };

  class MockModel {
    constructor(collectionName) {
      this.collectionName = collectionName.toLowerCase() + 's';
    }

    async find(query = {}) {
      const db = readData();
      const items = db[this.collectionName] || [];
      const results = items.filter(item => evaluateQuery(item, query));
      
      // Return a chainable object mimicking Mongoose
      return {
        populate: (field) => {
          // Simple populate implementation
          if (field === 'customerId') {
            const customers = db.customers;
            results.forEach(item => {
              item.customerId = customers.find(c => String(c._id) === String(item.customerId)) || item.customerId;
            });
          }
          if (field === 'campaignId') {
            const campaigns = db.campaigns;
            results.forEach(item => {
              item.campaignId = campaigns.find(c => String(c._id) === String(item.campaignId)) || item.campaignId;
            });
          }
          return results;
        },
        then: (resolve) => resolve(results),
        catch: (reject) => {}
      };
    }

    async findOne(query = {}) {
      const db = readData();
      const items = db[this.collectionName] || [];
      const item = items.find(item => evaluateQuery(item, query));
      return item || null;
    }

    async findById(id) {
      return this.findOne({ _id: String(id) });
    }

    async create(data) {
      const db = readData();
      const items = db[this.collectionName] || [];
      const newItem = {
        _id: generateId(),
        ...data,
        createdAt: new Date().toISOString()
      };
      items.push(newItem);
      db[this.collectionName] = items;
      writeData(db);
      return newItem;
    }

    async updateOne(query, update) {
      const db = readData();
      const items = db[this.collectionName] || [];
      const index = items.findIndex(item => evaluateQuery(item, query));
      if (index !== -1) {
        // Simple update operator support
        const item = items[index];
        const updateOps = update.$set || update;
        const incOps = update.$inc || {};
        
        // Handle set operations
        for (const k in updateOps) {
          if (k.includes('.')) {
            // Nested path support (like stats.sent)
            const parts = k.split('.');
            let curr = item;
            for (let i = 0; i < parts.length - 1; i++) {
              if (!curr[parts[i]]) curr[parts[i]] = {};
              curr = curr[parts[i]];
            }
            curr[parts[parts.length - 1]] = updateOps[k];
          } else {
            item[k] = updateOps[k];
          }
        }
        
        // Handle increment operations
        for (const k in incOps) {
          if (k.includes('.')) {
            const parts = k.split('.');
            let curr = item;
            for (let i = 0; i < parts.length - 1; i++) {
              if (!curr[parts[i]]) curr[parts[i]] = {};
              curr = curr[parts[i]];
            }
            curr[parts[parts.length - 1]] = (curr[parts[parts.length - 1]] || 0) + incOps[k];
          } else {
            item[k] = (item[k] || 0) + incOps[k];
          }
        }

        // Support pushing to log arrays
        if (update.$push) {
          for (const k in update.$push) {
            if (!item[k]) item[k] = [];
            item[k].push(update.$push[k]);
          }
        }

        item.updatedAt = new Date().toISOString();
        items[index] = item;
        db[this.collectionName] = items;
        writeData(db);
        return { matchedCount: 1, modifiedCount: 1 };
      }
      return { matchedCount: 0, modifiedCount: 0 };
    }

    async updateMany(query, update) {
      // Implement basic updateMany by running updateOne repeatedly
      const db = readData();
      const items = db[this.collectionName] || [];
      let modified = 0;
      for (const item of items) {
        if (evaluateQuery(item, query)) {
          // Perform update
          const updateOps = update.$set || update;
          for (const k in updateOps) {
            item[k] = updateOps[k];
          }
          if (update.$push) {
            for (const k in update.$push) {
              if (!item[k]) item[k] = [];
              item[k].push(update.$push[k]);
            }
          }
          modified++;
        }
      }
      writeData(db);
      return { matchedCount: modified, modifiedCount: modified };
    }

    async countDocuments(query = {}) {
      const db = readData();
      const items = db[this.collectionName] || [];
      return items.filter(item => evaluateQuery(item, query)).length;
    }
  }

  Customer = new MockModel('Customer');
  Order = new MockModel('Order');
  Campaign = new MockModel('Campaign');
  CommunicationLog = new MockModel('CommunicationLog');
}

export { Customer, Order, Campaign, CommunicationLog, useMock };
