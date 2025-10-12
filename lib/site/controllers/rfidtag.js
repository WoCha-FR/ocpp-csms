import { matchedData, validationResult } from 'express-validator'
import sqlite from '../../datas/db.js'

const RfidController = {
  RfidTagSchema: {
    rftag: {
      trim: true, escape: true,
      matches: { options: /^[a-zA-Z0-9]*$/ },
      isLength: {options: {min: 5, max:20}},
      toUpperCase: true
    },
    rfsite: {
      isInt: true, trim: true, escape: true
    },
    rfname: {
      trim: true, escape: true,
      isLength: {options: {min: 1, max:50}}
    },
    blocked: {
      trim: true, escape: true,
      isInt: { options: {min: 0, max: 1} }
    },
    expire: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true, default: null,
      isInt: true
    },
    rfuser: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true, default: null,
      isInt: true
    }
  },
  IdSchema: {
    elemId: {
      isInt: true, trim: true, escape: true
    }
  },
  addRfidTag: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        site: data.rfsite,
        idtag: data.rftag,
        rf_name: data.rfname,
        user: data.rfuser,
        expire: data.expire,
        blocked: data.blocked
      }
      let response = await sqlite.addRfidTag(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/rfids')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/rfids')
      return undefined
    }
  },
  formUpdRfidTag: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let response = await sqlite.getUserInfosById(data.elemId)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
        res.redirect('/rfids')
        return undefined
      }
      // Get Sites - Form Select
      let sites = await sqlite.getAllSites()
      if (sites.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${sites.error}`}] }
      }
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/rfids')
      return undefined
    }
  },
  delRfidTag: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        rf_pk: data.elemId
      }
      let response = await sqlite.delRfidTag(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/rfids')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/rfids')
      return undefined
    }
  }
}
export default RfidController