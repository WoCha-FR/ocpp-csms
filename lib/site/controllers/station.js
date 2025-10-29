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
    // TODO: Get current Transaction ID for remote stop
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

  /* WEB UI ACTION => Renvoie Le status OCPP ou Erreur Saisie */
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
}

export default StationController