import { matchedData, validationResult } from 'express-validator'
import sqlite from '../../datas/db.js'
import csms from '../../csms/csms.js'

const ChargerController = {
  getMainPage: async (req, res) => {
    const data = matchedData(req)
    // Get ChargeBox table data
    const res1 = await sqlite.getChargeBoxByName(data.ocppName, req.session.passport.user.ownedSite)
    if (res1.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res1.error}`}] }
      res.redirect('/stations')
    }
    // Get ChargeBoxInfos table data
    const res2 = await sqlite.getChargeBoxBootInfo(data.ocppName, req.session.passport.user.ownedSite)
    if (res2 && res2.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res2.error}`}] }
    }
    // Render
    res.render('granted_charger_main.ejs', {
      onStations: true, station: res1, cbinfos: res2,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  ajaxGetOnline: async (req, res) => {
    const data = matchedData(req)
    const result = await sqlite.ajaxGetChargeurStatus(data.ocppName, req.session.passport.user.ownedSite)
    if (result.error) {
      res.status(500).send(result.error)
    }
    res.send({ data: result })
  },
  getOcppForm: async (req, res) => {
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
  getLogPage: async (req, res) => {
    // Station page
    const data = matchedData(req)
    // ChargeBoxInfos
    const res1 = await sqlite.getChargeBoxByName(data.ocppName)
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
          req.session.ocppcsms.ocppResult = { "status": "Unauthorized" }
          res.redirect('/charger/' + data.ocppName)
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
          req.session.ocppcsms.ocppResult = { "status": "Unauthorized" }
          res.redirect('/charger/' + data.ocppName)
        }
      }
      let response = await csms.ChangeAvailability(params)
      req.session.ocppcsms.ocppResult = response
      res.redirect('/charger/' + params.ocppName)
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
      res.redirect('/charger/' + params.ocppName)
     } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/charger/' + req.params.ocppName)
    }
  },

}

export default ChargerController