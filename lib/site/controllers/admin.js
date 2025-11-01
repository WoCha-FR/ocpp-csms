import { matchedData, validationResult, body } from 'express-validator'
import { JSONFilePreset } from 'lowdb/node'
import fs from 'fs'
import ejs from 'ejs'
import bcrypt from 'bcrypt'
import utils from '../../helpers/utils.js'
import sqlite from '../../datas/db.js'
import csms from '../../csms/csms.js'

const AdminController = {
  /* SITES */
  getAllSites: async (req, res) => {
    // Get all Sites
    const result = await sqlite.getAllSites()
    if (result.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${result.error}`}] }
    }
    // Pendings Stations
    const PendingCB = await JSONFilePreset(utils.rootdir() + '/datas/pendings.json', { pendings: [] })
    const { pendings } = PendingCB.data
    res.render('admin_sites.ejs', {
      onSites: true, sites: result, pendings: pendings,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  SiteSchema: {
    sname: {
      trim: true, escape: true,
      isLength: { options: { min: 5, max:50 } },
      matches: { options: /^[a-zA-Z0-9-_ ]*$/ }
    },
    saddr: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true,
      isLength: { options: { max:255 } }
    },
    scodp: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true, isPostalCode: { options: 'any' }
    },
    sville: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true, isLength: { options: { max: 150 } },
      toUpperCase: true
    }
  },
  addSite: async(req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        name: data.sname,
        address: data.saddr,
        codp: data.scodp,
        ville: data.sville
      }
      let response = await sqlite.addSite(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/admin/sites')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/admin/sites')
      return undefined
    }
  },
  formUpdSite: async(req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let response = await sqlite.getSiteInfosById(data.elemId)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
        res.redirect('/admin/sites')
        return undefined
      }
      res.render('admin_site_updform.ejs', {
        onSites: true, site: response,
        userInfo: req.session.passport.user,
        infosui: req.session.ocppcsms
      })
      req.session.ocppcsms = {}
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/admin/sites')
      return undefined
    }
  },
  UpdSiteSchema: {
    sitepk: {
      isInt: true, trim: true, escape: true
    },
    sname: {
      trim: true, escape: true,
      isLength: { options: { min: 5, max:50 } },
      matches: { options: /^[a-zA-Z0-9-_ ]*$/ }
    },
    saddr: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true,
      isLength: { options: { max:255 } }
    },
    scodp: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true, isPostalCode: { options: 'any' }
    },
    sville: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true, isLength: { options: { max: 150 } },
      toUpperCase: true
    }
  },
  updSite: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        sid: data.sitepk,
        name: data.sname,
        address: data.saddr,
        codp: data.scodp,
        ville: data.sville
      }
      let response = await sqlite.updSite(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/admin/sites')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/admin/site/edit/' + req.params.sitepk)
      return undefined
    }
  },
  delSite: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        sid: data.elemId
      }
      let response = await sqlite.delSite(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/admin/sites')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/admin/sites')
      return undefined
    }
  },
  /* USERS */
  getAllUsers: async (req, res) => {
    // Get All Users
    const result = await sqlite.getAllUsers()
    if (result.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${result.error}`}] }
    }
    // Get number of admins
    const nbadmin = await sqlite.getNbAdmins()
    if (nbadmin.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${nbadmin.error}`}] }
    }
    // Get All Sites - Form Select
    const sites = await sqlite.getAllSites()
    if (sites.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${sites.error}`}] }
    }
    // Pendings Stations
    const PendingCB = await JSONFilePreset(utils.rootdir() + '/datas/pendings.json', { pendings: [] })
    const { pendings } = PendingCB.data
    // Render
    res.render('admin_users.ejs', {
      onUsers: true, users: result, sites: sites,
      pendings: pendings, nbAdmin: nbadmin,
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
    password: {
      trim: true, escape: true, isString: true,
      isStrongPassword: { options: { minLength: 8, maxLength: 50 } }
    },
    uname: {
      trim: true, escape: true,
      isLength: { options: { min: 5, max:50 } },
      matches: { options: /^[a-zA-Z0-9-_ ]*$/ },
    },
    ulevel: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true, isInt: true,
      default: null
    }
  },
  addUser: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let crypted = await bcrypt.hash(data.password, 10)
      let params = {
        umail: data.usermail,
        uname: data.uname,
        upass: crypted,
        owner: data.ulevel,
        admin: 0
      }
      // Set Admin if needed
      if (data.ulevel == 0) {
        params.admin = 1
        params.owner = null
      }
      let response = await sqlite.addUser(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
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
  formUpdUser: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let response = await sqlite.getUserInfosById(data.elemId)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
        res.redirect('/users')
        return undefined
      }
      // Get number of admins
      const nbadmin = await sqlite.getNbAdmins()
      if (nbadmin.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${nbadmin.error}`}] }
      }
      // Get All Sites - Form Select
      const sites = await sqlite.getAllSites()
      if (sites.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${sites.error}`}] }
      }
      // Render
      res.render('admin_user_updform.ejs', {
        onUsers: true, user: response, sites: sites,
        nbAdmin: nbadmin,
        userInfo: req.session.passport.user,
        infosui: req.session.ocppcsms
      })
      req.session.ocppcsms = {}
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/users')
      return undefined
    }
  },
  UserUpdSchema: {
    userpk: {
      isInt: true, trim: true, escape: true
    },
    usermail: {
      normalizeEmail: true,
      isEmail: {options: {allow_ip_domain: false}}
    },
    password: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true, isString: true,
      isStrongPassword: { options: { minLength: 8, maxLength:50 } }
    },
    uname: {
      matches: { options: /^[a-zA-Z0-9-_ ]*$/ },
      trim: true, escape: true,
      isLength: { options: { min: 5, max:50 } }
    },
    ulevel: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true, isInt: true,
      default: null
    }
  },
  updUser: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      // Password not set if empty
      let params
      if (data.password) {
        let crypted = await bcrypt.hash(data.password, 10)
        params = {
          uid: data.userpk,
          umail: data.usermail,
          uname: data.uname,
          upass: crypted,
          owner: data.ulevel,
          admin: 0
        }
      } else {
        params = {
          uid: data.userpk,
          umail: data.usermail,
          uname: data.uname,
          owner: data.ulevel,
          admin: 0
        }
      }
      // Set Admin if needed
      if (data.ulevel == 0) {
        params.admin = 1
        params.owner = null
      }
      let response = await sqlite.updUser(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/users')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/admin/users/edit/' + req.params.userpk)
      return undefined
    }
  },
  delUser: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        uid: data.elemId
      }
      let response = await sqlite.delUser(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
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
  /* RFIDS */
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
  formUpdRfidTag: async (req,res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let response = await sqlite.getRfidTagInfosById(data.elemId)
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
      const users = await sqlite.getAllUsers()
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
        blocked: data.rfblocked
      }
      let response = await sqlite.updRfidTag(params, req.session.passport.user.isAdmin)
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
  delRfidTag: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        rf_pk: data.elemId
      }
      let response = await sqlite.delRfidTag(params, req.session.passport.user.isAdmin)
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
  /* OCPP Default Configuration for all chargers */
  formConfigOcpp: async(req, res) => {
    // Pendings Stations
    const PendingCB = await JSONFilePreset(utils.rootdir() + '/datas/pendings.json', { pendings: [] })
    const { pendings } = PendingCB.data
    res.render('admin_formconfigocpp.ejs', {
      pendings: pendings,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  dataConfigOcpp: async(req, res) => {
    // data call from bs-table
    const result = await sqlite.getOcppDefaultConf()
    res.send(result)
  },
  ConfOcppSchema: {
    newcfg_pk: {
      trim: true, escape: true,
      isInt: { options: {min: 1, max: 20} }
    },
    newenabled : {
      isBoolean: true,
      toBoolean: true
    },
    newvalue : {
      exists: {
        if: body('newenabled').equals('true')
      },
      trim: true, escape: true,
      isEmpty: { negated: true },
      isString: true
    }
  },
  updateConfigOcpp: async(req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        cfg_pk: data.newcfg_pk,
        value: data.newvalue,
        enabled: data.newenabled === true ? 1 : 0
      }
      let response = await sqlite.updOcppDefaultConf(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/admin/ocppdefault')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/admin/ocppdefault')
      return undefined
    }
  },
  /* Pendings Station */
  PendingSchema: {
    ocppName: { trim: true, escape: true},
    action: {
      isIn: {
        options: [['Accepted', 'Rejected']],
      }
    }
  },
  ajaxPendings: async(req, res) => {
    const PendingCB = await JSONFilePreset(utils.rootdir() + '/datas/pendings.json', { pendings: [] })
    const { pendings } = PendingCB.data
    const file = fs.readFileSync(utils.rootdir() + '/views/partials/pendingchargers.ejs', 'utf-8')
    const tpl = ejs.compile(file, {client: true, async: true})
    const html = await tpl({pendings: pendings, texts: req.i18n_texts})
    res.send({ html: html, nbpending: pendings.length })
  },
  registerPending: async(req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      const data = matchedData(req)
      const params = {
        ocppid: data.ocppName,
        cbname: data.ocppName,
        regstatus: data.action
      }
      // Ajout en DB
      let result = await sqlite.AutoAddChargeBox(params)
      if (result.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${result.error}`}] }
        res.redirect('/dashboard')
        return undefined
      }
      // DB OK => effacement pending
      const PendingCB = await JSONFilePreset(utils.rootdir() + '/datas/pendings.json', { pendings: [] })
      const { pendings } = PendingCB.data
      if (pendings.find((cb) => cb.id === data.ocppName) !== undefined) {
        const index = pendings.findIndex((cb) => cb.id === data.ocppName)
        await PendingCB.update( ({pendings}) => pendings.splice(index, 1) )
      }
      res.redirect('/dashboard')
      return undefined
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/dashboard')
      return undefined
    }
  },
  /* STATIONS */
  getAllStations: async (req, res) => {
    // Get all Stations
    const result = await sqlite.getAllStations()
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
    // WebSocket information
    let wsdata = {
      wsfqdn: utils.config().ocpp.hostws
    }
    res.render('admin_stations.ejs', {
      onStations: true, stations: result, sites: sites,
      pendings: pendings, wsinfo: wsdata,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  StationSchema: {
    cbname: {
      trim: true, escape: true,
      matches: { options: /^[a-zA-Z0-9-_ ]*$/ },
      isLength: {options: {min: 4, max:75}},
    },
    cbsite: {
      isInt: true, trim: true, escape: true
    },
    cbid: {
      matches: { options: /^[a-zA-Z0-9-_]*$/ },
      isLength: {options: {min: 5, max:75}},
      trim: true, escape: true
    },
    regstatus: {
      trim: true,
      isIn: {
        options: [['Accepted', 'Rejected', 'Pending']],
      }
    },
    cbpwd: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true,
      isLength: {options: {min: 5, max:75}}
    }
  },
  addStation: async(req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        ocppid: data.cbid,
        cbname: data.cbname,
        cbpwd: data.cbpwd || null,
        cbsite: data.cbsite,
        regstatus: data.regstatus
      }
      let response = await sqlite.addStation(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/admin/stations')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/admin/stations')
      return undefined
    }
  },
  formUpdStation: async(req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let response = await sqlite.getStationInfosById(data.elemId)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
        res.redirect('/admin/stations')
        return undefined
      }
      // Get Sites - Form Select
      let sites = await sqlite.getAllSites()
      if (sites.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${sites.error}`}] }
      }
      // render
      res.render('admin_station_updform.ejs', {
        charger: response, sites: sites,
        userInfo: req.session.passport.user,
        infosui: req.session.ocppcsms
      })
      req.session.ocppcsms = {}
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/admin/stations')
      return undefined
    }
  },
  updStationSchema: {
    cbpk: {
      isInt: true, trim: true, escape: true
    },
    cbname: {
      trim: true, escape: true,
      matches: { options: /^[a-zA-Z0-9-_ ]*$/ },
      isLength: {options: {min: 4, max:75}},
    },
    cbsite: {
      isInt: true, trim: true, escape: true
    },
    cbid: {
      matches: { options: /^[a-zA-Z0-9-_]*$/ },
      isLength: {options: {min: 5, max:75}},
      trim: true, escape: true
    },
    regstatus: {
      trim: true,
      isIn: {
        options: [['Accepted', 'Rejected', 'Pending']],
      }
    },
    cbpwd: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true,
      isLength: {options: {min: 5, max:75}}
    }
  },
  updStation: async(req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        cbpk: data.cbpk,
        ocppid : data.cbid,
        cbname: data.cbname,
        cbpwd: data.cbpwd || null,
        cbsite: data.cbsite,
        regstatus: data.regstatus
      }
      let response = await sqlite.updStation(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/admin/stations')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/admin/stations')
      return undefined
    }
  },
  delStation: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        cbpk: data.elemId
      }
      let response = await sqlite.delStation(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/admin/stations')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/admin/stations')
      return undefined
    }
  },
  getStationDiag: async (req, res) => {
    const data = matchedData(req)
    // TODO : FTP url from config
    //data.url = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`).toString()
    //data.url = 'http://10.42.5.13:8080/admin/station/WBCB1082422/diagnostic'
    let result = await csms.GetDiagnostics(data)
    req.session.ocppcsms.ocppResult = result
    res.redirect('/admin/stations')
  },
  recvDiagnosticFile: async (req, res) => {
    req.pipe(fs.createWriteStream(utils.rootdir() + '/' + req.params.fileName))
    req.on('end', function () {
      res.sendStatus(200)
    })
  }
}

export default AdminController