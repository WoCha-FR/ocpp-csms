import { RPCServer, createRPCError } from 'ocpp-rpc'
import { JSONFilePreset } from 'lowdb/node'
import utils from '../helpers/utils.js'
import sqlite from '../datas/db.js'
import Log from 'debug-level'

export default new class CSMS {
  constructor () {
    this.log
    this.server = new RPCServer({
      protocols: ['ocpp1.6'], // server accepts ocpp1.6 subprotocol
      strictMode: true,       // enable strict validation of requests & responses
      callTimeoutMs: 10000
    })
    this.ocppClients = new Map()
  }

  async initServer () {
    // Logger
    this.log = new Log('ocpp', { level: utils.config().ocpp.loglvl })
    // Init Pending DB
    this.PendingCB = await JSONFilePreset(utils.rootdir() + '/datas/pendings.json', { pendings: [] })
    // Server Auth
    this.server.auth( async(accept, reject, handshake) => {
      const cbox = await sqlite.getCBAuth(handshake.identity)
      // AutoAdd
      if (!cbox && utils.config().ocpp.autoadd) {
        // Insert in DB
        let params = {
          ocppid : handshake.identity,
          cbname: handshake.identity,
          regstatus: 'Accepted'
        }
        let res = await sqlite.AutoAddChargeBox(params)
        if (res.error) {
          this.log.warn(`${handshake.identity}: Unable to add to DB`)
          reject(500, 'Internal Server Error')
        } else {
          // Accept
          this.log.debug(`${handshake.identity}: Automatically added`)
          accept({
            ocppid: handshake.identity,
            endpoint_address: handshake.remoteAddress,
            ocpp_protocol: handshake.headers['sec-websocket-protocol']
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
              ocpp_protocol: handshake.headers['sec-websocket-protocol']
            })
          // With Profile 1
          } else {
            if ( handshake.password ) {
              if ( cbox.cb_pwd === handshake.password.toString('utf8')) {
                this.log.debug(`${handshake.identity}: Granted with security profile 1`)
                accept({
                  ocppid: handshake.identity,
                  endpoint_address: handshake.remoteAddress,
                  ocpp_protocol: handshake.headers['sec-websocket-protocol']
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
            await this.PendingCB.update(({pendings}) => pendings.push({id: handshake.identity, try: 1, last: Math.floor(Date.now() / 1000)}))
          } else {
            const index = pendings.findIndex((cb) => cb.id === handshake.identity)
            const olddata = pendings[index]
            await this.PendingCB.update(({pendings}) => pendings.splice(index, 1, {id: olddata.id, try: olddata.try+1, last: Math.floor(Date.now() / 1000)}))
          }
          // Reject
          reject(401, 'Unauthorized')
        }
      }
    })
    this.server.on('error', (error) => {
      this.log.warn(`RPCServer error ${error}`)
    })
    this.server.on('upgradeAborted', (identity, error) => {
      this.log.warn(`upgradeAborted ${error}`, JSON.stringify(identity))
    })
    // Create Chargebox messages listeners
    this.server.on('client', async (client) => {
      // Client Connection
      await sqlite.setChargeBoxOnOffLine(client.identity, 1)
      if (!this.ocppClients.has(client.identity)) {
        this.ocppClients.set(client.identity, client)
        this.log.debug('Station ' + client.identity + ' connected')
        // delete form pendings
        await this.PendingCB.read()
        const { pendings } = this.PendingCB.data
        if (pendings.find((cb) => cb.id === client.identity) !== undefined) {
          const index = pendings.findIndex((cb) => cb.id === client.identity)
          await this.PendingCB.update( ({pendings}) => pendings.splice(index, 1) )
        }
      }
      // Client Disconnection
      client.once('close', async({code, reason}) => {
        if (this.ocppClients.get(client.identity) === client) {
          this.ocppClients.delete(client.identity)
          await sqlite.setChargeBoxOnOffLine(client.identity, 0)
          this.log.debug(`${client.identity} disconnected!`)
          this.log.debug(`CLOSE: ${code}: ${reason}`)
        }
      })
      // LOG MESSAGES
      client.on('callResult', ({outbound, method, params, result}) => {
        // Vars
        let log_ts = Math.floor(Date.now())
        // Out = false => params = Request in  / result = Response out
        if (outbound === false) {
          let input = {
            ocppid: client.identity, ts: log_ts, direction: 'IN',
            type: 'REQUEST', methode: method, message: JSON.stringify(params)
          }
          let output = {
            ocppid: client.identity, ts: log_ts, direction: 'OUT',
            type: 'RESPONSE', methode: method, message: JSON.stringify(result)
          }
          let data = [input, output]
          sqlite.addToLog(data)
          this.log.debug(JSON.stringify(input),JSON.stringify(output))
        }
        // Out = true  => params = Request out / result = Response in
        if (outbound === true) {
          let output = {
            ocppid: client.identity, ts: log_ts, direction: 'OUT',
            type: 'REQUEST', methode: method, message: JSON.stringify(params)
          }
          let input = {
            ocppid: client.identity, ts: log_ts, direction: 'IN',
            type: 'RESPONSE', methode: method, message: JSON.stringify(result)
          }
          let data = [input, output]
          sqlite.addToLog(data)
          this.log.debug(JSON.stringify(input),JSON.stringify(output))
        }
      })
      client.on('callError', ({error, outbound, method}) => {
        let log_ts = Math.floor(Date.now())
        if (error.rpcErrorMessage === undefined) {
          let errorCall = {
            ocppid: client.identity, ts: log_ts, methode: method,
            direction: outbound ? 'OUT' : 'IN', type: 'CALLERROR',
            message: `${error}`
          }
          sqlite.addToLog([errorCall])
          this.log.debug(JSON.stringify(errorCall))
        }
      })
      client.on('strictValidationFailure', ({outbound, isCall, method, error}) => {
        let log_ts = Math.floor(Date.now())
        let errorCall = {
          ocppid: client.identity, ts: log_ts, methode: method,
          direction: outbound ? 'OUT' : 'IN',
          type: isCall ? 'REQUEST' : 'RESPONSE',
          message: `${error}`
        }
        sqlite.addToLog([errorCall])
        this.log.debug(JSON.stringify(errorCall))
      })
      client.on('ping', ({rtt}) => {
        this.log.trace(`${client.identity} ping: ${rtt} ms`)
      })
      client.on('badMessage', ({buffer, error, response}) => {
        this.log.debug(`Bad Message ${client.identity}: ${buffer}`,`${error}`,`${response}`)
      })
      client.on('socketError', (error) => {
        this.log.debug(`socketError ${client.identity}: ${error}`)
      })
      client.on('disconnect', ({code, reason}) => {
        this.log.debug(`Disconnect ${client.identity}: ${code}: ${reason}`)
      })
      client.on('connecting', () => {
        this.log.debug(`Connecting ${client.identity}`)
      })
      client.on('open', (response) => {
        this.log.debug(`open ${client.identity} : ${response}`)
      })
      ///////////////////////////////////////////////////////////////////
      // handler for BootNotification
      client.handle('BootNotification', async ({params, reply}) => {
        this.log.debug(`Server got BootNotification from ${client.identity}`)
        // Boot Info du Point de charge
        const cbox = sqlite.getCBRegStatus(client.identity)
        if (cbox) {
          // Update DB with BootNotif informations
          let res = sqlite.updChargeBoxBootNotif(client.session, params)
          if (res) {
            this.log.debug(`${client.identity}: BootNotification saved`)
          }
          // Update Last Boot Notif
          let upd = sqlite.updLastBoot(client.identity)
          if (upd) {
            this.log.debug(`${client.identity}: LastBootTime saved`)
          }
          // Return to client
          reply({
            status: cbox.registration_status, // Accepted, Pending, Rejected
            interval: parseInt(utils.config().ocpp.heartbeat),
            currentTime: new Date().toISOString()
          })
          // TODO : BUG Automatic configuration & request
          /*
          if (cbox.registration_status === 'Accepted') {
            // Set default OCPP Keys
            let autoconfs = await sqlite.getOcppDefaultConfig()
            for (const config of autoconfs) {
              const response = await client.call('ChangeConfiguration', {key: config.key, value: config.value})
              if (response.status === 'Accepted') {
                let ocppconfig = {
                  id: client.identity,
                  key: config.key,
                  value: config.value,
                  readonly: 0
                }
                const result = await sqlite.setCBDefaultOcppKey(ocppconfig)
                if (result.error) {
                  this.log.warn(result.error)
                }
              }
            }
            // Get MeterValues
            await client.call('TriggerMessage', {requestedMessage: 'MeterValues' })
          }*/
        } else {
          client.close({code: 1011, reason: 'Not found in system'})
        }
      })
      ///////////////////////////////////////////////////////////////////
      // handler for StatusNotification
      client.handle('StatusNotification', async ({params, reply}) => {
        this.log.debug(`StatusNotification from ${client.identity} - connector ${params.connectorId}`)
        // Update DB
        let res = sqlite.updConnectorStatus(client.identity, params)
        if (res) {
          this.log.debug(`${client.identity}: Connector ${params.connectorId} saved`)
        }
        // Send response
        reply({})
        // TODO: Status Preparing & Charger in autostart mode
        /*
        if (params.connectorId > 0 && params.status === 'Preparing') {
          let res = await sqlite.getChargeBoxAuthMode(client.identity)
          if (res) {
            const response = await client.call('RemoteStartTransaction', {
              connectorId: parseInt(params.connectorId),
              idTag: 'FromOcppCsms'
            })
            this.log.debug('AutoStartTransaction Request: ' + JSON.stringify(response))
          }
        }
        */
      })
      ///////////////////////////////////////////////////////////////////
      // handler for HeartBeat
      client.handle('Heartbeat', () => {
        this.log.debug(`Heartbeat from ${client.identity}`)
        // Update DB
        let res = sqlite.updHeartBeat(client.identity)
        if (res) {
          this.log.debug(`${client.identity}: Heartbeat saved`)
        }
        // Send Response
        return { currentTime: new Date().toISOString() }
      })
      ///////////////////////////////////////////////////////////////////
      // handler for Authorize
      client.handle('Authorize', async({params}) => {
        this.log.debug(`Authorize from ${client.identity} - idTag ${params.idTag}`)
        let expiry = new Date(Date.now() + 86400000).toISOString()
        // Launched from WebApplication
        if (params.idTag === 'FromOcppCsms') {
          return {idTagInfo: {status: 'Accepted', expiryDate: expiry} }
        } else {
          let result = await sqlite.getAuthorizeResponse(client.identity, params.idTag)
          return {idTagInfo: result}
        }
      })
      ///////////////////////////////////////////////////////////////////
      // handler for StartTransaction
      client.handle('StartTransaction', async ({params}) => {
        this.log.debug(`StartTransaction from ${client.identity} - connector ${params.connectorId}`)
        // Get IdTagInfo data
        let result
        if (params.idTag === 'FromOcppCsms') {
          let expiry = new Date(Date.now() + 86400000).toISOString()
          result = { status: 'Accepted', expiryDate: expiry }
        } else {
          result = await sqlite.getAuthorizeResponse(client.identity, params.idTag)
        }
        // Get Transaction ID
        let transId = await sqlite.generateTransactionId()
        if (transId === false) {
          this.log.warn(`StartTransaction from ${client.identity} - generateTransactionId Error`)
          return {idTagInfo: { status: 'Invalid' }, transactionId: Math.floor(Date.now() / 1000)}
        }
        // Format data
        let transacParams = {
          tpk: transId,
          ocppid: client.identity,
          conid: params.connectorId,
          idtag: params.idTag,
          meter: params.meterStart,
          start: (Date.parse(new Date(params.timestamp)) / 1000),
          status: result.status
        }
        // Create Transaction in DB
        let insert = await sqlite.addTransaction(transacParams)
        if (insert === false) {
          this.log.warn(`Transaction ${transId} - addTransaction Error`)
          return {idTagInfo: { status: 'Invalid' }, transactionId: transId}
        }
        this.log.info(`Transaction ${transId} started in ${client.identity}`)
        return {idTagInfo: result , transactionId: transId}
        // Accepted / Blocked / Expired / Invalid / ConcurrentTx
      })
      ///////////////////////////////////////////////////////////////////
      // handler for StopTransaction
      client.handle('StopTransaction', async ({params, reply}) => {
        this.log.debug(`StopTransaction from ${client.identity} - transaction ${params.transactionId}`)
        // Format data
        let transacParams = {
          tpk: params.transactionId,
          meter: params.meterStop,
          stop: (Date.parse(new Date(params.timestamp)) / 1000),
          reason: params.reason || null,
          power: null
        }
        let stop = await sqlite.stopTransaction(transacParams)
        if ( stop === false ) {
          this.log.warn('Error stopping Transaction: ' + JSON.stringify(params))
        }
        reply({})
      })
      ///////////////////////////////////////////////////////////////////
      // handler for MeterValues
      client.handle('MeterValues', async ({params, reply}) => {
        this.log.debug(`MeterValues from ${client.identity} - connector ${params.connectorId}`)
        // Send response
        reply({})
        // Work With meterValue
        let meters = params.meterValue
        let values = {
          cbid: client.identity,
          cnid: params.connectorId,
          energy: null,
        }
        if (meters.length > 1) {
          let e1 = meters.find( s => s.sampledValue[0].measurand === 'Energy.Active.Import.Register')
          if (e1) {
            // Get Unit
            if (e1.sampledValue[0].unit.toUpperCase() === 'KWH') {
              values.energy = parseFloat(e1.sampledValue[0].value * 1000)
            } else {
              values.energy = parseFloat(e1.sampledValue[0].value)
            }
          }
        } else {
          let e1 = meters[0].sampledValue.find( s => s.measurand ==  'Energy.Active.Import.Register')
          if (e1) {
            // Get Unit
            if (e1.unit.toUpperCase() === 'KWH') {
              values.energy = parseFloat(e1.value * 1000)
            } else {
              values.energy = parseFloat(e1.value)
            }
          }
        }
        // Store in DB : Connector meter value
        await sqlite.updMeterValues(values)
        // MeterValues from Transaction
        if (params.transactionId !== undefined) {
          values.tpk = params.transactionId
          values.power = null
          if (meters.length > 1) {
            let p1 = meters.find( s => s.sampledValue[0].measurand === 'Power.Active.Import')
            if (p1) {
              // Get Unit
              if (p1.sampledValue[0].unit.toUpperCase() === 'KW') {
                values.power = parseFloat(p1.sampledValue[0].value * 1000)
              } else {
                values.power = parseFloat(p1.sampledValue[0].value)
              }
            }
          } else {
            let p1 = meters[0].sampledValue.find( s => s.measurand ==  'Power.Active.Import')
            if (p1) {
              // Get Unit
              if (p1.unit.toUpperCase() === 'KW') {
                values.power = parseFloat(p1.value * 1000)
              } else {
                values.power = parseFloat(p1.value)
              }
            }
          }
          // Store in DB : Transaction meter value
          await sqlite.updTransactionMeterValues(values)
        }
      })
      ///////////////////////////////////////////////////////////////////
      // Handler for DiagnosticsStatusNotification
      client.handle('DiagnosticsStatusNotification', async ({params}) => {
        this.log.debug(`DiagnosticsStatusNotification from ${client.identity} - status ${params.status}`)
        // Status : Idle / Uploaded / UploadFailed / Uploading
        return {}
      })
      ///////////////////////////////////////////////////////////////////
      // create a wildcard handler to handle any RPC method
      client.handle(({method, params}) => {
        // This handler will be called if the incoming method cannot be handled elsewhere.
        this.log.warn(`Server got ${method} from ${client.identity}:`, params);
        // throw an RPC error to inform the server that we don't understand the request.
        throw createRPCError('NotImplemented');
      })
    })
    this.log.log('CSMS configured')
  }
  /* WEB UI ADMIN ACTION */
  async TriggerMessage(params) {
    const client = this.ocppClients.get(params.ocppName)
    if (client) {
      try {
        const response = await client.call('TriggerMessage', {requestedMessage: params.message } )
        this.log.debug('TriggerMessage Request: ' + JSON.stringify(response))
        return response
      } catch ( err ) {
        this.log.warn('TriggerMessage Request: ' + err)
        return { status: `${err}` }
      }
    } else {
      return { status: 'Station offline ?' }
    }
  }
  async GetConfiguration(ocppid) {
    const client = this.ocppClients.get(ocppid)
    let response
    if (client) {
      try {
        response = await client.call('GetConfiguration', {})
      } catch ( err ) {
        this.log.warn('GetConfiguration Request: ' + err)
        return { status: `${err}` }
      }
      let result = await sqlite.setChargeBoxConfigKeys(ocppid, response)
      return result
    } else {
      return { status: 'Station offline ?' }
    }
  }
  async SetConfiguration(params) {
    const client = this.ocppClients.get(params.ocppName)
    if (client) {
      try {
        const response = await client.call('ChangeConfiguration', {key: params.key, value: params.value})
        this.log.debug('ChangeConfiguration Request: ' + JSON.stringify(response))
        // DB Update if needed
        let dbresult = {}
        if (response.status === 'Accepted') {
          const result = await sqlite.updChargeBoxConfigKey(params)
          if (result.error) {
            dbresult = { ocppErrors : { sqlite: [{sqlerror: `${result.error}`}] } }
          }
        }
        const mergedRes = Object.assign({}, { ocppResult: response }, dbresult)
        return mergedRes
      } catch ( err ) {
        this.log.warn('ChangeConfiguration Request: ' + err)
        return { ocppResult: { status: `${err}` } }
      }
    } else {
      return { ocppResult: { status: 'Station offline ?' } }
    }
  }
  /* WEB UI ACTION : Granted Users */
  async ResetChargeBox(params) {
    const client = this.ocppClients.get(params.ocppName)
    if (client) {
      try {
        // Type Hard or Soft
        const response = await client.call('Reset', {type: params.rebootType})
        this.log.debug('ResetChargeBox Request: ' + JSON.stringify(response))
        return response
      } catch( err ) {
        this.log.warn('ResetChargeBox Request: ' + err)
        return { status: `${err}` }
      }
    } else {
      return { status: 'Station offline ?' }
    }
  }
  async ChangeAvailability(params) {
    const client = this.ocppClients.get(params.ocppName)
    if (client) {
      try {
        const response = await client.call('ChangeAvailability', { type: params.type, connectorId: parseInt(params.cn_id)})
        this.log.debug('ChangeAvailability Request: ' + JSON.stringify(response))
        return response
      } catch( err ) {
        this.log.warn('ChangeAvailability Request: ' + err)
        return { status: `${err}` }
      }
    } else {
      return { status: 'Station offline ?' }
    }
  }
  /* WEB UI ACTION : All Users */


  /* A REVALIDER */
  async GetDiagnostics(params) {
    const client = this.ocppClients.get(params.ocppName)
    if (client) {
      try {
        const response = await client.call('GetDiagnostics', {location: params.url} )
        this.log.info('GetDiagnostics Request: ' + JSON.stringify(response))
        return response
      } catch ( err ) {
        this.log.warn('GetDiagnostics Request: ' + err)
        return { fileName: err }
      }
    } else {
      return { fileName: 'Station offline ?' }
    }
  }
  async UnlockConnector(params) {
    const client = this.ocppClients.get(params.ocppName)
    if (client) {
      try {
        const response = await client.call('UnlockConnector', {connectorId: parseInt(params.cn_id)} )
        this.log.debug('UnlockConnector Request: ' + JSON.stringify(response))
        return response
      } catch ( err ) {
        this.log.warn('UnlockConnector Request: ' + err)
        return { status: `${err}` }
      }
    } else {
      return { status: 'Station offline ?' }
    }
  }
  async RemoteStartTransaction(params) {
    const client = this.ocppClients.get(params.ocppName)
    if (client) {
      try {
        const response = await client.call('RemoteStartTransaction', {
          connectorId: parseInt(params.cn_id),
          idTag: params.idTag
        })
        this.log.debug('RemoteStartTransaction Request: ' + JSON.stringify(response))
        return response
      } catch ( err ) {
        this.log.warn('RemoteStartTransaction Request: ' + err)
        return { status: `${err}` }
      }
    } else {
      return { status: 'Station offline ?' }
    }
  }
  async RemoteStopTransaction(params) {
    const client = this.ocppClients.get(params.ocppName)
    if (client) {
      try {
        const response = await client.call('RemoteStopTransaction', {transactionId: parseInt(params.transacId)} )
        this.log.debug('RemoteStopTransaction Request: ' + JSON.stringify(response))
        return response
      } catch ( err ) {
        this.log.warn('RemoteStopTransaction Request: ' + err)
        return { status: `${err}` }
      }
    } else {
      return { status: 'Station offline ?' }
    }
  }
  /* OTHERS */
  // Start function
  async Start () {
    await this.server.listen(utils.config().ocpp.portws, utils.config().ocpp.listenip)
    this.log.log('CSMS started on ' + utils.config().ocpp.listenip + ':' + utils.config().ocpp.portws)
  }
  // Stop Function
  async Stop () {
    await this.server.close({ code: 1012, awaitPending: true })
    this.log.log('CSMS stopped')
  }
  // Triggers
  // DiagnosticsStatusNotification - FirmwareStatusNotification
}()