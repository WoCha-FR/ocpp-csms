import conf from 'config'
import utils from '../helpers/utils.js'
import CSMSDB from '../datas/csms-db.js'

export async function cbBootNotif(client, {params, reply}) {
  this.log.debug(`Server got BootNotification from ${client.identity}`)
  // Boot Info du Point de charge
  const cbox = await CSMSDB.getCBRegStatus(client.identity)
  if (cbox) {
    // Return to client
    reply({
      status: cbox.registration_status, // Accepted, Pending, Rejected
      interval: parseInt(conf.get('ocpp.heartbeat')),
      currentTime: new Date().toISOString(),
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
        const response = await this.client.call('ChangeConfiguration', {key: config.key, value: config.value})
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
      await this.client.call('TriggerMessage', {requestedMessage: 'MeterValues' })
    }
    */
  } else {
    client.close({ code: 1011, reason: 'Not found in system' })
  }
}
export async function cbStatusNotif(client, {params, reply}) {
  // Send response
  reply({})
  // Connector 0 ignored
  if (params.connectorId > 0) {
    this.log.debug(`StatusNotification from ${client.identity} - connector ${params.connectorId}`)
    // Emit event
    utils.event.emit('chgStatus', client.identity, params)
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
          idTag: 'OCPPAUTOSTART',
        })
        this.log.info('AutoStartTransaction Request: ' + JSON.stringify(response))
      }
    }
  }
}
export async function cbHeartBeat(client) {
  this.log.debug(`Heartbeat from ${client.identity}`)
  // Update DB
  let res = CSMSDB.updHeartBeat(client.identity)
  if (res) {
    this.log.debug(`${client.identity}: Heartbeat saved`)
  }
  // Send Response
  return { currentTime: new Date().toISOString() }
  //reply({ currentTime: new Date().toISOString() })
}
export async function cbAuthorize(client, {params}) {
  this.log.debug(`Authorize from ${client.identity} - idTag ${params.idTag}`)
  const expire = new Date(Date.now()).toISOString()
  // OCPP AutoStart mode
  if (params.idTag === 'OCPPAUTOSTART') {
    return { idTagInfo: { status: 'Accepted', expiryDate: expire } }
  } else {
    const tagResp = await CSMSDB.getAuthorizeResponse(client.identity, params.idTag)
    const authResult = tagResp.ocppresp
    // Save non accepted authorize responses
    if (authResult.status !== 'Accepted') {
      const data = {
        ocppid: client.identity,
        ts: Math.floor(Date.now()),
        idtag: params.idTag,
        resp: authResult.status,
        when: 'Authorize',
      }
      CSMSDB.saveAuthorizeResponse(data)
    }
    return { idTagInfo: authResult }
  }
}
export async function cbStartTransaction(client, {params, reply}) {
  this.log.debug(`StartTransaction from ${client.identity} - connector ${params.connectorId}`)
  const expire = new Date(Date.now()).toISOString()
  // Generate transaction ID
  const transId = await CSMSDB.generateTransactionId()
  if (transId === false) {
    this.log.warn(`StartTransaction from ${client.identity} - generateTransactionId Error`)
    reply({ idTagInfo: { status: 'Invalid' }, expiryDate: expire, transactionId: Math.floor(Date.now() / 1000) })
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
      when: 'StartTransaction',
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
    start: Date.parse(new Date(params.timestamp)) / 1000,
    rfpk: userResult.rfpk,
    upk: userResult.upk,
    status: authResult.status,
  }
  // Create Transaction in DB
  let insert = await CSMSDB.addTransaction(transacParams)
  if (insert === false) {
    this.log.warn(`Transaction ${transId} - addTransaction Error`)
    reply({ idTagInfo: { status: 'Invalid' }, transactionId: transId })
    return
  }
  this.log.debug(`Transaction ${transId} successfully added`)
  // Response to charger
  this.log.info(`Transaction ${transId} in ${client.identity}: ${authResult.status}`)
  reply({ idTagInfo: authResult, transactionId: transId })
  // Initialize TransactionData in DB
  let transacDatas = { tpk: transId, ts: Date.parse(new Date(params.timestamp)) / 1000 }
  insert = await CSMSDB.initTransactionData(transacDatas)
  if (insert === false) {
    this.log.warn(`Transaction ${transId} - initTransactionData Error`)
  }
}
export async function cbStopTransaction(client, {params, reply}) {
  this.log.debug(`StopTransaction from ${client.identity} - transaction ${params.transactionId}`)
  const expire = new Date(Date.now()).toISOString()
  if (params.idTag !== undefined && params.idTag !== '') {
    this.log.debug(`StopTransaction idTag: ${params.idTag}`)
    if (params.idTag === 'OCPPAUTOSTART') {
      reply({ idTagInfo: { status: 'Accepted', expiryDate: expire } })
      // Autonomous Charger
    } else if (await CSMSDB.isChargerAutonomous(client.identity)) {
      reply({ idTagInfo: { status: 'Accepted', expiryDate: expire } })
      // RFID tag - SADM tag - WUSR tag
    } else {
      const tagResp = await CSMSDB.getAuthorizeResponse(client.identity, params.idTag)
      reply({ idTagInfo: tagResp.ocppresp })
    }
  } else {
    this.log.debug(`StopTransaction no idTag provided`)
    reply({})
  }
  // Format data
  let transacParams = {
    tpk: params.transactionId,
    meter: params.meterStop,
    stop: Date.parse(new Date(params.timestamp)) / 1000,
    reason: params.reason || null,
    power: null,
  }
  let stop = await CSMSDB.stopTransaction(transacParams)
  if (stop === false) {
    this.log.warn('Error stopping Transaction: ' + JSON.stringify(params))
  }
  // If no changes, transaction is already stopped
  if (stop.info && stop.info.changes === 1) {
    // Last Transaction Data
    let transacDatas = {
      tpk: params.transactionId,
      ts: Date.parse(new Date(params.timestamp)) / 1000,
      energy: params.meterStop,
      power: null,
      ampoffer: null,
      poffer: null,
      ampl1: null,
      ampl2: null,
      ampl3: null,
      ctx: null,
    }
    let insert = await CSMSDB.addTransactionData(transacDatas)
    if (insert === false) {
      this.log.warn(`StopTransaction ${params.transactionId} - addTransactionData Error`)
    }
  }
}
export async function cbMeterValues(client, {params, reply}) {
  this.log.debug(`MeterValues from ${client.identity} - connector ${params.connectorId}`)
  // Send response
  reply({})
  // Work With meterValue
  let meters = params.meterValue
  let values = { cbid: client.identity, cnid: params.connectorId, energy: null, ctx: null }
  if (meters.length > 1) {
    let e1 = meters.find((s) => s.sampledValue[0].measurand == 'Energy.Active.Import.Register')
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
    let e1 = meters[0].sampledValue.find((s) => s.measurand == 'Energy.Active.Import.Register')
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
      let p1 = meters.find((s) => s.sampledValue[0].measurand == 'Power.Active.Import')
      if (p1) {
        // Get Unit
        if (p1.sampledValue[0].unit.toUpperCase() === 'KW') {
          values.power = parseInt(p1.sampledValue[0].value * 1000)
        } else {
          values.power = parseInt(p1.sampledValue[0].value)
        }
      }
    } else {
      let p1 = meters[0].sampledValue.find((s) => s.measurand == 'Power.Active.Import')
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
      let p1 = meters.find((s) => s.sampledValue[0].measurand == 'Power.Offered')
      if (p1) {
        // Get Unit
        if (p1.sampledValue[0].unit.toUpperCase() === 'KW') {
          values.poffer = parseInt(p1.sampledValue[0].value * 1000)
        } else {
          values.poffer = parseInt(p1.sampledValue[0].value)
        }
      }
    } else {
      let p1 = meters[0].sampledValue.find((s) => s.measurand == 'Power.Offered')
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
      let cur1 = meters.find((s) => s.sampledValue[0].measurand == 'Current.Import' && s.sampledValue[0].phase == 'L1')
      if (cur1) {
        values.ampl1 = parseFloat(cur1.sampledValue[0].value)
      }
    } else {
      let cur1 = meters[0].sampledValue.find((s) => s.measurand == 'Current.Import' && s.phase == 'L1')
      if (cur1) {
        values.ampl1 = parseFloat(cur1.value)
      }
    }
    // Current Import => L2
    values.ampl2 = null
    if (meters.length > 1) {
      let cur2 = meters.find((s) => s.sampledValue[0].measurand == 'Current.Import' && s.sampledValue[0].phase == 'L2')
      if (cur2) {
        values.ampl1 = parseFloat(cur2.sampledValue[0].value)
      }
    } else {
      let cur2 = meters[0].sampledValue.find((s) => s.measurand == 'Current.Import' && s.phase == 'L2')
      if (cur2) {
        values.ampl2 = parseFloat(cur2.value)
      }
    }
    // Current Import => L3
    values.ampl3 = null
    if (meters.length > 1) {
      let cur3 = meters.find((s) => s.sampledValue[0].measurand == 'Current.Import' && s.sampledValue[0].phase == 'L3')
      if (cur3) {
        values.ampl3 = parseFloat(cur3.sampledValue[0].value)
      }
    } else {
      let cur3 = meters[0].sampledValue.find((s) => s.measurand == 'Current.Import' && s.phase == 'L3')
      if (cur3) {
        values.ampl3 = parseFloat(cur3.value)
      }
    }
    // Current Offered
    values.ampoffer = null
    if (meters.length > 1) {
      let offer = meters.find((s) => s.sampledValue[0].measurand == 'Current.Offered')
      if (offer) {
        values.ampoffer = parseFloat(offer.sampledValue[0].value)
      }
    } else {
      let offer = meters[0].sampledValue.find((s) => s.measurand == 'Current.Offered')
      if (offer) {
        values.ampoffer = parseFloat(offer.value)
      }
    }
    // Store in DB : Transaction meter+power values
    CSMSDB.updTransactionMeterValues(values)
    // Store in DB : Transaction_data values
    values.ts = Date.parse(new Date(params.meterValue[0].timestamp)) / 1000
    CSMSDB.addTransactionData(values)
  }
}
export async function cbDiagnosticsStatusNotif(client, {params}) {
  this.log.debug(`DiagnosticsStatusNotification from ${client.identity} - status ${params.status}`)
  // Emit event
  utils.event.emit('cbDiag', client.identity, params.status)
  return {}
}