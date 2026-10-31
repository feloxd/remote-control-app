const { io } = require('socket.io-client');

const baseUrl = process.env.TEST_SERVER_URL || 'http://127.0.0.1:3001';
const username = process.env.TEST_OPERATOR_USERNAME;
const password = process.env.TEST_OPERATOR_PASSWORD;

if (!username || !password) {
  throw new Error('TEST_OPERATOR_USERNAME and TEST_OPERATOR_PASSWORD are required');
}

function waitFor(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload) => { clearTimeout(timer); resolve(payload); });
  });
}

async function run() {
  const login = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const { token } = await login.json();
  if (!token) throw new Error(`Login failed with ${login.status}`);

  const created = await fetch(`${baseUrl}/sessions/create`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  const { code } = await created.json();
  if (!code) throw new Error('Session creation failed');

  const dash = io(`${baseUrl}/dash`, { auth: { token }, transports: ['websocket'] });
  const client = io(`${baseUrl}/client`, { transports: ['websocket'] });
  await Promise.all([waitFor(dash, 'connect'), waitFor(client, 'connect')]);
  dash.emit('join_session', code);
  await waitFor(dash, 'session_joined');
  client.emit('join_client', { code });
  await waitFor(client, 'session_joined');

  const expected = Buffer.from('relay smoke transfer', 'utf8');
  const received = [];
  const transferId = 'relay-smoke-001';
  client.on('file_transfer_chunk', ({ data }) => received.push(Buffer.from(data)));
  client.on('file_transfer_end', ({ transferId: completedId }) => {
    const actual = Buffer.concat(received);
    client.emit('file_transfer_status', actual.equals(expected)
      ? { transferId: completedId, state: 'complete', name: 'relay.txt', size: actual.length }
      : { transferId: completedId, state: 'error', error: 'Relay payload mismatch' });
  });

  const completion = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for transfer completion')), 5000);
    dash.on('file_transfer_status', (status) => {
      if (status.transferId !== transferId || !['complete', 'error'].includes(status.state)) return;
      clearTimeout(timer);
      if (status.state === 'error') reject(new Error(status.error));
      else resolve(status);
    });
  });

  dash.emit('file_transfer_start', { transferId, name: '../relay.txt', size: expected.length, mime: 'text/plain' });
  dash.emit('file_transfer_chunk', { transferId, index: 0, data: expected });
  dash.emit('file_transfer_end', { transferId });
  const result = await completion;
  dash.disconnect();
  client.disconnect();
  console.log(JSON.stringify({ success: true, codeLength: code.length, name: result.name, bytes: result.size }));
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
