import { test } from 'node:test';
import assert from 'node:assert';
import { OCPPCSMS } from '../src/csms.js';
import WebSocket from 'ws';

test('OCPP CSMS - Server starts and accepts connections', async (t) => {
  const csms = new OCPPCSMS({ port: 9001, host: 'localhost' });

  await new Promise((resolve) => setTimeout(resolve, 100));

  const ws = new WebSocket('ws://localhost:9001/TEST_STATION_001');

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  assert.strictEqual(ws.readyState, WebSocket.OPEN, 'Connection should be open');

  const stations = csms.getConnectedStations();
  assert.strictEqual(stations.length, 1, 'Should have one connected station');
  assert.strictEqual(stations[0].id, 'TEST_STATION_001', 'Station ID should match');

  ws.close();
  await csms.close();
});

test('OCPP CSMS - Handles BootNotification', async (t) => {
  const csms = new OCPPCSMS({ port: 9002, host: 'localhost' });

  await new Promise((resolve) => setTimeout(resolve, 100));

  const ws = new WebSocket('ws://localhost:9002/TEST_STATION_002');

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  const bootNotification = [
    2,
    'unique-message-id-123',
    'BootNotification',
    {
      chargePointVendor: 'Test Vendor',
      chargePointModel: 'Test Model',
    },
  ];

  let responseReceived = false;
  ws.on('message', (data) => {
    const response = JSON.parse(data.toString());
    if (response[0] === 3) {
      responseReceived = true;
      assert.strictEqual(response[1], 'unique-message-id-123', 'Message ID should match');
      assert.strictEqual(response[2].status, 'Accepted', 'Status should be Accepted');
      assert.ok(response[2].currentTime, 'Should have currentTime');
      assert.ok(response[2].interval, 'Should have interval');
    }
  });

  ws.send(JSON.stringify(bootNotification));

  await new Promise((resolve) => setTimeout(resolve, 200));

  assert.ok(responseReceived, 'Should receive boot notification response');

  ws.close();
  await csms.close();
});

test('OCPP CSMS - Handles Heartbeat', async (t) => {
  const csms = new OCPPCSMS({ port: 9003, host: 'localhost' });

  await new Promise((resolve) => setTimeout(resolve, 100));

  const ws = new WebSocket('ws://localhost:9003/TEST_STATION_003');

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  const heartbeat = [2, 'heartbeat-123', 'Heartbeat', {}];

  let responseReceived = false;
  ws.on('message', (data) => {
    const response = JSON.parse(data.toString());
    if (response[0] === 3 && response[1] === 'heartbeat-123') {
      responseReceived = true;
      assert.ok(response[2].currentTime, 'Should have currentTime in response');
    }
  });

  ws.send(JSON.stringify(heartbeat));

  await new Promise((resolve) => setTimeout(resolve, 200));

  assert.ok(responseReceived, 'Should receive heartbeat response');

  ws.close();
  await csms.close();
});

test('OCPP CSMS - Rejects invalid station ID', async (t) => {
  const csms = new OCPPCSMS({ port: 9004, host: 'localhost' });

  await new Promise((resolve) => setTimeout(resolve, 100));

  const ws = new WebSocket('ws://localhost:9004/');

  await new Promise((resolve) => {
    ws.on('close', (code) => {
      assert.strictEqual(code, 1003, 'Should close with code 1003 for invalid station ID');
      resolve();
    });
  });

  await csms.close();
});

test('OCPP CSMS - Handles max connections', async (t) => {
  const csms = new OCPPCSMS({ port: 9005, host: 'localhost', maxConnections: 2 });

  await new Promise((resolve) => setTimeout(resolve, 100));

  const ws1 = new WebSocket('ws://localhost:9005/STATION_001');
  await new Promise((resolve) => ws1.on('open', resolve));

  const ws2 = new WebSocket('ws://localhost:9005/STATION_002');
  await new Promise((resolve) => ws2.on('open', resolve));

  const ws3 = new WebSocket('ws://localhost:9005/STATION_003');

  await new Promise((resolve) => {
    ws3.on('close', (code) => {
      assert.strictEqual(code, 1008, 'Should close with code 1008 when max connections reached');
      resolve();
    });
  });

  ws1.close();
  ws2.close();
  await csms.close();
});
