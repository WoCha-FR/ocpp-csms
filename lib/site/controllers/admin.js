import { matchedData, validationResult, body } from 'express-validator'
import { JSONFilePreset } from 'lowdb/node'
import fs from 'fs'
import ejs from 'ejs'
import bcrypt from 'bcrypt'
import utils from '../../helpers/utils.js'
import sqlite from '../../datas/db.js'

const AdminController = {
  /* DASHBOARD */
  getDashboard: async(req,res) => {
    // Stations status
    const res1 = await sqlite.getDashboardCBStatus()
    if (res1.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res1.error}`}] }
    }
    // Connectors status
    const res2 = await sqlite.getDashboardConnStatus()
    if (res2.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res2.error}`}] }
    }
    // Sites / Stations / Connectors / Transactions
    const res3 = await sqlite.getDashboardSiteCbConnTransac()
    if (res3.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res3.error}`}] }
    }
    // Pendings Stations
    const PendingCB = await JSONFilePreset(utils.rootdir() + '/datas/pendings.json', { pendings: [] })
    const { pendings } = PendingCB.data
    // Render
    res.render('admin_dashboard.ejs', {
      onDashboard: true, stations: res1,
      connectors: res2, sitesconns: res3,
      pendings: pendings,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  /* SITES */
  getAllSites: async(req, res) => {
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
      matches: { options: /^[a-zA-ZÀ-Ÿ0-9-_ ]*$/ }
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
      const data = matchedData(req)
      let params = {
        name: data.sname,
        address: data.saddr,
        codp: data.scodp,
        ville: data.sville
      }
      // Add Site
      const res1 = await sqlite.addSite(params)
      if (res1.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res1.error}`}] }
        res.redirect('/admin/sites')
      }
      // Add Admin RFID Pass
      const res2 = await sqlite.addSiteIdToken(res1.lastInsertRowid)
      if (res2.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res2.error}`}] }
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
      // Tentative d'accès à un ID inexistant
      if (!response) {
        res.redirect('/not-found')
        return undefined
      }
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
      matches: { options: /^[a-zA-ZÀ-Ÿ0-9-_ ]*$/ }
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
  updSite: async(req, res) => {
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
  delSite: async(req, res) => {
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
  getAllUsers: async(req, res) => {
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
      normalizeEmail: {options: {gmail_remove_dots: false}},
      isEmail: {options: {allow_ip_domain: false}}
    },
    password: {
      trim: true, escape: true, isString: true,
      isStrongPassword: { options: { minLength: 8, maxLength: 50 } }
    },
    uname: {
      trim: true, escape: true,
      isLength: { options: { min: 5, max:50 } },
      matches: { options: /^[a-zA-ZÀ-Ÿ0-9-_ ]*$/ },
    },
    ulevel: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true, isInt: true,
      default: null
    }
  },
  addUser: async(req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      const data = matchedData(req)
      const crypted = await bcrypt.hash(data.password, 10)
      let params = {
        umail: data.usermail,
        uname: data.uname,
        upass: crypted,
        owner: data.ulevel,
        admin: null
      }
      // Set Admin if needed
      if (data.ulevel == 0) {
        params.admin = 1
        params.owner = null
      }
      // Insert in User Table
      const res1 = await sqlite.addUser(params)
      if (res1.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res1.error}`}] }
      } else {
        // Send mail to new user if created
        utils.event.emit('userCreated', data.usermail, data.password)
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
  formUpdUser: async(req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      const data = matchedData(req)
      const response = await sqlite.getUserInfosById(data.elemId)
      // Tentative d'accès à un ID inexistant
      if (!response) {
        res.redirect('/not-found')
        return undefined
      }
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
      // Get Sites Where is Authorized
      const usersites = await sqlite.getSitesOfUserById(data.elemId)
      if (usersites.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${usersites.error}`}] }
      }
      // Render
      res.render('admin_user_updform.ejs', {
        onUsers: true, user: response, sites: sites,
        userSites: usersites, nbAdmin: nbadmin,
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
      normalizeEmail: {options: {gmail_remove_dots: false}},
      isEmail: {options: {allow_ip_domain: false}}
    },
    password: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true, isString: true,
      isStrongPassword: { options: { minLength: 8, maxLength:50 } }
    },
    uname: {
      matches: { options: /^[a-zA-ZÀ-Ÿ0-9-_ ]*$/ },
      trim: true, escape: true,
      isLength: { options: { min: 5, max:50 } }
    },
    ulevel: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true, isInt: true,
      default: null
    }
  },
  updUser: async(req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      const data = matchedData(req)
      // Password not set if empty
      let params = {
          uid: data.userpk,
          umail: data.usermail,
          uname: data.uname,
          owner: data.ulevel,
          admin: null
      }
      if (data.password) {
        const crypted = await bcrypt.hash(data.password, 10)
        params.upass = crypted
      }
      // Set Admin if needed
      if (data.ulevel == 0) {
        params.admin = 1
        params.owner = null
      }
      const response = await sqlite.updUser(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      // Redirect
      res.redirect(req.get('Referrer') || '/users')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/admin/user/edit/' + req.params.userpk)
      return undefined
    }
  },
  delUser: async(req, res) => {
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
  delSiteUser: async (req,res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      const data = matchedData(req)
      let response = await sqlite.delSiteUserAdmin(data)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect(req.get('Referrer') || '/users')
      return undefined
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect(req.get('Referrer') || '/users')
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
    const file = fs.readFileSync(utils.rootdir() + '/web/views/partials/pendingchargers.ejs', 'utf-8')
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
}

export default AdminController