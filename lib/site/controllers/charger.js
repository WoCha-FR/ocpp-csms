import { matchedData, validationResult } from 'express-validator'
import sqlite from '../../datas/db.js'
import csms from '../../csms/csms.js'

const ChargerController = {
  getMainPage: async (req, res) => {
    const data = matchedData(req)
    // Get ChargeBox table data
    const res1 = await sqlite.getChargeBoxByName(data.ocppName, req.session.passport.user.ownedSite)
      // Tentative d'accès à un ID inexistant ou hors site
      if (!res1) {
        res.redirect('/forbidden')
        return undefined
      }
      if (res1.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res1.error}`}] }
      res.redirect('/stations')
    }
    // Get ChargeBoxInfos table data
    const res2 = await sqlite.getChargeBoxBootInfo(data.ocppName, req.session.passport.user.ownedSite)
    if (res2 && res2.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res2.error}`}] }
    }
    // Get ChargeBox Connectors
    const res3 = await sqlite.getChargeBoxConnectors(data.ocppName, req.session.passport.user.ownedSite)
    if (res3.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res3.error}`}] }
    }
    // Render
    res.render('granted_charger_main.ejs', {
      onStations: true, station: res1,
      cbinfos: res2, conns: res3,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  ajaxGetChargerStatus: async (req, res) => {
    const data = matchedData(req)
    const result = await sqlite.ajaxGetChargeurStatus(data.ocppName, req.session.passport.user.ownedSite)
    if (!result) {
      res.status(404).send('Not Found')
    }
    if (result.error) {
      res.status(500).send(result.error)
    }
    res.send({ data: result })
  },
  ajaxGetChargerConnsStatus: async (req, res) => {
    const data = matchedData(req)
    const result = await sqlite.ajaxGetChargeurConnsStatus(data.ocppName, req.session.passport.user.ownedSite)
    if (!result) {
      res.status(404).send('Not Found')
    }
    if (result.error) {
      res.status(500).send(result.error)
    }
    res.send({ data: result })
  },
  UpdChargerSchema: {
    ocppName: {
      trim: true, escape: true
    },
    cbname: {
      trim: true, escape: true,
      matches: { options: /^[a-zA-Z0-9-_]*$/ },
      isLength: {options: {min: 5}},
    },
    cbmode: {
      isInt: { options: {min: 0, max: 2} },
      trim: true, escape: true
    },
    cbid: {
      trim: true, escape: true
    },
    cbpwd: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true,
      isLength: {options: {min: 5}}
    }
  },
  updCharger: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        id : data.ocppName,
        name: data.cbname,
        mode: data.cbmode
      }
      let response = await sqlite.updChargeBoxNameMode(params, req.session.passport.user.ownedSite)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/charger/' + data.ocppName)
      return undefined
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/charger/' + req.params.ocppName)
      return undefined
    }
  },
  UpdConnPersoSchema: {
    ocppName: {
      trim: true, escape: true
    },
    connectorId: {
      isInt: { options: { min:0, max:9 } },
      trim: true, escape: true
    },
    cmaxp: {
      isInt: { options: {min: 1, max: 400} },
      trim: true, escape: true
    },
    cformat: {
      isInt: { options: {min: 1, max: 2} },
      trim: true, escape: true
    },
    ctype: {
      isInt: { options: {min: 1, max: 9} },
      trim: true, escape: true
    },
    cname: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true, isString: true,
      isLength: { options: { max: 50 } },
    }
  },
  updConnPerso: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        cbid: data.ocppName,
        cid: data.connectorId,
        cfor: data.cformat,
        ctyp: data.ctype,
        cmax: data.cmaxp,
        cname: data.cname,
        sid: req.session.passport.user.ownedSite
      }
      let response = await sqlite.updConnectorPerso(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/charger/' + data.ocppName)
      return undefined
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/charger/' + req.params.ocppName)
      return undefined
    }
  },
  getSocketPage: async (req, res) => {
    const data = matchedData(req)
    // ChargeBoxInfos
    const res1 = await sqlite.getChargeBoxByName(data.ocppName, req.session.passport.user.ownedSite)
      // Tentative d'accès à un ID inexistant ou hors site
      if (!res1) {
        res.redirect('/forbidden')
        return undefined
      }
      if (res1.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res1.error}`}] }
      return res.redirect('/stations')
    }
    // Connectors
    const res2 = await sqlite.getChargeBoxConnectors(data.ocppName, req.session.passport.user.ownedSite)
    if (res2.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res2.error}`}] }
      return res.redirect('/stations')
    }
    // Current Transaction
    const res3 = await sqlite.getChargeBoxRunningTransac(data.ocppName, req.session.passport.user.ownedSite)
    if (res3.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res3.error}`}] }
    }
    // Render
    res.render('granted_charger_connectors.ejs', {
      onStations: true,  station: res1, conns: res2,
      transactions: res3,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  getLogPage: async (req, res) => {
    // Station page
    const data = matchedData(req)
    // ChargeBoxInfos
    const res1 = await sqlite.getChargeBoxByName(data.ocppName)
      // Tentative d'accès à un ID inexistant ou hors site
      if (!res1) {
        res.redirect('/forbidden')
        return undefined
      }
      if (res1.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res1.error}`}] }
      return res.redirect('/stations')
    }
    // Render
    res.render('admin_charger_logs.ejs', {
      onStations: true, station: res1,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  LogsSchema: {
    ocppName: { trim: true, escape: true},
    start: {
      isInt: true, trim: true, escape: true
    },
    stop: {
      isInt: true, trim: true, escape: true
    }
  },
  ajaxGetLogs: async (req, res) => {
    const data = matchedData(req)
    const logs = await sqlite.ajaxgetChargeBoxLogs(data)
    res.send(logs)
  },
  getOcppForm: async (req, res) => {
    // Station page
    const data = matchedData(req)
    // ChargeBoxInfos
    const res1 = await sqlite.getChargeBoxByName(data.ocppName)
      // Tentative d'accès à un ID inexistant
      if (!res1) {
        res.redirect('/forbidden')
        return undefined
      }
      if (res1.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res1.error}`}] }
      return res.redirect('/stations')
    }
    // ChargeBoxConfig
    const res2 = await sqlite.getChargeBoxConfigKeys(data.ocppName)
    if (res2.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res2.error}`}] }
    }
    // Render
    res.render('admin_charger_ocpp.ejs', {
      onStations: true, station: res1, configkeys: res2,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  reqOcppConfig: async(req, res) => {
    const data = matchedData(req)
    let result = await csms.GetConfiguration(data.ocppName)
    if (result.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${result.error}`}] }
    } else {
      req.session.ocppcsms.ocppResult = result
    }
    res.redirect('/charger/' + data.ocppName + '/ocppconfig')
  },
  ConfigSchema: {
    ocppName: { trim: true, escape: true},
    key: {trim: true, escape: true},
    value: {trim: true}
  },
  updOcppConfig: async(req, res) => {
    const data = matchedData(req)
    let result = await csms.SetConfiguration(data)
    req.session.ocppcsms = result
    res.redirect('/charger/' + data.ocppName + '/ocppconfig')
  },
  RebootSchema: {
    ocppName: { trim: true, escape: true},
    ResetType: {
      isIn: {
        options: [['Soft', 'Hard']],
      }
    }
  },
  rebootStation: async(req, res) => {
    // Validator
    const result = validationResult(req)
    if (result.isEmpty()) {
      const data = matchedData(req)
      const params = {
        ocppName: data.ocppName,
        rebootType: data.ResetType
      }
      // Ckeck if station is owned by this user
      if (req.session.passport.user.ownedSite) {
        let valid = await sqlite.isOwnerOfChargeBox(data.ocppName, req.session.passport.user.ownedSite)
        if (valid===false) {
          res.redirect('/forbidden')
        }
      }
      let response = await csms.ResetChargeBox(params)
      req.session.ocppcsms.ocppResult = response
      res.redirect('/charger/' + data.ocppName)
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/charger/' + req.params.ocppName)
    }
  },
  AvailabilitySchema: {
    ocppName: { trim: true, escape: true},
    connectorId: {
      isInt: { options: { min:0, max:9 } },
      trim: true, escape: true
    },
    AvailabilityType: {
      isIn: {
        options: [['Operative', 'Inoperative']],
      }
    }
  },
  setAvailability: async(req, res) => {
    // Validator
    const result = validationResult(req)
    if (result.isEmpty()) {
      const data = matchedData(req)
      const params = {
        ocppName: data.ocppName,
        cn_id: data.connectorId,
        type: data.AvailabilityType
      }
      // Ckeck if station is owned by this user
      if (req.session.passport.user.ownedSite) {
        let valid = await sqlite.isOwnerOfChargeBox(data.ocppName, req.session.passport.user.ownedSite)
        if (valid===false) {
          res.redirect('/forbidden')
        }
      }
      let response = await csms.ChangeAvailability(params)
      req.session.ocppcsms.ocppResult = response
      res.redirect('/charger/' + data.ocppName)
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/charger/' + req.params.ocppName)
    }
  },
  TriggerSchema: {
    ocppName: { trim: true, escape: true},
    requestedMessage: {
      isIn: {
        options: [['BootNotification', 'Heartbeat', 'StatusNotification', 'MeterValues']],
      }
    },
    connectorId: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true,
      isInt: { options: { min:0, max:9 } },
      default: 0
    }
  },
  ConnTriggerSchema: {
    ocppName: { trim: true, escape: true},
    requestedMessage: {
      isIn: {
        options: [['StatusNotification', 'MeterValues']],
      }
    },
    connectorId: {
      trim: true, escape: true,
      isInt: { options: { min:0, max:9 } }
    }
  },
  triggerMessage: async(req, res) => {
    // Validator
    const result = validationResult(req)
    if (result.isEmpty()) {
      const data = matchedData(req)
      const params = {
        ocppName: data.ocppName,
        message: data.requestedMessage,
        connid: data.connectorId
      }
      // Ckeck if station is owned by this user
      if (req.session.passport.user.ownedSite) {
        let valid = await sqlite.isOwnerOfChargeBox(data.ocppName, req.session.passport.user.ownedSite)
        if (valid===false) {
          res.redirect('/forbidden')
        }
      }
      let response = await csms.TriggerMessage(params)
      req.session.ocppcsms.ocppResult = response
      res.redirect('/charger/' + data.ocppName)
     } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/charger/' + req.params.ocppName)
    }
  },
  ConnectorSchema: {
    ocppName: { trim: true, escape: true},
    connectorId: {
      isInt: { options: { min:1, max:9 } },
      trim: true, escape: true
    }
  },
  unlockConnector: async(req, res) => {
    // Validator
    const result = validationResult(req)
    if (result.isEmpty()) {
      const data = matchedData(req)
      const params = {
        ocppName: data.ocppName,
        cn_id: data.connectorId
      }
      // Ckeck if station is owned by this user
      if (req.session.passport.user.ownedSite) {
        let valid = await sqlite.isOwnerOfChargeBox(data.ocppName, req.session.passport.user.ownedSite)
        if (valid===false) {
          res.redirect('/forbidden')
        }
      }
      let response = await csms.UnlockConnector(params)
      req.session.ocppcsms.ocppResult = response
      res.redirect('/charger/' + data.ocppName + '/connectors')
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/charger/' + req.params.ocppName + '/connectors')
    }
  },
  RemoteStartTrans: async(req, res) => {
    // Validator
    const result = validationResult(req)
    if (result.isEmpty()) {
      const data = matchedData(req)
      const params = {
        ocppName: data.ocppName,
        cn_id: data.connectorId,
        idTag: 'FromOcppCsms'
      }
      // Ckeck if station is owned by this user
      if (req.session.passport.user.ownedSite) {
        let valid = await sqlite.isOwnerOfChargeBox(data.ocppName, req.session.passport.user.ownedSite)
        if (valid===false) {
          res.redirect('/forbidden')
        }
      }
      // TODO : Check if user authorized
      let response = await csms.RemoteStartTransaction(params)
      req.session.ocppcsms.ocppResult = response
      res.redirect('/charger/' + params.ocppName + '/connectors')
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/charger/' + req.params.ocppName + '/connectors')
    }
  },
  TransactionSchema: {
    ocppName: { trim: true, escape: true},
    transId: {
      isInt: true, trim: true, escape: true
    }
  },
  RemoteStopTrans: async(req, res) => {
    // Validator
    const result = validationResult(req)
    if (result.isEmpty()) {
      const data = matchedData(req)
      const params = {
        ocppName: data.ocppName,
        transacId: data.transId
      }
      // Ckeck if station is owned by this user
      if (req.session.passport.user.ownedSite) {
        let valid = await sqlite.isOwnerOfChargeBox(data.ocppName, req.session.passport.user.ownedSite)
        if (valid===false) {
          res.redirect('/forbidden')
        }
      }
      // TODO : Check if user authorized
      let response = await csms.RemoteStopTransaction(params)
      req.session.ocppcsms.ocppResult = response
      res.redirect('/charger/' + params.ocppName + '/connectors')
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/charger/' + req.params.ocppName + '/connectors')
    }
  },

}

export default ChargerController