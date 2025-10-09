import { matchedData, validationResult, body } from 'express-validator'
import { JSONFilePreset } from 'lowdb/node'
import { URL } from 'url'
import fs from 'fs'
import ejs from 'ejs'
import bcrypt from 'bcrypt'
import utils from '../../helpers/utils.js'
import sqlite from '../../datas/db.js'
import csms from '../../csms/csms.js'

const AdminController = {
  getAllUsers: async (req, res) => {
    // Get All Users
    const result = await sqlite.getAllUsers()
    if (result.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${result.error}`}] }
    }
    res.render('users.ejs', {
      users: result,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  UserSchema: {
    uname: {
      trim: true, escape: true,
      isLength: { options: { min: 5, max:50 } },
      matches: { options: /^[a-zA-Z0-9-_ ]*$/ },
    },
    umail: {
      normalizeEmail: true,
      isEmail: {options: {allow_ip_domain: false}}
    },
    username: {
      trim: true, escape: true,
      isLength: { options: { min: 5, max:50 } },
      matches: { options: /^[a-zA-Z0-9-_]*$/ },
    },
    password: {
      trim: true, escape: true, isString: true,
      isStrongPassword: { options: { minLength: 8, maxLength: 50 } }
    },
    ulevel: {
      trim: true, escape: true,
      isInt: { options: {min: 1, max: 3} }
    }
  },
  addUser: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let crypted = await bcrypt.hash(data.password, 10)
      let params = {
        name: data.uname,
        umail: data.umail,
        uname: data.username,
        upass: crypted,
        ulvl: data.ulevel
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
  UserId: {
    userId: {
      isInt: true, trim: true, escape: true
    }
  },
  formUpdUser: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let response = await sqlite.getUserInfosById(data.userId)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
        res.redirect('/users')
        return undefined
      }
      res.render('users_update.ejs', {
        user: response,
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
    uname: {
      matches: { options: /^[a-zA-Z0-9-_ ]*$/ },
      trim: true, escape: true,
      isLength: { options: { min: 5, max:50 } }
    },
    umail: {
      normalizeEmail: true,
      isEmail: {options: {allow_ip_domain: false}}
    },
    username: {
      trim: true, escape: true,
      isLength: { options: { min: 5, max:50 } },
      matches: { options: /^[a-zA-Z0-9-_]*$/ },
    },
    password: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true, isString: true,
      isStrongPassword: { options: { minLength: 8, maxLength:50 } }
    },
    ulevel: {
      trim: true, escape: true,
      isInt: { options: {min: 1, max: 3} }
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
          name: data.uname,
          umail: data.umail,
          uname: data.username,
          upass: crypted,
          ulvl: data.ulevel
        }
      } else {
        params = {
          uid: data.userpk,
          name: data.uname,
          umail: data.umail,
          uname: data.username,
          ulvl: data.ulevel
        }
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
      res.redirect('/users/edit/' + req.params.userpk)
      return undefined
    }
  },
  delUser: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        uid: data.userId
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
  getAllChargers: async (req, res) => {
    // Get all Stations
    const result = await sqlite.getAllChargers()
    if (result.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${result.error}`}] }
    }
    // Get Users - Form Select
    const users = await sqlite.getAllUsers()
    if (users.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${users.error}`}] }
    }
    res.render('stations_admin.ejs', {
      onStations: true, stations: result, users: users,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  formConfigOcpp: async(req, res) => {
    res.render('configocpp.ejs', {
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  dataConfigOcpp: async(req, res) => {
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
      res.redirect('/configocpp')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/configocpp')
      return undefined
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
  PendingSchema: {
    ocppName: { trim: true, escape: true},
    action: {
      isIn: {
        options: [['Accepted', 'Rejected']],
      }
    }
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
  ChargerSchema: {
    cbname: {
      trim: true, escape: true,
      matches: { options: /^[a-zA-Z0-9-_ ]*$/ },
      isLength: {options: {min: 5, max:75}},
    },
    cbuser: {
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
  addCharger: async(req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        ocppid : data.cbid,
        cbname: data.cbname,
        cbpwd: data.cbpwd || null,
        cbuser: data.cbuser,
        regstatus: data.regstatus
      }
      let response = await sqlite.AdminAddChargeBox(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/adminstations')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/adminstations')
      return undefined
    }
  },
  updChargerSchema: {
    cbpk: {
      isInt: true, trim: true, escape: true
    },
    cbname: {
      trim: true, escape: true,
      matches: { options: /^[a-zA-Z0-9-_ ]*$/ },
      isLength: {options: {min: 5, max:75}},
    },
    cbuser: {
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
  updCharger: async(req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        cbpk: data.cbpk,
        ocppid : data.cbid,
        cbname: data.cbname,
        cbpwd: data.cbpwd || null,
        cbuser: data.cbuser,
        regstatus: data.regstatus
      }
      let response = await sqlite.updChargeBox(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/adminstations')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/adminstations')
      return undefined
    }
  },
  ChargerId: {
    chargerId: {
      isInt: true, trim: true, escape: true
    }
  },
  formUpdCharger: async(req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let response = await sqlite.getChargeBoxInfosById(data.chargerId)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
        res.redirect('/adminstations')
        return undefined
      }
      // Get Users - Form Select
      let users = await sqlite.getAllUsers()
      if (users.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${users.error}`}] }
      }
      // render
      res.render('station_update.ejs', {
        charger: response, users: users,
        userInfo: req.session.passport.user,
        infosui: req.session.ocppcsms
      })
      req.session.ocppcsms = {}
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/adminstations')
      return undefined
    }
  },
  delCharger: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        cbpk: data.chargerId
      }
      let response = await sqlite.delChargeBox(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/adminstations')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/adminstations')
      return undefined
    }
  },
  OcppidSchema: {
    ocppName: { trim: true, escape: true}
  },
  getDiagnostic: async (req, res) => {
    const data = matchedData(req)
    // TOTO : Determine URL from express
    data.url = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`).toString()
    let result = await csms.GetDiagnostics(data)
    req.session.ocppcsms.ocppResult = result
    res.redirect('/adminstations')
  },
  recvDiagnosticFile: async (req, res) => {
    req.pipe(fs.createWriteStream(utils.rootdir() + '/' + req.params.fileName))
    req.on('end', function () {
      res.sendStatus(200)
    })
  }
}

export default AdminController