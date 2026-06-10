import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Data States
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  
  // Dashboard AI Insights
  const [aiInsights, setAiInsights] = useState({ insights: [], recommendations: [] });
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Form States - Customer
  const [custForm, setCustForm] = useState({ name: '', email: '', phone: '', city: '' });
  const [custModalOpen, setCustModalOpen] = useState(false);

  // Form States - Order
  const [orderForm, setOrderForm] = useState({ customerId: '', amount: '', category: '' });
  const [orderModalOpen, setOrderModalOpen] = useState(false);

  // Segment Builder States
  const [segmentName, setSegmentName] = useState('');
  const [segmentRules, setSegmentRules] = useState([{ field: 'totalSpend', operator: '$gt', value: '' }]);
  const [aiSegmentText, setAiSegmentText] = useState('');
  const [evaluatedCount, setEvaluatedCount] = useState(null);
  const [evaluatedList, setEvaluatedList] = useState([]);
  const [evaluating, setEvaluating] = useState(false);
  const [activeSegmentFilter, setActiveSegmentFilter] = useState(null);

  // Campaign Creator States
  const [campName, setCampName] = useState('');
  const [campMessage, setCampMessage] = useState('');
  const [campChannel, setCampChannel] = useState('SMS');
  const [aiMessageTheme, setAiMessageTheme] = useState('');
  const [generatingMessage, setGeneratingMessage] = useState(false);
  
  // Notification / Seeding feedback
  const [toast, setToast] = useState(null);

  // Show toast feedback helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // -------------------------------------------------------------
  // DATA FETCHING FUNCTIONS
  // -------------------------------------------------------------
  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/customers`);
      setCustomers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API_BASE}/orders`);
      setOrders(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await axios.get(`${API_BASE}/campaigns`);
      setCampaigns(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAiInsights = async () => {
    setInsightsLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/ai/insights`);
      setAiInsights(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setInsightsLoading(false);
    }
  };

  // Seed Demo Data
  const seedDemoData = async () => {
    try {
      showToast("Seeding demo data...", "info");
      const res = await axios.post(`${API_BASE}/customers/seed`);
      showToast(res.data.message);
      fetchCustomers();
      fetchOrders();
      fetchCampaigns();
      fetchAiInsights();
    } catch (err) {
      showToast(err.response?.data?.error || "Seeding failed.", "danger");
    }
  };

  // Initial load
  useEffect(() => {
    fetchCustomers();
    fetchOrders();
    fetchCampaigns();
    fetchAiInsights();
  }, []);

  // Poll for campaign status updates every 3 seconds if there is a 'Sent' campaign
  useEffect(() => {
    const hasActiveCampaigns = campaigns.some(c => c.status === 'Sent');
    let interval = null;

    if (hasActiveCampaigns) {
      interval = setInterval(() => {
        fetchCampaigns();
      }, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [campaigns]);

  // -------------------------------------------------------------
  // SUBMIT HANDLERS
  // -------------------------------------------------------------

  // Add Customer
  const handleAddCustomer = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/customers`, custForm);
      showToast("Customer added successfully!");
      setCustForm({ name: '', email: '', phone: '', city: '' });
      setCustModalOpen(false);
      fetchCustomers();
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to add customer.", "danger");
    }
  };

  // Add Order
  const handleAddOrder = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/orders`, orderForm);
      showToast("Order added successfully!");
      setOrderForm({ customerId: '', amount: '', category: '' });
      setOrderModalOpen(false);
      fetchCustomers(); // Refresh customer spend
      fetchOrders();
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to add order.", "danger");
    }
  };

  // -------------------------------------------------------------
  // SEGMENT BUILDER FUNCTIONS
  // -------------------------------------------------------------

  // Translate rule array to MongoDB filter query object
  const buildRulesFilter = () => {
    const filter = {};
    segmentRules.forEach(rule => {
      if (!rule.value) return;
      const parsedVal = isNaN(rule.value) ? rule.value : parseFloat(rule.value);
      
      if (rule.field === 'totalSpend') {
        filter.totalSpend = { [rule.operator]: parsedVal };
      } else if (rule.field === 'city') {
        filter.city = rule.value;
      }
    });
    return filter;
  };

  // Evaluate Segment Preview (Manual Rules)
  const handleEvaluateSegment = async () => {
    setEvaluating(true);
    const filter = buildRulesFilter();
    setActiveSegmentFilter(filter);
    try {
      const res = await axios.post(`${API_BASE}/segments/evaluate`, { filter });
      setEvaluatedCount(res.data.count);
      setEvaluatedList(res.data.customers);
      showToast(`Segment evaluated: ${res.data.count} matching customers.`);
    } catch (err) {
      showToast("Evaluation failed.", "danger");
    } finally {
      setEvaluating(false);
    }
  };

  // Evaluate Segment Preview via AI Natural Language
  const handleAiEvaluateSegment = async () => {
    if (!aiSegmentText.trim()) return;
    setEvaluating(true);
    try {
      showToast("AI is constructing segment query...", "info");
      const res = await axios.post(`${API_BASE}/ai/segment`, { queryText: aiSegmentText });
      const filter = res.data.filter;
      setActiveSegmentFilter(filter);
      
      // Evaluate the generated query filter
      const evalRes = await axios.post(`${API_BASE}/segments/evaluate`, { filter });
      setEvaluatedCount(evalRes.data.count);
      setEvaluatedList(evalRes.data.customers);
      showToast(`AI Segment Ready: ${evalRes.data.count} customers match.`);
    } catch (err) {
      showToast("AI Segment Translation failed.", "danger");
    } finally {
      setEvaluating(false);
    }
  };

  // Add rule row
  const addRule = () => {
    setSegmentRules([...segmentRules, { field: 'totalSpend', operator: '$gt', value: '' }]);
  };

  // Update rule row
  const updateRule = (index, key, val) => {
    const updated = [...segmentRules];
    updated[index][key] = val;
    setSegmentRules(updated);
  };

  // Remove rule row
  const removeRule = (index) => {
    setSegmentRules(segmentRules.filter((_, idx) => idx !== index));
  };

  // -------------------------------------------------------------
  // CAMPAIGN CREATOR FUNCTIONS
  // -------------------------------------------------------------

  // Generate campaign message using AI
  const handleAiMessageGenerate = async () => {
    if (!aiMessageTheme.trim()) return;
    setGeneratingMessage(true);
    try {
      showToast("AI is writing message copy...", "info");
      const res = await axios.post(`${API_BASE}/ai/generate-message`, {
        theme: aiMessageTheme,
        channel: campChannel
      });
      setCampMessage(res.data.body);
      showToast("AI Campaign Message drafted successfully!");
    } catch (err) {
      showToast("Failed to draft message with AI.", "danger");
    } finally {
      setGeneratingMessage(false);
    }
  };

  // Create & Send Campaign
  const handleLaunchCampaign = async (e) => {
    e.preventDefault();
    if (!campName || !campMessage || !activeSegmentFilter) {
      return showToast("Please fill all campaign details and evaluate a segment first.", "warning");
    }

    try {
      showToast("Saving campaign...", "info");
      // Create campaign
      const createRes = await axios.post(`${API_BASE}/campaigns`, {
        name: campName,
        segmentFilter: activeSegmentFilter,
        segmentQueryText: aiSegmentText || "Custom Rule Segment",
        message: campMessage,
        channel: campChannel
      });
      
      const newCamp = createRes.data;
      showToast("Campaign created. Dispatching messages now...");

      // Send campaign immediately
      await axios.post(`${API_BASE}/campaigns/${newCamp._id}/send`);
      showToast("Campaign launched! Redirecting to Dashboard...", "success");
      
      // Reset campaign form
      setCampName('');
      setCampMessage('');
      setAiMessageTheme('');
      setActiveSegmentFilter(null);
      setEvaluatedCount(null);
      setEvaluatedList([]);

      // Redirect to Dashboard & refresh lists
      setActiveTab('dashboard');
      fetchCampaigns();
    } catch (err) {
      showToast(err.response?.data?.error || "Launch failed.", "danger");
    }
  };

  // Accept a dashboard AI recommended campaign
  const handleApplyRecommendation = (reco) => {
    setActiveTab('campaigns');
    setCampChannel(reco.channel);
    setCampName(`AI Recommendation: ${reco.title}`);
    setAiSegmentText(reco.suggestedQuery);
    
    // Evaluate the suggested query filter immediately so the user can review it
    showToast(`Loading recommended query: "${reco.suggestedQuery}"`, "info");
    axios.post(`${API_BASE}/ai/segment`, { queryText: reco.suggestedQuery })
      .then(res => {
        const filter = res.data.filter;
        setActiveSegmentFilter(filter);
        return axios.post(`${API_BASE}/segments/evaluate`, { filter });
      })
      .then(evalRes => {
        setEvaluatedCount(evalRes.data.count);
        setEvaluatedList(evalRes.data.customers);
        showToast(`AI Segment Ready: ${evalRes.data.count} matching customers.`);
      })
      .catch(err => {
        showToast("Failed to load recommendation filter.", "danger");
      });
  };

  const handleRetryFailed = async (campaignId) => {
    try {
      showToast("Retrying failed messages...", "info");
      const res = await axios.post(`${API_BASE}/campaigns/${campaignId}/retry-failed`);
      showToast(res.data.message);
      fetchCampaigns();
    } catch (err) {
      showToast(err.response?.data?.error || "Retry failed.", "danger");
    }
  };

  // Helper: calculate conversion rate
  const calcConversion = (stats) => {
    if (!stats.sent) return "0.0%";
    return ((stats.clicked / stats.sent) * 100).toFixed(1) + "%";
  };

  return (
    <div className="app-container">
      
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: toast.type === 'success' ? '#10b981' : toast.type === 'danger' ? '#ef4444' : toast.type === 'info' ? '#3b82f6' : '#f59e0b',
          color: 'white',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 9999,
          fontWeight: 600,
          transition: 'all 0.3s'
        }}>
          {toast.message}
        </div>
      )}

      {/* 1. SIDEBAR */}
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">X</div>
          <div className="logo-text">XenoCRM</div>
        </div>
        <nav>
          <ul className="nav-links">
            <li className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
              <span className="nav-item-icon">📊</span> Dashboard
            </li>
            <li className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>
              <span className="nav-item-icon">👥</span> Customers
            </li>
            <li className={`nav-item ${activeTab === 'segments' ? 'active' : ''}`} onClick={() => setActiveTab('segments')}>
              <span className="nav-item-icon">🎛️</span> Audience Builder
            </li>
            <li className={`nav-item ${activeTab === 'campaigns' ? 'active' : ''}`} onClick={() => setActiveTab('campaigns')}>
              <span className="nav-item-icon">📣</span> Campaigns
            </li>
          </ul>
        </nav>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <main className="main-content">
        
        {/* Header */}
        <header className="header">
          <div className="header-title">
            <h1>
              {activeTab === 'dashboard' && 'Dashboard Overview'}
              {activeTab === 'customers' && 'Customer Ingestion'}
              {activeTab === 'segments' && 'Audience Segments'}
              {activeTab === 'campaigns' && 'Campaign Orchestrator'}
            </h1>
            <p>
              {activeTab === 'dashboard' && 'Monitor campaign performance and delivery stats in real time.'}
              {activeTab === 'customers' && 'Manage customer profiles and log historical order data.'}
              {activeTab === 'segments' && 'Create precise audiences using query rules or natural language AI.'}
              {activeTab === 'campaigns' && 'Compose personalized copy and deploy multi-channel campaigns.'}
            </p>
          </div>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={seedDemoData}>🧪 Seed Demo Data</button>
          </div>
        </header>

        {/* =========================================================
            TAB: DASHBOARD
            ========================================================= */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Overall Stats Cards */}
            <div className="stats-grid">
              <div className="card stat-card stat-glow-indigo">
                <span className="stat-label">Total Sent</span>
                <span className="stat-value">{campaigns.reduce((acc, curr) => acc + (curr.stats?.sent || 0), 0)}</span>
                <span className="stat-label" style={{ textTransform: 'none', color: '#818cf8' }}>Across all runs</span>
              </div>
              <div className="card stat-card stat-glow-cyan">
                <span className="stat-label">Delivered</span>
                <span className="stat-value">
                  {(() => {
                    const sent = campaigns.reduce((acc, c) => acc + (c.stats?.sent || 0), 0);
                    const del = campaigns.reduce((acc, c) => acc + (c.stats?.delivered || 0), 0);
                    if (!sent) return "0.0%";
                    return ((del / sent) * 100).toFixed(1) + "%";
                  })()}
                </span>
                <span className="stat-label" style={{ textTransform: 'none', color: '#22d3ee' }}>Avg. Delivery Rate</span>
              </div>
              <div className="card stat-card stat-glow-indigo">
                <span className="stat-label">Read Rate</span>
                <span className="stat-value">
                  {(() => {
                    const sent = campaigns.reduce((acc, c) => acc + (c.stats?.sent || 0), 0);
                    const rd = campaigns.reduce((acc, c) => acc + (c.stats?.read || 0), 0);
                    if (!sent) return "0.0%";
                    return ((rd / sent) * 100).toFixed(1) + "%";
                  })()}
                </span>
                <span className="stat-label" style={{ textTransform: 'none', color: '#a5b4fc' }}>Avg. Read Rate</span>
              </div>
              <div className="card stat-card stat-glow-pink">
                <span className="stat-label">Open Rate</span>
                <span className="stat-value">
                  {(() => {
                    const sent = campaigns.reduce((acc, c) => acc + (c.stats?.sent || 0), 0);
                    const open = campaigns.reduce((acc, c) => acc + (c.stats?.opened || 0), 0);
                    if (!sent) return "0.0%";
                    return ((open / sent) * 100).toFixed(1) + "%";
                  })()}
                </span>
                <span className="stat-label" style={{ textTransform: 'none', color: '#f472b6' }}>Avg. Open Rate</span>
              </div>
              <div className="card stat-card stat-glow-emerald">
                <span className="stat-label">Conversions</span>
                <span className="stat-value">
                  {(() => {
                    const sent = campaigns.reduce((acc, c) => acc + (c.stats?.sent || 0), 0);
                    const click = campaigns.reduce((acc, c) => acc + (c.stats?.clicked || 0), 0);
                    if (!sent) return "0.0%";
                    return ((click / sent) * 100).toFixed(1) + "%";
                  })()}
                </span>
                <span className="stat-label" style={{ textTransform: 'none', color: '#34d399' }}>Avg. Click Conversion</span>
              </div>
            </div>

            {/* AI Insights & Recommendations Panel */}
            <div className="card" style={{ marginBottom: '2.5rem', border: '1px solid rgba(239, 68, 68, 0.25)', background: 'linear-gradient(to right, rgba(239, 68, 68, 0.05), rgba(255, 107, 107, 0.02))' }}>
              <div className="ai-sparkle-header">
                <span>✨</span> AI Analytics & Next Campaign Suggestions
              </div>
              
              {insightsLoading ? (
                <div style={{ color: 'var(--text-secondary)' }}>Generating smart recommendation reports...</div>
              ) : (
                <div>
                  <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                    {aiInsights.insights?.map((ins, idx) => (
                      <li key={idx} style={{ marginBottom: '0.5rem' }}>{ins}</li>
                    ))}
                    {(!aiInsights.insights || aiInsights.insights.length === 0) && (
                      <li>Seeded campaign analytics are required to generate model insights. Try launching a campaign!</li>
                    )}
                  </ul>
                  
                  {aiInsights.recommendations?.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Recommended Actions:</h3>
                      <div className="reco-grid">
                        {aiInsights.recommendations.map((reco, idx) => (
                          <div key={idx} className="reco-card">
                            <div className="reco-header">
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{reco.title}</span>
                              <span className="reco-badge">{reco.channel}</span>
                            </div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{reco.description}</p>
                            <button className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', width: 'fit-content', marginTop: 'auto' }} onClick={() => handleApplyRecommendation(reco)}>
                              🚀 Apply Segment & Draft
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Campaign Performance Table */}
            <div className="card">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Campaign Performance</h2>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Channel</th>
                      <th>Target Query</th>
                      <th>Status</th>
                      <th>Sent</th>
                      <th>Delivered</th>
                      <th>Read</th>
                      <th>Opened</th>
                      <th>Clicked</th>
                      <th>Failed</th>
                      <th>Conv. Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((camp) => (
                      <tr key={camp._id}>
                        <td><strong>{camp.name}</strong></td>
                        <td>
                          <span style={{
                            background: camp.channel === 'WhatsApp' ? 'rgba(16, 185, 129, 0.15)' : camp.channel === 'SMS' ? 'rgba(6, 182, 212, 0.15)' : camp.channel === 'RCS' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(236, 72, 153, 0.15)',
                            color: camp.channel === 'WhatsApp' ? '#34d399' : camp.channel === 'SMS' ? '#22d3ee' : camp.channel === 'RCS' ? '#a5b4fc' : '#f472b6',
                            padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold'
                          }}>
                            {camp.channel}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          <code>{camp.segmentQueryText}</code>
                        </td>
                        <td>
                          {camp.status === 'Sent' && <span className="pulse-dot"></span>}
                          <span className={`badge ${camp.status === 'Sent' ? 'badge-sent' : 'badge-success'}`}>
                            {camp.status}
                          </span>
                        </td>
                        <td>{camp.stats?.sent || 0}</td>
                        <td>
                          {camp.stats?.delivered || 0}
                          <div className="progress-bar-container">
                            <div className="progress-fill fill-delivered" style={{ width: `${camp.stats?.sent ? (camp.stats.delivered/camp.stats.sent)*100 : 0}%` }}></div>
                          </div>
                        </td>
                        <td>
                          {camp.stats?.read || 0}
                          <div className="progress-bar-container">
                            <div className="progress-fill fill-read" style={{ width: `${camp.stats?.sent ? (camp.stats.read/camp.stats.sent)*100 : 0}%`, backgroundColor: 'var(--color-info)' }}></div>
                          </div>
                        </td>
                        <td>
                          {camp.stats?.opened || 0}
                          <div className="progress-bar-container">
                            <div className="progress-fill fill-opened" style={{ width: `${camp.stats?.sent ? (camp.stats.opened/camp.stats.sent)*100 : 0}%` }}></div>
                          </div>
                        </td>
                        <td>
                          {camp.stats?.clicked || 0}
                          <div className="progress-bar-container">
                            <div className="progress-fill fill-clicked" style={{ width: `${camp.stats?.sent ? (camp.stats.clicked/camp.stats.sent)*100 : 0}%` }}></div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ color: camp.stats?.failed > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>{camp.stats?.failed || 0}</span>
                            {camp.stats?.failed > 0 && (
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', marginTop: '0.25rem', borderColor: 'var(--color-danger)', color: 'var(--color-danger)', borderRadius: '4px' }}
                                onClick={() => handleRetryFailed(camp._id)}
                              >
                                🔄 Retry
                              </button>
                            )}
                          </div>
                        </td>
                        <td><strong style={{ color: 'var(--color-success)' }}>{calcConversion(camp.stats)}</strong></td>
                      </tr>
                    ))}
                    {campaigns.length === 0 && (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          No campaigns found. Go to the "Campaigns" tab to create your first marketing campaign!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB: CUSTOMERS
            ========================================================= */}
        {activeTab === 'customers' && (
          <div className="view-split">
            
            {/* Customer List */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Customers Directory</h2>
                <button className="btn btn-primary" onClick={() => setCustModalOpen(true)}>+ Add Customer</button>
              </div>

              <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>City</th>
                      <th>Phone</th>
                      <th>Total Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c._id}>
                        <td>
                          <div><strong>{c.name}</strong></div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.email}</div>
                        </td>
                        <td>{c.city}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{c.phone}</td>
                        <td><strong>₹{c.totalSpend.toLocaleString()}</strong></td>
                      </tr>
                    ))}
                    {customers.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          No customer profiles loaded. Seed demo data to fill.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Orders List */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Purchase Orders</h2>
                <button className="btn btn-primary" onClick={() => setOrderModalOpen(true)}>+ Log Order</button>
              </div>

              <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Customer</th>
                      <th>Category</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o._id}>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}><code>{o._id.substring(0, 8)}...</code></td>
                        <td>
                          <div><strong>{o.customerId?.name || 'Seeded Customer'}</strong></div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{o.customerId?.email}</div>
                        </td>
                        <td>
                          <span style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem'
                          }}>
                            {o.category}
                          </span>
                        </td>
                        <td><strong>₹{o.amount.toLocaleString()}</strong></td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          No orders tracked. Add manual orders to increase client spend.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Modal: Add Customer */}
            {custModalOpen && (
              <div className="modal-overlay" onClick={() => setCustModalOpen(false)}>
                <div className="card modal-content" onClick={(e) => e.stopPropagation()}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Add Customer Profile</h3>
                  <form onSubmit={handleAddCustomer}>
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <input className="form-input" required value={custForm.name} onChange={e => setCustForm({...custForm, name: e.target.value})} placeholder="e.g. Rahul Sharma" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email Address</label>
                      <input className="form-input" type="email" required value={custForm.email} onChange={e => setCustForm({...custForm, email: e.target.value})} placeholder="e.g. rahul@gmail.com" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mobile Number</label>
                      <input className="form-input" required value={custForm.phone} onChange={e => setCustForm({...custForm, phone: e.target.value})} placeholder="e.g. +919876543210" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">City</label>
                      <input className="form-input" required value={custForm.city} onChange={e => setCustForm({...custForm, city: e.target.value})} placeholder="e.g. Delhi" />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                      <button className="btn btn-primary" type="submit" style={{ flex: 1 }}>Save Customer</button>
                      <button className="btn btn-secondary" type="button" onClick={() => setCustModalOpen(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal: Add Order */}
            {orderModalOpen && (
              <div className="modal-overlay" onClick={() => setOrderModalOpen(false)}>
                <div className="card modal-content" onClick={(e) => e.stopPropagation()}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Log Purchase Order</h3>
                  <form onSubmit={handleAddOrder}>
                    <div className="form-group">
                      <label className="form-label">Select Customer</label>
                      <select className="form-select" required value={orderForm.customerId} onChange={e => setOrderForm({...orderForm, customerId: e.target.value})}>
                        <option value="">-- Choose Customer --</option>
                        {customers.map(c => (
                          <option key={c._id} value={c._id}>{c.name} ({c.email})</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Order Amount (₹)</label>
                      <input className="form-input" type="number" required value={orderForm.amount} onChange={e => setOrderForm({...orderForm, amount: e.target.value})} placeholder="e.g. 4500" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Category</label>
                      <select className="form-select" required value={orderForm.category} onChange={e => setOrderForm({...orderForm, category: e.target.value})}>
                        <option value="">-- Select Category --</option>
                        <option value="Clothing">Clothing</option>
                        <option value="Electronics">Electronics</option>
                        <option value="Books">Books</option>
                        <option value="Home Decor">Home Decor</option>
                        <option value="Footwear">Footwear</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                      <button className="btn btn-primary" type="submit" style={{ flex: 1 }}>Record Order</button>
                      <button className="btn btn-secondary" type="button" onClick={() => setOrderModalOpen(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}

        {/* =========================================================
            TAB: AUDIENCE SEGMENTS
            ========================================================= */}
        {activeTab === 'segments' && (
          <div className="view-split">
            
            {/* Rule Configurator */}
            <div className="card">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Segment Builder</h2>
              
              {/* AI input section */}
              <div className="ai-prompt-box">
                <div className="ai-sparkle-header">
                  <span>✨</span> Build Segment with Natural Language (AI)
                </div>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <input className="form-input" value={aiSegmentText} onChange={e => setAiSegmentText(e.target.value)} placeholder="e.g. Customers in Delhi who spent more than 5000" />
                </div>
                <button className="btn btn-glow-pink" onClick={handleAiEvaluateSegment} disabled={evaluating} style={{ width: '100%' }}>
                  {evaluating ? "Translating..." : "🧙‍♂️ Let AI Build It"}
                </button>
              </div>

              <div style={{ borderBottom: '1px solid var(--glass-border)', margin: '1.5rem 0' }}></div>

              {/* Manual rule builder */}
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Manual Rules</h3>
              {segmentRules.map((rule, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                  <select className="form-select" style={{ flex: 2 }} value={rule.field} onChange={e => updateRule(idx, 'field', e.target.value)}>
                    <option value="totalSpend">Total Spend (₹)</option>
                    <option value="city">City</option>
                  </select>
                  
                  {rule.field === 'totalSpend' ? (
                    <select className="form-select" style={{ flex: 1.5 }} value={rule.operator} onChange={e => updateRule(idx, 'operator', e.target.value)}>
                      <option value="$gt">&gt; (Greater than)</option>
                      <option value="$gte">&gt;= (Greater or equal)</option>
                      <option value="$lt">&lt; (Less than)</option>
                      <option value="$lte">&lt;= (Less or equal)</option>
                    </select>
                  ) : (
                    <span style={{ flex: 1.5, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>equals</span>
                  )}

                  <input className="form-input" style={{ flex: 3 }} value={rule.value} onChange={e => updateRule(idx, 'value', e.target.value)} placeholder={rule.field === 'totalSpend' ? "e.g. 5000" : "e.g. Delhi"} />
                  
                  {segmentRules.length > 1 && (
                    <button className="btn btn-secondary" style={{ padding: '0.85rem' }} onClick={() => removeRule(idx)}>❌</button>
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
                <button className="btn btn-secondary" onClick={addRule}>+ Add Rule Row</button>
                <button className="btn btn-primary" onClick={handleEvaluateSegment} disabled={evaluating}>
                  {evaluating ? "Evaluating..." : "🔍 Run Query"}
                </button>
              </div>
            </div>

            {/* Segment Preview List */}
            <div className="card">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Segment Audience Preview</h2>
              
              {evaluatedCount !== null ? (
                <div>
                  <div className="preview-stat">
                    <span className="preview-count">{evaluatedCount}</span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Customers Match segment filters</span>
                  </div>

                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Matching Clients:</h3>
                  <div className="table-container" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Client</th>
                          <th>City</th>
                          <th>Total Spend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evaluatedList.map(c => (
                          <tr key={c._id}>
                            <td>
                              <div><strong>{c.name}</strong></div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.email}</div>
                            </td>
                            <td>{c.city}</td>
                            <td><strong>₹{c.totalSpend.toLocaleString()}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div style={{ marginTop: '2rem' }}>
                    <button className="btn btn-glow-pink" style={{ width: '100%' }} onClick={() => {
                      setActiveTab('campaigns');
                    }}>
                      📣 Create Campaign For This Audience
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', minHeight: '300px' }}>
                  Define queries or type an AI segment description and click Run to preview target audience details.
                </div>
              )}
            </div>

          </div>
        )}

        {/* =========================================================
            TAB: CAMPAIGNS
            ========================================================= */}
        {activeTab === 'campaigns' && (
          <div className="view-split">
            
            {/* Create Campaign Form */}
            <div className="card">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>New Marketing Campaign</h2>
              <form onSubmit={handleLaunchCampaign}>
                
                <div className="form-group">
                  <label className="form-label">Campaign Name</label>
                  <input className="form-input" required value={campName} onChange={e => setCampName(e.target.value)} placeholder="e.g. Summer Clearance Sale" />
                </div>

                <div className="form-group">
                  <label className="form-label">Communication Channel</label>
                  <select className="form-select" value={campChannel} onChange={e => setCampChannel(e.target.value)}>
                    <option value="SMS">SMS</option>
                    <option value="Email">Email</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="RCS">RCS</option>
                  </select>
                </div>

                {/* AI copy writer */}
                <div className="ai-prompt-box">
                  <div className="ai-sparkle-header">
                    <span>✨</span> AI Copywriter (Gemini Message Generator)
                  </div>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <input className="form-input" value={aiMessageTheme} onChange={e => setAiMessageTheme(e.target.value)} placeholder="e.g. 20% discount on summer wardrobe items" />
                  </div>
                  <button className="btn btn-glow-pink" type="button" onClick={handleAiMessageGenerate} disabled={generatingMessage} style={{ width: '100%' }}>
                    {generatingMessage ? "Composing..." : "✍️ Write Message Copy"}
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">Message Content</label>
                  <textarea className="form-textarea" required rows="5" value={campMessage} onChange={e => setCampMessage(e.target.value)} placeholder="Type copy here. Use {{name}} for dynamic client name interpolation."></textarea>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Variables: <code>{"{{name}}"}</code> will be dynamically replaced with the customer's actual name.</span>
                </div>

                <div style={{ marginTop: '2.5rem' }}>
                  <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>
                    🚀 Launch Campaign
                  </button>
                </div>
              </form>
            </div>

            {/* Audience segment verification */}
            <div className="card">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Target Audience Details</h2>
              {activeSegmentFilter ? (
                <div>
                  <div className="preview-stat">
                    <span className="preview-count">{evaluatedCount}</span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Target Recipients</span>
                  </div>

                  <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--glass-border)', marginBottom: '1.5rem' }}>
                    <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Segment Filter Definition:</span>
                    <code style={{ fontSize: '0.85rem' }}>{JSON.stringify(activeSegmentFilter)}</code>
                  </div>

                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Recipient List Preview:</h3>
                  <div className="table-container" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Client</th>
                          <th>City</th>
                          <th>Total Spend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evaluatedList.map(c => (
                          <tr key={c._id}>
                            <td>
                              <div><strong>{c.name}</strong></div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.email}</div>
                            </td>
                            <td>{c.city}</td>
                            <td><strong>₹{c.totalSpend.toLocaleString()}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', minHeight: '300px', flexDirection: 'column', gap: '1rem' }}>
                  <p>No segment evaluated yet for this campaign.</p>
                  <button className="btn btn-secondary" onClick={() => setActiveTab('segments')}>
                    🎛️ Evaluate Segment First
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
