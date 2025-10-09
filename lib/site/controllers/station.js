import { matchedData, validationResult } from 'express-validator'
import sqlite from '../../datas/db.js'
import csms from '../../csms/csms.js'

const StationController = {
  OcppidSchema: {
    ocppName: { trim: true, escape: true}
  },
  getMainPage: async (req, res) => {
    // Station page
    const data = matchedData(req)
    // ChargeBoxBase
    const res1 = await sqlite.getChargeBoxByName(data.ocppName)
    if (res1.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res1.error}`}] }
      return res.redirect('/stations')
    }
    // Connectors
    const res2 = await sqlite.getChargeBoxConnectors(data.ocppName)
    if (res2.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res2.error}`}] }
      return res.redirect('/stations')
    }
    // Render
    res.render('charger_main.ejs', {
      onCharger: true,  station: res1, conns: res2,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  getManagePage: async (req, res) => {
    // Station page
    const data = matchedData(req)
    // ChargeBoxInfos
    const res1 = await sqlite.getChargeBoxByName(data.ocppName)
    if (res1.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res1.error}`}] }
      return res.redirect('/stations')
    }
    // Advanced Informations
    const res2 = await sqlite.getChargeBoxBootInfo(data.ocppName)
    if (res2 && res2.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res2.error}`}] }
    }
    // Render
    res.render('charger_manage.ejs', {
      onCharger: true, station: res1, cbinfos: res2,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  UpdChargerSchema: {
    cbname: {
      trim: true, escape: true,
      matches: { options: /^[a-zA-Z0-9-_]*$/ },
      isLength: {options: {min: 5}},
    },
    cbmode: {
      isInt: { options: {min: 0, max: 1} },
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
  updChargerInfos: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        id : data.cbid,
        name: data.cbname,
        pwd: data.cbpwd || null,
        mode: data.cbmode
      }
      let response = await sqlite.usrUpdChargeBoxInfos(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/station/' + data.cbid + '/manage')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/station/' + req.params.ocppName + '/manage')
      return undefined
    }
  },
  getLogsPage: async (req, res) => {
    // Station page
    const data = matchedData(req)
    // ChargeBoxInfos
    const res1 = await sqlite.getChargeBoxByName(data.ocppName)
    if (res1.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res1.error}`}] }
      return res.redirect('/stations')
    }
    // Render
    res.render('charger_logs.ejs', {
      onCharger: true, station: res1,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  getOcppPage: async (req, res) => {
    // Station page
    const data = matchedData(req)
    // ChargeBoxInfos
    const res1 = await sqlite.getChargeBoxByName(data.ocppName)
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
    res.render('charger_ocpp.ejs', {
      onCharger: true, station: res1, configkeys: res2,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  getConfiguration: async(req, res) => {
    const data = matchedData(req)
    let result = await csms.GetConfiguration(data.ocppName)
    if (result.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${result.error}`}] }
    } else {
      req.session.ocppcsms.ocppResult = result
    }
    res.redirect('/station/' + data.ocppName + '/ocppkeys')
  },
  ConfigSchema: {
    ocppName: { trim: true, escape: true},
    key: {trim: true, escape: true},
    value: {trim: true}
  },
  setConfiguration: async(req, res) => {
    const data = matchedData(req)
    let result = await csms.ChangeConfiguration(data)
    req.session.ocppcsms = result
    res.redirect('/station/' + data.ocppName + '/ocppkeys')
  },
  /* WEB UI ACTION => Renvoie Le status OCPP ou Erreur Saisie */
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
      let response = await csms.ResetChargeBox(params)
      req.session.ocppcsms.ocppResult = response
      res.redirect('/station/' + params.ocppName + '/manage')
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/station/' + req.params.ocppName + '/manage')
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
      let response = await csms.ChangeAvailability(params)
      req.session.ocppcsms.ocppResult = response
      res.redirect('/station/' + params.ocppName + '/manage')
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/station/' + req.params.ocppName + '/manage')
    }
  },
  TriggerSchema: {
    ocppName: { trim: true, escape: true},
    requestedMessage: {
      isIn: {
        options: [['BootNotification', 'Heartbeat', 'StatusNotification', 'MeterValues']],
      }
    }
  },
  triggerMessage: async(req, res) => {
    // Validator
    const result = validationResult(req)
    if (result.isEmpty()) {
      const data = matchedData(req)
      const params = {
        ocppName: data.ocppName,
        message: data.requestedMessage
      }
      let response = await csms.TriggerMessage(params)
      req.session.ocppcsms.ocppResult = response
      res.redirect('/station/' + params.ocppName + '/manage')
     } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/station/' + req.params.ocppName + '/manage')
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
      let response = await csms.UnlockConnector(params)
      req.session.ocppcsms.ocppResult = response
      res.redirect('/station/' + params.ocppName)
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/station/' + req.params.ocppName)
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
      let response = await csms.RemoteStartTransaction(params)
      req.session.ocppcsms.ocppResult = response
      res.redirect('/station/' + params.ocppName)
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/station/' + req.params.ocppName)
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
      let response = await csms.RemoteStopTransaction(params)
      req.session.ocppcsms.ocppResult = response
      res.redirect('/station/' + params.ocppName)
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/station/' + req.params.ocppName)
    }
  },
  /* WEB UI AJAX CALL */
  LogsSchema: {
    ocppName: { trim: true, escape: true},
    start: {
      isInt: true, trim: true, escape: true
    }
  },
  getLogs: async (req, res) => {
    const data = matchedData(req)
    const logs = await sqlite.getChargeBoxLogs(data)
    res.send(logs)
  },
}

export default StationController