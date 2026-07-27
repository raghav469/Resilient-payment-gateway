const express = require('express');
const morgan = require('morgan');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// States: 'healthy', 'failing', 'slow'
let providerState = 'healthy';

app.post('/charge', (req, res) => {
  const { amount, currency } = req.body;
  console.log(`[Mock Provider] Charge request: ${amount} ${currency} | State: ${providerState}`);

  if (providerState === 'failing') {
    return res.status(500).json({ error: 'Internal Server Error', message: 'Payment gateway is down' });
  }

  if (providerState === 'slow') {
    // Delay between 5 and 8 seconds
    const delay = Math.floor(Math.random() * 3000) + 5000;
    setTimeout(() => {
      res.status(200).json({
        status: 'success',
        transactionId: `txn_${Date.now()}`,
        amount,
        currency
      });
    }, delay);
    return;
  }

  // Healthy state
  res.status(200).json({
    status: 'success',
    transactionId: `txn_${Date.now()}`,
    amount,
    currency
  });
});

app.post('/admin/fail', (req, res) => {
  providerState = 'failing';
  console.log('[Mock Provider] State changed to FAILING');
  res.json({ message: 'State set to failing. All /charge calls will return 500.' });
});

app.post('/admin/slow', (req, res) => {
  providerState = 'slow';
  console.log('[Mock Provider] State changed to SLOW');
  res.json({ message: 'State set to slow. All /charge calls will take 5-8s.' });
});

app.post('/admin/recover', (req, res) => {
  providerState = 'healthy';
  console.log('[Mock Provider] State changed to HEALTHY');
  res.json({ message: 'State set to healthy. Back to normal behavior.' });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock Payment Provider running on port ${PORT}`);
});
