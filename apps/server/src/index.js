require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { initDb } = require('./db/schema');
const authRoutes = require('./routes/auth');
const sessionsRoutes = require('./routes/sessions');
const initSocket = require('./socket');
const config = require('./config');

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());

app.get('/source', (_req, res) => {
  if (!config.sourceCodeUrl) {
    return res.status(503).json({ error: 'SOURCE_CODE_URL is not configured' });
  }
  res.redirect(302, config.sourceCodeUrl);
});

initDb();

app.use('/auth', authRoutes);
app.use('/sessions', sessionsRoutes);

initSocket(server);

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
});
