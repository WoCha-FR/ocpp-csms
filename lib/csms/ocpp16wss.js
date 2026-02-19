import conf from 'config'
import https from 'https'
import { RPCServer, createRPCError } from 'ocpp-rpc'
import { readFile } from 'fs/promises'
import logger from '../helpers/logger.js'
import CSMSDB from '../datas/csms-db.js'
import utils from '../helpers/utils.js'
import * as OCPPFunc from './ocppfunc.js'
import * as OCPP16Func from './ocpp16func.js'

class srvWSS16 {
  constructor() {
    this.log = logger.child({ childLabel: 'OCPPWSS16' })
    this.server = undefined
    this.httpsServer = undefined
    this.PendingCB = OCPPFunc.ocppPendings
  }

  async initServer() {
    // Log
    this.log.info('Initializing OCPP 1.6 Websocket Secure Server...')
    // RPC Server
    this.server = new RPCServer({
      protocols: ['ocpp1.6'],
      strictMode: true,
      callTimeoutMs: 10000,
    })
    // https Server for OCPP WSS
    this.httpsServer = https.createServer({
      cert: [
        await readFile(utils.rootdir + '/datas/wsscerts/server_rsa.crt', 'utf8'), // RSA certificate
        await readFile(utils.rootdir + '/datas/wsscerts/server_ec.crt', 'utf8'), // ECDSA certificate
      ],
      key: [
        await readFile(utils.rootdir + '/datas/wsscerts/server_rsa.key', 'utf8'), // RSA key
        await readFile(utils.rootdir + '/datas/wsscerts/server_ec.key', 'utf8'), // ECDSA key
      ],
      minVersion: 'TLSv1.2', // require TLS >= v1.2
    })
    this.httpsServer.on('upgrade', this.server.handleUpgrade)
    // RPC Server Events
    this.server.on('error', (error) => {
      this.log.warn(`RPCServer error ${error}`)
    })
    this.server.on('upgradeAborted', (identity) => {
      this.log.warn(`upgradeAborted ${identity.identity} : ${identity.error}`)
    })
    // RPC Server Auth
    this.server.auth(this.authChargeBox.bind(this))
    // RPC Server on Client Connect
    this.server.on('client', async (client) => {
      // Client Connection
      await CSMSDB.setChargeBoxOnOffLine(client.identity, 1)
      if (!OCPPFunc.ocppClients.has(client.identity)) {
        OCPPFunc.ocppClients.set(client.identity, client)
        this.log.debug(`Station ${client.identity} connected`)
        // delete form pendings
        await this.PendingCB.read()
        const { pendings } = this.PendingCB.data
        if (pendings.find((cb) => cb.id === client.identity) !== undefined) {
          const index = pendings.findIndex((cb) => cb.id === client.identity)
          await this.PendingCB.update(({ pendings }) => pendings.splice(index, 1))
        }
        // Emit event
        utils.event.emit('cbOnline', client.identity)
      }
      // Client Disconnection
      client.once('close', async ({ code, reason }) => {
        if (OCPPFunc.ocppClients.get(client.identity) === client) {
          OCPPFunc.ocppClients.delete(client.identity)
          await CSMSDB.setChargeBoxOnOffLine(client.identity, 0)
          // Emit event
          utils.event.emit('cbOffline', client.identity)
          this.log.debug(`${client.identity} disconnected!`)
          this.log.debug(`CLOSE: ${code}: ${reason}`)
        }
      })
      // handler for BootNotification
      client.handle('BootNotification', OCPP16Func.cbBootNotif.bind(this, client))
      // handler for StatusNotification
      client.handle('StatusNotification', OCPP16Func.cbStatusNotif.bind(this, client))
      // handler for HeartBeat
      client.handle('Heartbeat', OCPP16Func.cbHeartBeat.bind(this, client))
      // handler for Authorize
      client.handle('Authorize', OCPP16Func.cbAuthorize.bind(this, client))
      // handler for StartTransaction
      client.handle('StartTransaction', OCPP16Func.cbStartTransaction.bind(this, client))
      // handler for StopTransaction
      client.handle('StopTransaction', OCPP16Func.cbStopTransaction.bind(this, client))
      // handler for MeterValues
      client.handle('MeterValues', OCPP16Func.cbMeterValues.bind(this, client))
      // Handler for DiagnosticsStatusNotification
      client.handle('DiagnosticsStatusNotification', OCPP16Func.cbDiagnosticsStatusNotif.bind(this, client))
      // LOG MESSAGES
      client.on('callResult', OCPPFunc.callResult.bind(this, client))
      client.on('callError', OCPPFunc.callError.bind(this, client))
      client.on('strictValidationFailure', OCPPFunc.svFailure.bind(this, client))
      // create a wildcard handler to handle any RPC method
      client.handle(({ method, params }) => {
        // This handler will be called if the incoming method cannot be handled elsewhere.
        this.log.warn(`Server got ${method} from ${client.identity}: ${JSON.stringify(params)}`)
        // throw an RPC error to inform the server that we don't understand the request.
        throw createRPCError('NotImplemented')
      })
      // Autres events
      client.on('ping', ({ rtt }) => {
        this.log.silly(`${client.identity} ping: ${rtt} ms`)
      })
      client.on('badMessage', ({ buffer, error, response }) => {
        this.log.debug(`Bad Message ${client.identity}: ${buffer}`, `${error}`, `${response}`)
      })
      client.on('socketError', (error) => {
        this.log.debug(`socketError ${client.identity}: ${error}`)
      })
      client.on('disconnect', ({ code, reason }) => {
        this.log.debug(`Disconnect ${client.identity} - ${code}: ${reason}`)
      })
      client.on('connecting', () => {
        this.log.debug(`Connecting ${client.identity}`)
      })
      client.on('open', (response) => {
        this.log.debug(`open ${client.identity} : ${response}`)
      })
    })
    this.log.info('OCPP 1.6 Websocket Secure Server initialized')
  }

