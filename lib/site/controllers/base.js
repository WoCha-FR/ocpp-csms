import { matchedData, validationResult } from 'express-validator'
import { JSONFilePreset } from 'lowdb/node'
import bcrypt from 'bcrypt'
import utils from '../../helpers/utils.js'
import sqlite from '../../datas/db.js'

const BaseController = {
  indexPage: async (req, res) => {
    if (req.isAuthenticated()) {
      res.redirect('/dashboard')
    } else {
      res.redirect('/login')
    }
  },
  formLogin: async (req, res) => {
    res.render('login.ejs', { login_errors: req.session.messages || [] })
    req.session.messages = []
  },
  changeLanguage: async (req, res) => {
    const { lng } = req.params
    res.cookie('ocppcsmsLang', lng, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax', overwrite: true })
    const redirectPath = req.get('Referrer') || '/'
    res.redirect(redirectPath)
  },
  monCompte: async (req, res) => {
    res.render('user_account.ejs', {
       userInfo: req.session.passport.user,
       infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  updmonCompte: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      /* Password not empty */
      let params
      if (data.password) {
        if (data.password !== data.password2) {
          let error = [{
            type: "field", msg: "", location: "body",
            value: "The password confirmation field do not match",
            path: "password2"
          }]
          // Send error
          req.session.ocppcsms.ocppErrors = { ocppInput: error }
          res.redirect('/compte')
          return undefined
        } else {
          let crypted = await bcrypt.hash(data.password, 10)
          params = {
            uid: req.session.passport.user.user_pk,
            uname: data.uname,
            upass: crypted
          }
        }
      } else {
        params = {
          uid: req.session.passport.user.user_pk,
          uname: data.uname
        }
      }
      let response = await sqlite.updUserSelf(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      req.session.passport.user.name = data.uname
      res.redirect('/compte')
      return undefined
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/compte')
      return undefined
    }
  },
  redirectUsers: async(req, res) => {
    if (req.session.passport.user.isAdmin === 1) {
      res.redirect('/admin/users')
    } else {
      res.redirect('/site/users')
    }
  },
  redirectRfids: async(req, res) => {
    if (req.session.passport.user.isAdmin === 1) {
      res.redirect('/admin/rfids')
    } else {
      res.redirect('/site/rfids')
    }
  },
  redirectStations: async(req, res) => {
    if (req.session.passport.user.isAdmin === 1) {
      res.redirect('/admin/stations')
    } else {
      res.redirect('/site/stations')
    }
  },
  getDashboard: async(req, res) => {
    // TODO : Make dashboards
    // Admin dashboard OR simple Dashboard OR User Dashboard ?
    if (req.session.passport.user.isAdmin === 1) {
      const PendingCB = await JSONFilePreset(utils.rootdir() + '/datas/pendings.json', { pendings: [] })
      const { pendings } = PendingCB.data
      res.render('dashboard.ejs', {
        onDashboard: true, pendings: pendings,
        userInfo: req.session.passport.user,
        infosui: req.session.ocppcsms
      })
    } else {
      res.render('dashboard.ejs', {
        onDashboard: true,
        userInfo: req.session.passport.user,
        infosui: req.session.ocppcsms
      })
    }
    req.session.ocppcsms = {}
  },
  logout: async (req, res, next) => {
    req.logout(function(err) {
      if (err) { return next(err) }
      // TODO: Destroy session
      req.session.destroy()
      res.redirect('/')
    })
  },
  IdSchema: {
    elemId: {
      isInt: true, trim: true, escape: true
    }
  },
  CompteSchema: {
    uname: {
      trim: true, escape: true,
      isLength: { options: { min: 5, max:50 } },
      matches: { options: /^[a-zA-Z0-9-_ ]*$/ }
    },
    password: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true, isString: true,
      isStrongPassword: { options: { minLength: 8, maxLength:50 } }
    },
    password2: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true, isString: true
    },
  },
  OcppidSchema: {
    ocppName: { trim: true, escape: true}
  },
}

export default BaseController