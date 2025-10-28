import { matchedData, validationResult } from 'express-validator'
import sqlite from '../../datas/db.js'

const OwnerController = {
  /* USERS */
  getAllUsers: async (req, res) => {
    const result = await sqlite.getSiteUsers(req.session.passport.user.ownedSite)
    if (result.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${result.error}`}] }
    }
    // Render
    res.render('site_users.ejs', {
      onUsers: true, siteusers: result,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  UserAddSchema: {
    usermail: {
      normalizeEmail: true,
      isEmail: {options: {allow_ip_domain: false}}
    },
    uname: {
      trim: true, escape: true,
      isLength: { options: { min: 5, max:50 } },
      matches: { options: /^[a-zA-Z0-9-_ ]*$/ },
    }
  },
  addSiteUser: async (req, res) => {
    const result = validationResult(req)
    let uid = null
    if (result.isEmpty()) {
      let data = matchedData(req)
      // Recup UserPK from users table if exists.
      let response = await sqlite.getUserIdByMail(data.usermail)
      if (response) {
        if (response.error) {
          req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
        } else {
          // pas d'admin
          if (response.isAdmin === 1) {
            req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `This user is an administrator`}] }
          } else {
            uid = response.user_pk
          }
        }
      } else {
        // Create in users table.
        let params = {
          umail: data.usermail,
          uname: 'Utilisateur',
          upass: 'NOTCRYPTEDPASSWORD',
          owner: null,
          admin: 0
        }
        let response2 = await sqlite.addUser(params)
        if (response2.error) {
          req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response2.error}`}] }
        } else {
          uid = response2.lastInsertRowid
        }
      }
      // Add in sites_users table
      if (uid) {
        let params = {
          spk: req.session.passport.user.ownedSite,
          upk: uid,
          uname: data.uname
        }
        let response3 = await sqlite.addSiteUser(params)
        if (response3.error) {
          req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response3.error}`}] }
        }
      }
      res.redirect('/users')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/users')
      return undefined
    }
  },
  formUpdSiteUser: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        pk: data.elemId,
        spk: req.session.passport.user.ownedSite
      }
      let response = await sqlite.getUserSiteUserById(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
        res.redirect('/users')
        return undefined
      }
      // Render
      res.render('site_user_updform.ejs', {
        onUsers: true, user: response,
        userInfo: req.session.passport.user,
        infosui: req.session.ocppcsms
      })
      req.session.ocppcsms = {}
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/users')
      return undefined
    }
  },
  UserUpdSchema: {
    pk: {
      isInt: true, trim: true, escape: true
    },
    uname: {
      trim: true, escape: true,
      isLength: { options: { min: 5, max:50 } },
      matches: { options: /^[a-zA-Z0-9-_ ]*$/ },
    }
  },
  updSiteUser: async (req,res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        pk: data.pk,
        uname: data.uname,
        spk: req.session.passport.user.ownedSite
      }
      let response = await sqlite.updSiteUser(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/users')
      return undefined
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/users')
      return undefined
    }
  },
  delSiteUser: async (req,res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        pk: data.elemId,
        spk: req.session.passport.user.ownedSite
      }
      let response = await sqlite.delSiteUser(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/users')
      return undefined
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/users')
      return undefined
    }
  },
  /* RFIDS */
  getAllRfids: async (req,res) => {
    // Get all Rfids Tags
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
        site: req.session.passport.user.ownedSite,
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
      let response = await sqlite.getRfidTagInfosById(data.elemId, req.session.passport.user.ownedSite)
      // Tentative d'accès à un ID hors site
      if (!response) {
        res.redirect('/rfids')
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
  updRfidTag: async (req,res) => {
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
        blocked: data.rfblocked
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
  delRfidTag: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        rf_pk: data.elemId,
        site: req.session.passport.user.ownedSite
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
  },
  /* STATIONS */
  getAllStations: async (req, res) => {
    // Get all Stations
    const result = await sqlite.getAllStations(req.session.passport.user.ownedSite)
    if (result.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${result.error}`}] }
    }
    res.render('site_stations.ejs', {
      onStations: true, stations: result,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  }
}

export default OwnerController