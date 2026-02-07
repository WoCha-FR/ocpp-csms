import conf from 'config'
import { matchedData, validationResult } from 'express-validator'
import bcrypt from 'bcrypt'
import UserDB from '../../datas/user-db.js'

const BaseController = {
  indexPage: async (req, res) => {
    if (req.isAuthenticated()) {
      // Mobile or Desktop redirection
      if (req.useragent.isMobile) {
        res.redirect('/mydashboard')
      } else {
        if (req.session.passport.user.isAdmin === 1) {
          res.redirect('/admin/dashboard')
        } else if (req.session.passport.user.ownedSite !== null) {
          res.redirect('/site/dashboard')
        } else {
          res.redirect('/mydashboard')
        }
      }
    } else {
      res.redirect('/auth/login')
    }
  },
  formLogin: async (req, res) => {
    const ggle = conf.get('authGoogle.enabled')
    res.render('login.ejs', { withGoogle: ggle, login_errors: req.session.messages || [] })
    req.session.messages = []
  },
  changeLanguage: async (req, res) => {
    const { lng } = req.params
    res.cookie('ocppcsmsLang', lng, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax', overwrite: true })
    const redirectPath = req.get('Referrer') || '/'
    res.redirect(redirectPath)
  },
  monCompte: async (req, res) => {
    const res1 = await UserDB.getUserNotifsData(req.session.passport.user.user_pk)
    if (res1.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{ sqlerror: `${res1.error}` }] }
    }
    res.render('user_account.ejs', { userInfo: req.session.passport.user, userNotifs: res1, infosui: req.session.ocppcsms })
    req.session.ocppcsms = {}
  },
  updMonCompte: async (req, res, next) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      /* Password not empty */
      let params
      if (data.password) {
        if (data.password !== data.password2) {
          // Send error in SQLite format for more lisibility
          req.session.ocppcsms.ocppErrors = { sqlite: [{ sqlerror: 'The password confirmation field do not match' }] }
          res.redirect('/compte')
          return undefined
        } else {
          let crypted = await bcrypt.hash(data.password, 10)
          params = { uid: req.session.passport.user.user_pk, uname: data.uname, upass: crypted }
        }
      } else {
        params = { uid: req.session.passport.user.user_pk, uname: data.uname }
      }
      let response = await UserDB.updUserSelf(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{ sqlerror: `${response.error}` }] }
      }
      // req.session.passport.user.name = data.uname
      req.session.reload(function (err) {
        if (err) {
          return next(err)
        }
      })
      req.session.save(function (err) {
        if (err) {
          return next(err)
        }
      })
      res.redirect('/compte')
      return undefined
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/compte')
      return undefined
    }
  },
  updMesNotifications: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        uid: req.session.passport.user.user_pk,
        lng: data.lang,
        eml: data.emailNotifs || 0,
        psh: data.pushNotifs || 0,
        pshu: data.pushUser || null,
        psht: data.pushToken || null,
        cbon: data.cbOnline || 0,
        cboff: data.cbOffline || 0,
        conf: data.conFaulted || 0,
        cona: data.conAvailable || 0,
        conu: data.conUnavailable || 0,
        cbdg: data.cbDiag || 0,
        chgd: data.chgStart || 0,
        chgf: data.chgStop || 0,
        chge: data.chgEvent || 0,
      }
      let response = await UserDB.updUserNotifs(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{ sqlerror: `${response.error}` }] }
      }
      res.redirect('/compte')
      return undefined
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/compte')
      return undefined
    }
  },
  redirectDashboard: async (req, res) => {
    // Mobile or Desktop redirection
    if (req.useragent.isMobile) {
      res.redirect('/mydashboard')
    } else {
      if (req.session.passport.user.isAdmin === 1) {
        res.redirect('/admin/dashboard')
      } else if (req.session.passport.user.ownedSite !== null) {
        res.redirect('/site/dashboard')
      } else {
        res.redirect('/mydashboard')
      }
    }
  },
  redirectUsers: async (req, res) => {
    if (req.session.passport.user.isAdmin === 1) {
      res.redirect('/admin/users')
    } else {
      res.redirect('/site/users')
    }
  },
  redirectRfids: async (req, res) => {
    if (req.session.passport.user.isAdmin === 1) {
      res.redirect('/admin/rfids')
    } else {
      res.redirect('/site/rfids')
    }
  },
  redirectStations: async (req, res) => {
    if (req.session.passport.user.isAdmin === 1) {
      res.redirect('/admin/stations')
    } else {
      res.redirect('/site/stations')
    }
  },
  logout: async (req, res, next) => {
    req.logout(function (err) {
      if (err) {
        return next(err)
      }
      req.session.destroy(function (err) {
        if (err) {
          return next(err)
        }
        res.clearCookie('connect.sid')
        res.redirect('/')
      })
    })
  },
  IdSchema: { elemId: { isInt: true, trim: true, escape: true } },
  CompteSchema: {
    uname: {
      trim: true,
      escape: true,
      isLength: { options: { min: 5, max: 50 } },
      matches: { options: /^[a-zA-ZÀ-Ÿ0-9-_ ]*$/ },
    },
    password: {
      optional: { options: { values: 'falsy' } },
      trim: true,
      escape: true,
      isString: true,
      isStrongPassword: { options: { minLength: 8, maxLength: 50 } },
    },
    password2: { optional: { options: { values: 'falsy' } }, trim: true, escape: true, isString: true },
  },
  NotifsSchema: {
    lang: { isIn: { options: [['en', 'fr']] } },
    emailNotifs: { optional: true, default: 0, isIn: { options: [[0, 1]] } },
    pushNotifs: { optional: true, default: 0, isIn: { options: [[0, 1]] } },
    pushUser: {
      trim: true,
      escape: true,
      optional: true,
      isLength: { options: { min: 30, max: 30 } },
      matches: { options: /^[a-zA-Z0-9]*$/ },
    },
    pushToken: {
      trim: true,
      escape: true,
      optional: true,
      isLength: { options: { min: 30, max: 30 } },
      matches: { options: /^[a-zA-Z0-9]*$/ },
    },
    cbOnline: { optional: true, default: 0, isIn: { options: [[0, 1]] } },
    cbOffline: { optional: true, default: 0, isIn: { options: [[0, 1]] } },
    conFaulted: { optional: true, default: 0, isIn: { options: [[0, 1]] } },
    conAvailable: { optional: true, default: 0, isIn: { options: [[0, 1]] } },
    conUnavailable: { optional: true, default: 0, isIn: { options: [[0, 1]] } },
    cbDiag: { optional: true, default: 0, isIn: { options: [[0, 1]] } },
    chgStart: { optional: true, default: 0, isIn: { options: [[0, 1]] } },
    chgStop: { optional: true, default: 0, isIn: { options: [[0, 1]] } },
    chgEvent: { optional: true, default: 0, isIn: { options: [[0, 1]] } },
  },
  OcppidSchema: { ocppName: { trim: true, escape: true } },
  getDashboard: async (req, res) => {
    // List of Authorized Chargers
    const res1 = await UserDB.getUserChargeBox(req.session.passport.user.user_pk)
    if (res1.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{ sqlerror: `${res1.error}` }] }
    }
    res.render('user_dashboard.ejs', {
      onDashboard: true,
      chargers: res1,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms,
    })
    req.session.ocppcsms = {}
  },
  ajaxUpdUserDashboard: async (req, res) => {
    const res1 = await UserDB.getUserChargeBox(req.session.passport.user.user_pk)
    if (res1.error) {
      res.status(500).send(res1.error)
    }
    res.send({ data: res1 })
  },
  getConnectors: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      const data = matchedData(req)
      const params = { cbid: data.ocppName, uid: req.session.passport.user.user_pk }
      // Charger informations
      const res1 = await UserDB.getChargeBoxInfos(params)
      // Tentative d'accès à un ID inexistant ou hors site
      if (!res1) {
        res.redirect('/forbidden')
        return undefined
      }
      if (res1.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{ sqlerror: `${res1.error}` }] }
        res.redirect('/stations')
      }
      // List of connectors
      const res2 = await UserDB.getChargeBoxConnectors(params)
      if (res2.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{ sqlerror: `${res2.error}` }] }
      }
      // Render
      res.render('user_connectors.ejs', {
        onDashboard: true,
        charger: res1,
        connectors: res2,
        userInfo: req.session.passport.user,
        infosui: req.session.ocppcsms,
      })
      req.session.ocppcsms = {}
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/mydashboard')
      return undefined
    }
  },
  ajaxUpdUserChargerStatus: async (req, res) => {
    const data = matchedData(req)
    const params = { cbid: data.ocppName, uid: req.session.passport.user.user_pk }
    const result = await UserDB.getChargeBoxInfos(params)
    if (!result) {
      res.status(404).send('Not Found')
    }
    if (result.error) {
      res.status(500).send(result.error)
    }
    res.send({ data: result })
  },
  ajaxUpdUserChargerConnsStatus: async (req, res) => {
    const data = matchedData(req)
    const params = { cbid: data.ocppName, uid: req.session.passport.user.user_pk }
    const result = await UserDB.getChargeBoxConnectors(params)
    if (!result) {
      res.status(404).send('Not Found')
    }
    if (result.error) {
      res.status(500).send(result.error)
    }
    res.send({ data: result })
  },
}

export default BaseController
