import { matchedData, validationResult } from 'express-validator'
import bcrypt from 'bcrypt'
import sqlite from '../../datas/db.js'
import utils from '../../helpers/utils.js'

const OwnerController = {
  /* DASHBOARD */
  getDashboard: async (req, res) => {
    // Stations status
    const res1 = await sqlite.getDashboardCBStatus(req.session.passport.user.ownedSite)
    if (res1.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{ sqlerror: `${res1.error}` }] }
    }
    // Connectors status
    const res2 = await sqlite.getDashboardConnStatus(req.session.passport.user.ownedSite)
    if (res2.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{ sqlerror: `${res2.error}` }] }
    }
    // Stations / Connectors / Transactions
    const res3 = await sqlite.getDashboardSiteCbConnTransac(req.session.passport.user.ownedSite)
    if (res3.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{ sqlerror: `${res3.error}` }] }
    }
    // Render
    res.render('owner_dashboard.ejs', {
      onDashboard: true,
      stations: res1,
      connectors: res2,
      siteconns: res3,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms,
    })
    req.session.ocppcsms = {}
  },
  /* USERS */
  getAllUsers: async (req, res) => {
    const result = await sqlite.getSiteUsers(req.session.passport.user.ownedSite)
    if (result.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{ sqlerror: `${result.error}` }] }
    }
    // Render
    res.render('site_users.ejs', {
      onUsers: true,
      siteusers: result,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms,
    })
    req.session.ocppcsms = {}
  },
  UserAddSchema: {
    usermail: {
      normalizeEmail: { options: { gmail_remove_dots: false } },
      isEmail: { options: { allow_ip_domain: false } },
    },
    uname: {
      trim: true,
      escape: true,
      isLength: { options: { min: 5, max: 50 } },
      matches: { options: /^[a-zA-ZÀ-Ÿ0-9-_ ]*$/ },
    },
  },
  addSiteUser: async (req, res) => {
    const result = validationResult(req)
    let uid = null
    if (result.isEmpty()) {
      const data = matchedData(req)
      // Recup UserPK from users table if exists.
      const response = await sqlite.getUserIdByMail(data)
      if (response) {
        if (response.error) {
          req.session.ocppcsms.ocppErrors = { sqlite: [{ sqlerror: `${response.error}` }] }
        } else {
          uid = response.user_pk
        }
      } else {
        // Password generation
        const pwd = utils.generatePwd(15)
        const crypted = await bcrypt.hash(pwd, 10)
        // Create in users table.
        const params = { umail: data.usermail, uname: data.usermail, upass: crypted, owner: null, admin: null }
        const response2 = await sqlite.addUser(params)
        if (response2.error) {
          req.session.ocppcsms.ocppErrors = { sqlite: [{ sqlerror: `${response2.error}` }] }
        } else {
          uid = response2.lastInsertRowid
          // Send mail to new user if created
          utils.event.emit('userCreated', data.usermail, pwd)
        }
      }
      // Add in sites_users table if creation OK
      if (uid) {
        const params2 = { spk: req.session.passport.user.ownedSite, upk: uid, uname: data.uname }
        const response3 = await sqlite.addSiteUser(params2)
        if (response3.error) {
          req.session.ocppcsms.ocppErrors = { sqlite: [{ sqlerror: `${response3.error}` }] }
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
      let params = { pk: data.elemId, spk: req.session.passport.user.ownedSite }
      let response = await sqlite.getUserSiteUserById(params)
      // Tentative d'accès à un ID inexistant ou hors site
      if (!response) {
        res.redirect('/not-found')
        return undefined
      }
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{ sqlerror: `${response.error}` }] }
        res.redirect('/users')
        return undefined
      }
      // Render
      res.render('site_user_updform.ejs', {
        onUsers: true,
        user: response,
        userInfo: req.session.passport.user,
        infosui: req.session.ocppcsms,
      })
      req.session.ocppcsms = {}
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/users')
      return undefined
    }
  },
  UserUpdSchema: {
    pk: { isInt: true, trim: true, escape: true },
    uname: {
      trim: true,
      escape: true,
      isLength: { options: { min: 5, max: 50 } },
      matches: { options: /^[a-zA-ZÀ-Ÿ0-9-_ ]*$/ },
    },
  },
  updSiteUser: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = { pk: data.pk, uname: data.uname, spk: req.session.passport.user.ownedSite }
      let response = await sqlite.updSiteUser(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{ sqlerror: `${response.error}` }] }
      }
      res.redirect('/users')
      return undefined
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/users')
      return undefined
    }
  },
  delSiteUser: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = { pk: data.elemId, spk: req.session.passport.user.ownedSite }
      let response = await sqlite.delSiteUser(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{ sqlerror: `${response.error}` }] }
      }
      res.redirect('/users')
      return undefined
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/users')
      return undefined
    }
  },
}

export default OwnerController
