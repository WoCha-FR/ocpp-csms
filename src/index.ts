import { OCPPCSMS } from './csms.js';

const config = {
  port: parseInt(process.env.PORT || '9000', 10),
  host: process.env.HOST || '0.0.0.0',
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '60000', 10),
  maxConnections: parseInt(process.env.MAX_CONNECTIONS || '1000', 10),
};

const csms = new OCPPCSMS(config);

console.log(`OCPP CSMS server started on ${config.host}:${config.port}`);
console.log(`Max connections: ${config.maxConnections}`);
console.log(`Heartbeat interval: ${config.heartbeatInterval}ms`);

process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await csms.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await csms.close();
  process.exit(0);
});