  async authChargeBox(accept, reject, handshake) {
    // TLS client info
    const tlsClient = handshake.request.client
    if (!tlsClient) {
      this.log.warn(`${handshake.identity} rejected: no TLS client`)
      return reject(400, 'not a TLS client')
    }
    // Authorize ChargeBox
    const cbox = await CSMSDB.getCBAuth(handshake.identity)
    if (cbox) {
      if (cbox.cb_pwd === null) {
        this.log.warn(`${handshake.identity} rejected: no password set for this ChargeBox`)
        reject(409, 'No password set for this ChargeBox')
      } else {
        if (handshake.password) {
          if (cbox.cb_pwd === handshake.password.toString('utf8')) {
            this.log.debug(`${handshake.identity} granted with security profile 2`)
            accept({
              ocppid: handshake.identity,
              endpoint_address: handshake.remoteAddress,
              ocpp_protocol: handshake.headers['sec-websocket-protocol'],
            })
          } else {
            this.log.warn(`${handshake.identity} rejected: wrong password`)
            reject(401, 'Unauthorized')
          }
        } else {
          this.log.warn(`${handshake.identity} rejected: password not provided`)
          reject(400, 'Password not provided')
        }
      }
    } else {
      // Add or Update Pending
      await this.PendingCB.read()
      const { pendings } = this.PendingCB.data
      if (pendings.find((cb) => cb.id === handshake.identity) === undefined) {
        await this.PendingCB.update(({ pendings }) =>
          pendings.push({ id: handshake.identity, try: 1, last: Math.floor(Date.now() / 1000) })
        )
      } else {
        const index = pendings.findIndex((cb) => cb.id === handshake.identity)
        const olddata = pendings[index]
        await this.PendingCB.update(({ pendings }) =>
          pendings.splice(index, 1, { id: olddata.id, try: olddata.try + 1, last: Math.floor(Date.now() / 1000) })
        )
      }
      // Reject
      reject(401, 'Unauthorized')
    }
  }

  async Start() {
    this.httpsServer.listen(conf.get('ocpp.portwss'), conf.get('ocpp.listenip'))
    this.log.info(`OCPP 1.6 Websocket Secure Server started on ${conf.get('ocpp.listenip')}:${conf.get('ocpp.portwss')}`)
  }

  async Stop() {
    await this.server.close({ code: 1012, awaitPending: true })
    this.httpsServer.close()
    this.log.info('OCPP 1.6 Websocket Secure Server stopped')
  }
}

export default new srvWSS16()