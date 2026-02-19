import conf from 'config'
import http from 'http'
import { RPCServer, createRPCError } from 'ocpp-rpc'
import logger from '../helpers/logger.js'
import CSMSDB from '../datas/csms-db.js'
import utils from '../helpers/utils.js'
import * as OCPPFunc from './ocppfunc.js'
import * as OCPP16Func from './ocpp16func.js'

class srvWS16 {
  constructor() {
    this.log = logger.child({ childLabel: 'OCPPWS16' })
    this.server = undefined
    this.httpServer = undefined
    this.PendingCB = OCPPFunc.ocppPendings
  }

  async initServer() {
    // Log
    this.log.info('Initializing OCPP 1.6 Websocket Server...')
    // RPC Server
    this.server = new RPCServer({
      protocols: ['ocpp1.6'],
      strictMode: true,
      callTimeoutMs: 10000,
    })
    // http Server for OCPP WS
    this.httpServer = http.createServer()
    this.httpServer.on('upgrade', this.server.handleUpgrade)
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
    this.log.info('OCPP 1.6 Websocket Server initialized')
  }

  async authChargeBox(accept, reject, handshake) {
    const cbox = await CSMSDB.getCBAuth(handshake.identity)
    // AutoAdd
    if (!cbox && conf.get('ocpp.autoadd')) {
      // Insert in DB
      let params = { ocppid: handshake.identity, cbname: handshake.identity, regstatus: 'Accepted' }
      let res = await CSMSDB.AutoAddChargeBox(params)
      if (res.error) {
        this.log.warn(`${handshake.identity}: Unable to add to DB`)
        reject(500, 'Internal Server Error')
      } else {
        // Accept
        this.log.debug(`${handshake.identity}: Automatically added`)
        accept({
          ocppid: handshake.identity,
          endpoint_address: handshake.remoteAddress,
          ocpp_protocol: handshake.headers['sec-websocket-protocol'],
        })
      }
      // Without AutoAdd
    } else {
      // Point de charge connu ?
      if (cbox) {
        // Without Profile 1 ?
        if (cbox.cb_pwd === null) {
          this.log.debug(`${handshake.identity}: Granted without security profile`)
          accept({
            ocppid: handshake.identity,
            endpoint_address: handshake.remoteAddress,
            ocpp_protocol: handshake.headers['sec-websocket-protocol'],
          })
          // With Profile 1
        } else {
          if (handshake.password) {
            if (cbox.cb_pwd === handshake.password.toString('utf8')) {
              this.log.debug(`${handshake.identity}: Granted with security profile 1`)
              accept({
                ocppid: handshake.identity,
                endpoint_address: handshake.remoteAddress,
                ocpp_protocol: handshake.headers['sec-websocket-protocol'],
              })
            } else {
              this.log.info(`${handshake.identity}: Wrong password`)
              reject(401, 'Unauthorized')
            }
          } else {
            this.log.info(`${handshake.identity}: Password not provided`)
            reject(401, 'Unauthorized')
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
  }

  async Start() {
    this.httpServer.listen(conf.get('ocpp.portws'), conf.get('ocpp.listenip'))
    this.log.info(`OCPP 1.6 Websocket Server started on ${conf.get('ocpp.listenip')}:${conf.get('ocpp.portws')}`)
  }

  async Stop() {
    await this.server.close({ code: 1012, awaitPending: true })
    this.httpServer.close()
    this.log.info('OCPP 1.6 Websocket Server stopped')
  }
}

export default new srvWS16()