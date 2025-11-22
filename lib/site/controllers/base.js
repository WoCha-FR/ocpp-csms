import { matchedData, validationResult } from 'express-validator'
import bcrypt from 'bcrypt'
import sqlite from '../../datas/db.js'

const BaseController = {
  indexPage: async(req, res) => {
    if (req.isAuthenticated()) {
      res.redirect('/dashboard')
    } else {
      res.redirect('/login')
    }
  },
  formLogin: async(req, res) => {
    res.render('login.ejs', { login_errors: req.session.messages || [] })
    req.session.messages = []
  },
  changeLanguage: async(req, res) => {
    const { lng } = req.params
    res.cookie('ocppcsmsLang', lng, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax', overwrite: true })
    const redirectPath = req.get('Referrer') || '/'
    res.redirect(redirectPath)
  },
  monCompte: async(req, res) => {
    res.render('user_account.ejs', {
       userInfo: req.session.passport.user,
       infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  updmonCompte: async(req, res, next) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      /* Password not empty */
      let params
      if (data.password) {
        if (data.password !== data.password2) {
          // Send error in SQLite format for more lisibility
          req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: 'The password confirmation field do not match'}] }
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
      // req.session.passport.user.name = data.uname
      req.session.reload(function(err) {
        if (err) { return next(err) }
      })
      req.session.save(function(err) {
        if (err) { return next(err) }
      })
      res.redirect('/compte')
      return undefined
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/compte')
      return undefined
    }
  },
  redirectDashboard: async(req, res) => {
    if (req.session.passport.user.isAdmin === 1) {
      res.redirect('/admin/dashboard')
    } else if (req.session.passport.user.ownedSite !== null) {
      res.redirect('/site/dashboard')
    } else {
      res.redirect('/mydashboard')
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
  logout: async(req, res, next) => {
    req.logout(function(err) {
      if (err) { return next(err) }
      req.session.destroy(function(err) {
        if (err) { return next(err) }
        res.clearCookie('connect.sid');
        res.redirect('/');
      })
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
      matches: { options: /^[a-zA-ZÀ-Ÿ0-9-_ ]*$/ }
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
  getDashboard: async(req, res) => {
    res.render('user_dashboard.ejs', {
      onDashboard: true,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  }
}

export default BaseController