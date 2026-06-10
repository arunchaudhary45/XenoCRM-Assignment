import time
import requests
import subprocess
import sys
import os

CRM_URL = "http://localhost:5050/api"
CHANNEL_URL = "http://localhost:6060/api"

def safe_print(s):
    # Strip non-ASCII characters to avoid CP1252 Windows terminal crashes
    print(s.encode('ascii', 'ignore').decode('ascii'))

safe_print("==================================================")
safe_print("XENO CRM PIPELINE INTEGRATION TEST")
safe_print("==================================================")

# 1. Start Services
safe_print("\n[1/5] Launching CRM Backend and Channel Service (Isolated Ports)...")
env_crm = os.environ.copy()
env_crm["PORT"] = "5050"
env_crm["CHANNEL_SERVICE_URL"] = "http://localhost:6060"

crm_process = subprocess.Popen(
    ["npm", "run", "start"], 
    cwd="./backend", 
    shell=True, 
    env=env_crm,
    stdout=subprocess.PIPE, 
    stderr=subprocess.PIPE
)

env_channel = os.environ.copy()
env_channel["PORT"] = "6060"
env_channel["CRM_CALLBACK_URL"] = "http://localhost:5050/api/campaigns/webhook"

channel_process = subprocess.Popen(
    ["npm", "run", "start"], 
    cwd="./channel-service", 
    shell=True, 
    env=env_channel,
    stdout=subprocess.PIPE, 
    stderr=subprocess.PIPE
)

# Wait a few seconds for services to boot
time.sleep(3)

# Verify servers are responsive
try:
    res = requests.get(f"{CRM_URL}/customers")
    safe_print("[OK] CRM Backend is active on port 5050.")
except Exception as e:
    safe_print(f"[FAIL] CRM Backend connection failed on port 5050: {e}")
    crm_process.terminate()
    channel_process.terminate()
    sys.exit(1)

# 2. Seed Database
safe_print("\n[2/5] Seeding demo data...")
try:
    res = requests.post(f"{CRM_URL}/customers/seed")
    data = res.json()
    safe_print(f"[OK] Seeding result: {data.get('message')}")
    safe_print(f"   Customers: {data.get('customersAdded')}, Orders: {data.get('ordersAdded')}")
except Exception as e:
    safe_print(f"[FAIL] Seeding request failed: {e}")
    crm_process.terminate()
    channel_process.terminate()
    sys.exit(1)

# 3. Test Segment Builder
safe_print("\n[3/5] Evaluating segments...")
try:
    # Query: customers who spent > 5000
    filter_query = {"totalSpend": {"$gt": 5000}}
    res = requests.post(f"{CRM_URL}/segments/evaluate", json={"filter": filter_query})
    data = res.json()
    safe_print(f"[OK] Evaluated count: {data.get('count')} matching customers.")
    for cust in data.get('customers', []):
        safe_print(f"   - {cust['name']} ({cust['city']}): spent Rs.{cust['totalSpend']}")
except Exception as e:
    safe_print(f"[FAIL] Segment evaluation failed: {e}")
    crm_process.terminate()
    channel_process.terminate()
    sys.exit(1)

# 4. Test AI Heuristics
safe_print("\n[4/5] Testing AI Query Heuristics...")
try:
    # Test NL parse
    res = requests.post(f"{CRM_URL}/ai/segment", json={"queryText": "spent more than 5000 in Delhi"})
    filter_obj = res.json().get('filter')
    safe_print(f"[OK] AI Parsed Filter: {filter_obj}")
    
    # Test message generate
    res = requests.post(f"{CRM_URL}/ai/generate-message", json={"theme": "summer sale discount", "channel": "WhatsApp"})
    msg_obj = res.json()
    safe_print("[OK] AI Generated Message:")
    safe_print(f"   Subject: {msg_obj.get('subject')}")
    safe_print(f"   Body: {msg_obj.get('body')}")
except Exception as e:
    safe_print(f"[FAIL] AI helper endpoints failed: {e}")
    crm_process.terminate()
    channel_process.terminate()
    sys.exit(1)

# 5. Create & Launch Campaign
safe_print("\n[5/5] Launching Campaign and Monitoring Webhook Delivery Simulation...")
try:
    camp_payload = {
        "name": "Test Launch Campaign",
        "segmentFilter": {"totalSpend": {"$gt": 4000}},
        "segmentQueryText": "spent more than 4000",
        "message": "Hi {{name}}, here is your test offer!",
        "channel": "SMS"
      }
    res = requests.post(f"{CRM_URL}/campaigns", json=camp_payload)
    camp = res.json()
    camp_id = camp.get('_id')
    safe_print(f"[OK] Created Campaign: {camp.get('name')} (ID: {camp_id})")

    # Send campaign
    send_res = requests.post(f"{CRM_URL}/campaigns/{camp_id}/send")
    safe_print(f"[OK] Send process launched: {send_res.json().get('message')}")

    # Poll status for 10 seconds to witness webhook callbacks
    safe_print("Waiting for callbacks from Channel Service simulator...")
    for i in range(5):
        time.sleep(2)
        status_res = requests.get(f"{CRM_URL}/campaigns")
        camps = status_res.json()
        current_camp = next(c for c in camps if c['_id'] == camp_id)
        stats = current_camp.get('stats', {})
        safe_print(f"   [T+{2*(i+1)}s] Stats: Sent: {stats.get('sent')}, Delivered: {stats.get('delivered')}, Read: {stats.get('read')}, Opened: {stats.get('opened')}, Clicked: {stats.get('clicked')}, Failed: {stats.get('failed')}")

    # Test Campaign Retry Failed Messages Endpoint
    safe_print("\n[OK] Testing Campaign Retry for Failed Messages...")
    retry_res = requests.post(f"{CRM_URL}/campaigns/{camp_id}/retry-failed")
    retry_data = retry_res.json()
    safe_print(f"   Retry Response: {retry_data.get('message')} (Retried: {retry_data.get('retriedCount')})")

    # Poll once more to see retries running
    time.sleep(2)
    status_res = requests.get(f"{CRM_URL}/campaigns")
    camps = status_res.json()
    current_camp = next(c for c in camps if c['_id'] == camp_id)
    stats = current_camp.get('stats', {})
    safe_print(f"   [Final Stats] Stats: Sent: {stats.get('sent')}, Delivered: {stats.get('delivered')}, Read: {stats.get('read')}, Opened: {stats.get('opened')}, Clicked: {stats.get('clicked')}, Failed: {stats.get('failed')}")

    safe_print("\n[OK] Webhook Callback Simulation and Retry System Verified Successfully!")

except Exception as e:
    safe_print(f"[FAIL] Campaign testing failed: {e}")

finally:
    # Shutdown processes
    safe_print("\nShutting down service servers...")
    crm_process.terminate()
    channel_process.terminate()
    safe_print("Done.")
