import { matchedData, validationResult } from 'express-validator'
import { JSONFilePreset } from 'lowdb/node'
import utils from '../../helpers/utils.js'
import sqlite from '../../datas/db.js'

const RfidController = {
  /* RFIDS  Admin */
  getAllRfids: async (req,res) => {
    // Get all Rfids Tags
    const result = await sqlite.getAllRfidTags()
    if (result.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${result.error}`}] }
    }
    // Get Sites for Form Select
    const sites = await sqlite.getAllSites()
    if (sites.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${sites.error}`}] }
    }
    // Pendings Stations
    const PendingCB = await JSONFilePreset(utils.rootdir() + '/datas/pendings.json', { pendings: [] })
    const { pendings } = PendingCB.data
    res.render('admin_rfids.ejs', {
      onRfids: true, rfids: result, sites: sites,
      pendings: pendings,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  formUpdRfidTag: async (req,res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        rf_pk: data.elemId,
        sid: null
      }
      let response = await sqlite.getRfidTagInfosById(params)
      // Tentative d'accès à un ID inexistant
      if (!response) {
        res.redirect('/not-found')
        return undefined
      }
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
        res.redirect('/rfids')
        return undefined
      }
      // Get Sites for Form Select
      const sites = await sqlite.getAllSites()
      if (sites.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${sites.error}`}] }
      }
      // Get Users for Form Select
      let users
      if (response.site===null) {
        users = await sqlite.getAllUsers()
      } else {
        users = await sqlite.getAllSiteUsers(response.site)
      }
      if (users.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${users.error}`}] }
      }
      res.render('admin_rfid_updform.ejs', {
        onRfids: true, rfid: response, sites: sites, users: users,
        userInfo: req.session.passport.user,
        infosui: req.session.ocppcsms
      })
      req.session.ocppcsms = {}
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/rfids')
      return undefined
    }
  },
  updRfidTag: async (req,res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        rf_pk: data.rfpk,
        site: data.rfsite,
        idtag: data.rftag,
        rf_name: data.rfname,
        user: data.rfuser,
        expire: data.rfexpire,
        blocked: data.rfblocked,
        isAdmin: req.session.passport.user.isAdmin
      }
      let response = await sqlite.updRfidTag(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/admin/rfids')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/admin/rfid/edit/' + req.params.rfpk)
      return undefined
    }
  },
  RfidUsersOfSite: {
    rfsite: {
      trim: true, escape: true, isInt: true,
      optional : { options: { values: 'falsy' } },
      default: null
    }
  },
  ajaxGetUsersOfSite: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      const data = matchedData(req)
      let result
      if (data.rfsite) {
        result = await sqlite.getAllSiteUsers(data.rfsite)
      } else {
        result = await sqlite.getAllUsers()
      }
      if (!result) {
        res.status(404).send('Not Found')
      }
      if (result.error) {
        res.status(500).send(result.error)
      }
      res.send({ data: result })
    } else {
      const err = result.array({ onlyFirstError: false })
      res.status(400).send(err[0].path + ' => ' + err[0].msg)
    }
  },
  /* RFIDS Owner */
  getOwnerRfids: async (req,res) => {
    // Get Rfids Tags of site
    const result = await sqlite.getSiteRfidTags(req.session.passport.user.ownedSite)
    if (result.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${result.error}`}] }
    }
    // Get all users of site
    const users = await sqlite.getSiteUsers(req.session.passport.user.ownedSite)
    if (users.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${users.error}`}] }
    }
    res.render('site_rfids.ejs', {
      onRfids: true, rfids: result, users: users,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  formUpdOwnerRfidTag: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        rf_pk: data.elemId,
        sid: req.session.passport.user.ownedSite
      }
      let response = await sqlite.getRfidTagInfosById(params)
      // Tentative d'accès à un ID inexistant ou hors site
      if (!response) {
        res.redirect('/forbidden')
        return undefined
      }
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
        res.redirect('/rfids')
        return undefined
      }
      // Get all users of site
      const users = await sqlite.getSiteUsers(req.session.passport.user.ownedSite)
      if (users.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${users.error}`}] }
      }
      res.render('site_rfid_updform.ejs', {
        onRfids: true, rfid: response, users: users,
        userInfo: req.session.passport.user,
        infosui: req.session.ocppcsms
      })
      req.session.ocppcsms = {}
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/rfids')
      return undefined
    }
  },
  updOwnerRfidTag: async (req,res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        rf_pk: data.rfpk,
        site: req.session.passport.user.ownedSite,
        idtag: data.rftag,
        rf_name: data.rfname,
        user: data.rfuser,
        expire: data.rfexpire,
        blocked: data.rfblocked,
        isAdmin: req.session.passport.user.isAdmin
      }
      let response = await sqlite.updRfidTag(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/site/rfids')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/site/rfid/edit/' + req.params.rfpk)
      return undefined
    }
  },
  /* RFIDS Common */
  RfidTagAddSchema: {
    rftag: {
      trim: true, escape: true,
      matches: { options: /^[a-zA-Z0-9]*$/ },
      isLength: {options: {min: 5, max:20}},
      toUpperCase: true
    },
    rfsite: {
      optional : { options: { values: 'falsy' } },
      isInt: true, trim: true, escape: true, default: null
    },
    rfname: {
      trim: true, escape: true,
      isLength: {options: {min: 1, max:50}}
    },
    rfblocked: {
      trim: true, escape: true,
      isInt: { options: {min: 0, max: 1} }
    },
    rfexpire: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true, default: null, isInt: true
    },
    rfuser: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true, default: null, isInt: true
    }
  },
  addRfidTag: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        idtag: data.rftag,
        rf_name: data.rfname,
        user: data.rfuser,
        expire: data.expire,
        blocked: data.blocked
      }
      if (req.session.passport.user.isAdmin === 1) {
        params.site = data.rfsite
      } else {
        params.site = req.session.passport.user.ownedSite
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
  RfidTagUpdSchema: {
    rfpk: {
      isInt: true, trim: true, escape: true
    },
    rftag: {
      trim: true, escape: true,
      matches: { options: /^[a-zA-Z0-9]*$/ },
      isLength: {options: {min: 5, max:20}},
      toUpperCase: true
    },
    rfsite: {
      optional : { options: { values: 'falsy' } },
      isInt: true, trim: true, escape: true, default: null
    },
    rfname: {
      trim: true, escape: true,
      isLength: {options: {min: 1, max:50}}
    },
    rfblocked: {
      trim: true, escape: true,
      isInt: { options: {min: 0, max: 1} }
    },
    rfexpire: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true, default: null, isInt: true
    },
    rfuser: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true, default: null, isInt: true
    }
  },
  delRfidTag: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        rf_pk: data.elemId,
        isAdmin: req.session.passport.user.isAdmin
      }
      if (req.session.passport.user.ownedSite !== null) {
        params.site = req.session.passport.user.ownedSite
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