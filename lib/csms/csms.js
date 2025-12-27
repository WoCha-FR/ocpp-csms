import { RPCServer, createRPCError } from 'ocpp-rpc'
import { JSONFilePreset } from 'lowdb/node'
import utils from '../helpers/utils.js'
import CSMSDB from '../datas/csms-db.js'
import { Log } from 'debug-level'

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
    /*
    import fs from 'fs'
    const stream = fs.createWriteStream(utils.rootdir() + '/datas/ocpp.log')
    this.log = new Log('ocpp', {
      level: utils.config().ocpp.loglvl,
      colors: false,
      timestamp: 'epoch',
      stream
    })
    */
    this.log = new Log('ocpp', { level: utils.config().ocpp.loglvl })
    // Init Pending DB
    this.PendingCB = await JSONFilePreset(utils.rootdir() + '/datas/pendings.json', { pendings: [] })
    // Server Auth
    this.server.auth( async(accept, reject, handshake) => {
      const cbox = await CSMSDB.getCBAuth(handshake.identity)
      // AutoAdd
      if (!cbox && utils.config().ocpp.autoadd) {
        // Insert in DB
        let params = {
          ocppid : handshake.identity,
          cbname: handshake.identity,
          regstatus: 'Accepted'
        }
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
    this.server.on('upgradeAborted', (identity) => {
      this.log.warn(`upgradeAborted ${identity.identity}`, `${identity.error}`)
    })
    // Create Chargebox messages listeners
    this.server.on('client', async (client) => {
      // Client Connection
      await CSMSDB.setChargeBoxOnOffLine(client.identity, 1)
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
        // Emit event
        utils.event.emit('client_connected', client.identity)
      }
      // Client Disconnection
      client.once('close', async({code, reason}) => {
        if (this.ocppClients.get(client.identity) === client) {
          this.ocppClients.delete(client.identity)
          await CSMSDB.setChargeBoxOnOffLine(client.identity, 0)
          this.log.debug(`${client.identity} disconnected!`)
          this.log.debug(`CLOSE: ${code}: ${reason}`)
        }
      })
      // LOG MESSAGES
      client.on('callResult', ({outbound, method, params, result}) => {
        // Vars
        let log_ts1 = Math.floor(Date.now())
        let log_ts2 = log_ts1 + 1
        // Out = false => params = Request in  / result = Response out
        if (outbound === false) {
          let input = {
            ocppid: client.identity, ts: log_ts1, direction: 'IN',
            type: 'REQUEST', methode: method, message: JSON.stringify(params)
          }
          let output = {
            ocppid: client.identity, ts: log_ts2, direction: 'OUT',
            type: 'RESPONSE', methode: method, message: JSON.stringify(result)
          }
          let data = [input, output]
          CSMSDB.addToLog(data)
          this.log.debug(JSON.stringify(input),JSON.stringify(output))
        }
        // Out = true  => params = Request out / result = Response in
        if (outbound === true) {
          let output = {
            ocppid: client.identity, ts: log_ts1, direction: 'OUT',
            type: 'REQUEST', methode: method, message: JSON.stringify(params)
          }
          let input = {
            ocppid: client.identity, ts: log_ts2, direction: 'IN',
            type: 'RESPONSE', methode: method, message: JSON.stringify(result)
          }
          let data = [input, output]
          CSMSDB.addToLog(data)
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
          CSMSDB.addToLog([errorCall])
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
        CSMSDB.addToLog([errorCall])
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
        this.log.debug(`Disconnect ${client.identity} - ${code}: ${reason}`)
        utils.event.emit('client_disconnect', client.identity)
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
        const cbox = await CSMSDB.getCBRegStatus(client.identity)
        if (cbox) {
          // Return to client
          reply({
            status: cbox.registration_status, // Accepted, Pending, Rejected
            interval: parseInt(utils.config().ocpp.heartbeat),
            currentTime: new Date().toISOString()
          })
          // Update DB with BootNotif informations
          let res = CSMSDB.updChargeBoxBootNotif(client.session, params)
          if (res) {
            this.log.debug(`${client.identity}: BootNotification saved`)
          }
          // Update Last Boot Notif
          let upd = CSMSDB.updLastBoot(client.identity)
          if (upd) {
            this.log.debug(`${client.identity}: LastBootTime saved`)
          }
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
          }
          */
        } else {
          client.close({code: 1011, reason: 'Not found in system'})
        }
      })
      ///////////////////////////////////////////////////////////////////
      // handler for StatusNotification
      client.handle('StatusNotification', async ({params, reply}) => {
        // Send response
        reply({})
        // Connector 0 ignored
        if (params.connectorId > 0) {
          this.log.debug(`StatusNotification from ${client.identity} - connector ${params.connectorId}`)
          // Update DB
          let res = CSMSDB.updConnectorStatus(client.identity, params)
          if (res) {
            this.log.debug(`${client.identity}: Connector ${params.connectorId} saved`)
          }
          // Charger in 'Automatic start-up by OCPP'
          if (params.status === 'Preparing') {
            let res = await CSMSDB.isChargerAutoOCPP(client.identity)
            if (res) {
              const response = await client.call('RemoteStartTransaction', {
                connectorId: parseInt(params.connectorId),
                idTag: 'OCPPAUTOSTART'
              })
              this.log.info('AutoStartTransaction Request: ' + JSON.stringify(response))
            }
          }
        }
      })
      ///////////////////////////////////////////////////////////////////
      // handler for HeartBeat
      client.handle('Heartbeat', () => {
        this.log.debug(`Heartbeat from ${client.identity}`)
        // Update DB
        let res = CSMSDB.updHeartBeat(client.identity)
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
        const expire = new Date(Date.now()).toISOString()
        // OCPP AutoStart mode
        if (params.idTag === 'OCPPAUTOSTART') {
          return {idTagInfo: {status: 'Accepted', expiryDate: expire} }
        } else {
          const tagResp = await CSMSDB.getAuthorizeResponse(client.identity, params.idTag)
          const authResult = tagResp.ocppresp
          // Save non accepted authorize responses
          if (authResult.status !== 'Accepted') {
            const data = {
              ocppid: client.identity,
              ts: Math.floor(Date.now()),
              idtag: params.idTag,
              resp: authResult.status, when: 'Authorize'
            }
            CSMSDB.saveAuthorizeResponse(data)
          }
          return {idTagInfo: authResult}
        }
      })
      ///////////////////////////////////////////////////////////////////
      // handler for StartTransaction
      client.handle('StartTransaction', async ({params, reply}) => {
        this.log.debug(`StartTransaction from ${client.identity} - connector ${params.connectorId}`)
        const expire = new Date(Date.now()).toISOString()
        // Generate transaction ID
        const transId = await CSMSDB.generateTransactionId()
        if (transId === false) {
          this.log.warn(`StartTransaction from ${client.identity} - generateTransactionId Error`)
          reply({idTagInfo: { status: 'Invalid' }, expiryDate: expire, transactionId: Math.floor(Date.now() / 1000)})
          return
        }
        this.log.debug(`Transaction ID: ${transId}`)
        // Validate idTag
        let authResult
        let userResult
        // OCPP AutoStart mode
        if (params.idTag === 'OCPPAUTOSTART') {
          authResult = { status: 'Accepted', expiryDate: expire }
          userResult = { rfpk: null, upk: 0 }
        // Autonomous Charger
        } else if (await CSMSDB.isChargerAutonomous(client.identity)) {
          authResult = { status: 'Accepted', expiryDate: expire }
          userResult = { rfpk: null, upk: 0 }
        // RFID tag - SADM tag - WUSR tag
        } else {
          const tagResp = await CSMSDB.getAuthorizeResponse(client.identity, params.idTag)
          authResult = tagResp.ocppresp
          userResult = tagResp.idtaginfo
          // Possible Status : Accepted / Blocked / Expired / Invalid / (ConcurrentTx)
        }
        // Save non accepted authorize responses
        if (authResult.status !== 'Accepted') {
          const data = {
            ocppid: client.identity,
            ts: Math.floor(Date.now()),
            idtag: params.idTag,
            resp: authResult.status,
            when: 'StartTransaction'
          }
          CSMSDB.saveAuthorizeResponse(data)
        }
        // Transaction Datas
        let transacParams = {
          tpk: transId,
          ocppid: client.identity,
          conid: params.connectorId,
          idtag: params.idTag,
          meter: params.meterStart,
          start: (Date.parse(new Date(params.timestamp)) / 1000),
          rfpk: userResult.rfpk,
          upk: userResult.upk,
          status: authResult.status
        }
        // Create Transaction in DB
        let insert = await CSMSDB.addTransaction(transacParams)
        if (insert === false) {
          this.log.warn(`Transaction ${transId} - addTransaction Error`)
          reply({idTagInfo: { status: 'Invalid' }, transactionId: transId})
          return
        }
        this.log.debug(`Transaction ${transId} successfully added`)
        // Response to charger
        this.log.info(`Transaction ${transId} in ${client.identity}: ${authResult.status}`)
        reply({idTagInfo: authResult , transactionId: transId})
        // Initialize TransactionData in DB
        let transacDatas = {
          tpk: transId,
          ts: (Date.parse(new Date(params.timestamp)) / 1000)
        }
        insert = await CSMSDB.initTransactionData(transacDatas)
        if (insert === false) {
          this.log.warn(`Transaction ${transId} - initTransactionData Error`)
        }
      })
      ///////////////////////////////////////////////////////////////////
      // handler for StopTransaction
      client.handle('StopTransaction', async ({params, reply}) => {
        this.log.debug(`StopTransaction from ${client.identity} - transaction ${params.transactionId}`)
        //TODO: Gestion des StopTransaction avec idTag & validation du tag
        //ATTENTION: idTag est optionnel !!
        // reply({ status: 'Accepted', expiryDate:'', parentIdTag:'' })
        reply({})
        // Format data
        let transacParams = {
          tpk: params.transactionId,
          meter: params.meterStop,
          stop: (Date.parse(new Date(params.timestamp)) / 1000),
          reason: params.reason || null,
          power: null
        }
        let stop = await CSMSDB.stopTransaction(transacParams)
        if ( stop === false ) {
          this.log.warn('Error stopping Transaction: ' + JSON.stringify(params))
        }
        // Last Transaction Data
        let transacDatas = {
          tpk: params.transactionId,
          ts: (Date.parse(new Date(params.timestamp)) / 1000),
          energy: params.meterStop,
          power: null, ampoffer: null, poffer: null,
          ampl1: null, ampl2: null, ampl3: null,
          ctx: null
        }
        let insert = await CSMSDB.addTransactionData(transacDatas)
        if (insert === false) {
          this.log.warn(`StopTransaction ${params.transactionId} - addTransactionData Error`)
        }
        // TODO: Update Meter value
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
          ctx: null
        }
        if (meters.length > 1) {
          let e1 = meters.find( s => s.sampledValue[0].measurand == 'Energy.Active.Import.Register')
          if (e1) {
            // Get Unit
            if (e1.sampledValue[0].unit.toUpperCase() === 'KWH') {
              values.energy = parseInt(e1.sampledValue[0].value * 1000)
            } else {
              values.energy = parseInt(e1.sampledValue[0].value)
            }
            values.ctx = e1.sampledValue[0].context
          }
        } else {
          let e1 = meters[0].sampledValue.find( s => s.measurand == 'Energy.Active.Import.Register')
          if (e1) {
            // Get Unit
            if (e1.unit.toUpperCase() === 'KWH') {
              values.energy = parseInt(e1.value * 1000)
            } else {
              values.energy = parseInt(e1.value)
            }
            values.ctx = e1.context
          }
        }
        // Store in DB : Connector meter value
        CSMSDB.updMeterValues(values)
        // MeterValues from Transaction
        if (params.transactionId !== undefined && params.transactionId !== 0) {
          values.tpk = params.transactionId
          // Power
          values.power = null
          if (meters.length > 1) {
            let p1 = meters.find( s => s.sampledValue[0].measurand == 'Power.Active.Import')
            if (p1) {
              // Get Unit
              if (p1.sampledValue[0].unit.toUpperCase() === 'KW') {
                values.power = parseInt(p1.sampledValue[0].value * 1000)
              } else {
                values.power = parseInt(p1.sampledValue[0].value)
              }
            }
          } else {
            let p1 = meters[0].sampledValue.find( s => s.measurand == 'Power.Active.Import')
            if (p1) {
              // Get Unit
              if (p1.unit.toUpperCase() === 'KW') {
                values.power = parseInt(p1.value * 1000)
              } else {
                values.power = parseInt(p1.value)
              }
            }
          }
          // Power Offered
          values.poffer = null
          if (meters.length > 1) {
            let p1 = meters.find( s => s.sampledValue[0].measurand == 'Power.Offered')
            if (p1) {
              // Get Unit
              if (p1.sampledValue[0].unit.toUpperCase() === 'KW') {
                values.poffer = parseInt(p1.sampledValue[0].value * 1000)
              } else {
                values.poffer = parseInt(p1.sampledValue[0].value)
              }
            }
          } else {
            let p1 = meters[0].sampledValue.find( s => s.measurand == 'Power.Offered')
            if (p1) {
              // Get Unit
              if (p1.unit.toUpperCase() === 'KW') {
                values.poffer = parseInt(p1.value * 1000)
              } else {
                values.poffer = parseInt(p1.value)
              }
            }
          }
          // Current Import => L1
          values.ampl1 = null
          if (meters.length > 1) {
            let cur1 = meters.find( s => s.sampledValue[0].measurand == 'Current.Import' && s.sampledValue[0].phase== 'L1')
            if (cur1) {
              values.ampl1 = parseFloat(cur1.sampledValue[0].value)
            }
          } else {
            let cur1 = meters[0].sampledValue.find( s => s.measurand == 'Current.Import' && s.phase == 'L1')
            if (cur1) {
              values.ampl1 = parseFloat(cur1.value)
            }
          }
          // Current Import => L2
          values.ampl2 = null
          if (meters.length > 1) {
            let cur2 = meters.find( s => s.sampledValue[0].measurand == 'Current.Import' && s.sampledValue[0].phase== 'L2')
            if (cur2) {
              values.ampl1 = parseFloat(cur2.sampledValue[0].value)
            }
          } else {
            let cur2 = meters[0].sampledValue.find( s => s.measurand == 'Current.Import' && s.phase == 'L2')
            if (cur2) {
              values.ampl2 = parseFloat(cur2.value)
            }
          }
          // Current Import => L3
          values.ampl3 = null
          if (meters.length > 1) {
            let cur3 = meters.find( s => s.sampledValue[0].measurand == 'Current.Import' && s.sampledValue[0].phase== 'L3')
            if (cur3) {
              values.ampl3 = parseFloat(cur3.sampledValue[0].value)
            }
          } else {
            let cur3 = meters[0].sampledValue.find( s => s.measurand == 'Current.Import' && s.phase == 'L3')
            if (cur3) {
              values.ampl3 = parseFloat(cur3.value)
            }
          }
          // Current Offered
          values.ampoffer = null
          if (meters.length > 1) {
            let offer = meters.find( s => s.sampledValue[0].measurand == 'Current.Offered')
            if (offer) {
              values.ampoffer = parseFloat(offer.sampledValue[0].value)
            }
          } else {
            let offer = meters[0].sampledValue.find( s => s.measurand == 'Current.Offered')
            if (offer) {
              values.ampoffer = parseFloat(offer.sampledValue[0].value)
            }
          }
          // Store in DB : Transaction meter+power values
          CSMSDB.updTransactionMeterValues(values)
          // Store in DB : Transaction_data values
          values.ts = (Date.parse(new Date(params.meterValue[0].timestamp)) / 1000)
          CSMSDB.addTransactionData(values)
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
      let result = await CSMSDB.saveChargeBoxConfigKeys(ocppid, response)
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
          const result = await CSMSDB.updChargeBoxConfigKey(params)
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
  async GetLocalListVersion(ocppid) {
    const client = this.ocppClients.get(ocppid)
    if (client) {
      try {
        const response = await client.call('GetLocalListVersion', {})
        return response
      } catch ( err ) {
        this.log.warn('GetLocalListVersion Request: ' + err)
        return { status: `${err}` }
      }
    } else {
      return { status: 'Station offline ?' }
    }
  }
  async ClearCache(ocppid) {
    const client = this.ocppClients.get(ocppid)
    if (client) {
      try {
        const response = await client.call('ClearCache', {})
        return response
      } catch ( err ) {
        this.log.warn('GetLocalListVersion Request: ' + err)
        return { status: `${err}` }
      }
    } else {
      return { status: 'Station offline ?' }
    }
  }
  /* WEB UI ACTION : Granted Users */
  async TriggerMessage(params) {
    const client = this.ocppClients.get(params.ocppName)
    if (client) {
      try {
        const response = await client.call('TriggerMessage', {
          requestedMessage: params.message,
          connectorId: parseInt(params.connid)
        } )
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
  /* WEB UI ACTION : All Users */
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