import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 6000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[Channel Service] ${req.method} ${req.path}`);
  next();
});

// Send API: accepts sending campaigns in simulated asynchronous behavior
app.post('/api/channel/send', (req, res) => {
  const { logId, recipient, message, callbackUrl } = req.body;

  if (!logId || !recipient || !message || !callbackUrl) {
    return res.status(400).json({ error: "Missing required fields (logId, recipient, message, callbackUrl)." });
  }

  console.log(`[Channel Service] Queued message for ${recipient}: "${message.substring(0, 40)}..."`);

  // Respond immediately to simulate asynchronous message queuing
  res.json({ success: true, status: "Queued", logId });

  // Trigger asynchronous simulated state updates
  setTimeout(async () => {
    // 10% chance of Failure, 90% chance of Delivery success
    const isSuccess = Math.random() > 0.10;
    const firstStatus = isSuccess ? 'Delivered' : 'Failed';

    try {
      console.log(`[Channel Service Async] Callback for log ${logId} -> ${firstStatus}`);
      await axios.post(callbackUrl, {
        logId,
        status: firstStatus,
        timestamp: new Date()
      });

      // If delivered successfully, evaluate if the user reads the message
      if (isSuccess) {
        setTimeout(async () => {
          // 80% chance of being Read
          const isRead = Math.random() > 0.20;
          if (isRead) {
            try {
              console.log(`[Channel Service Async] Callback for log ${logId} -> Read`);
              await axios.post(callbackUrl, {
                logId,
                status: 'Read',
                timestamp: new Date()
              });

              // If read, evaluate if the user opens the message
              setTimeout(async () => {
                // 60% chance of being Opened
                const isOpened = Math.random() > 0.40;
                if (isOpened) {
                  try {
                    console.log(`[Channel Service Async] Callback for log ${logId} -> Opened`);
                    await axios.post(callbackUrl, {
                      logId,
                      status: 'Opened',
                      timestamp: new Date()
                    });

                    // If opened, evaluate if user clicks links
                    setTimeout(async () => {
                      // 30% chance of being Clicked
                      const isClicked = Math.random() > 0.70;
                      if (isClicked) {
                        try {
                          console.log(`[Channel Service Async] Callback for log ${logId} -> Clicked`);
                          await axios.post(callbackUrl, {
                            logId,
                            status: 'Clicked',
                            timestamp: new Date()
                          });
                        } catch (err) {
                          console.error(`[Channel Service Click Callback Error] for log ${logId}:`, err.message);
                        }
                      }
                    }, 1000);

                  } catch (err) {
                    console.error(`[Channel Service Open Callback Error] for log ${logId}:`, err.message);
                  }
                }
              }, 1000);

            } catch (err) {
              console.error(`[Channel Service Read Callback Error] for log ${logId}:`, err.message);
            }
          }
        }, 1000);
      }
    } catch (err) {
      console.error(`[Channel Service Delivery Callback Error] for log ${logId}:`, err.message);
    }
  }, 1000);
});

app.listen(PORT, () => {
  console.log(`📡 Channel Service Simulator running at http://localhost:${PORT}`);
});
