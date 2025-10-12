import { JSONFilePreset } from 'lowdb/node'
import utils from '../../helpers/utils.js'

const BaseController = {
  indexPage: (req, res) => {
    if (req.isAuthenticated()) {
      res.redirect('/dashboard')
    } else {
      res.redirect('/login')
    }
  },
  formLogin: (req, res) => {
    res.render('login.ejs', { login_errors: req.session.messages || [] })
    req.session.messages = []
  },
  changeLanguage: (req, res) => {
    const { lng } = req.params
    res.cookie('ocppcsmsLang', lng, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax', overwrite: true })
    const redirectPath = req.get('Referrer') || '/'
    res.redirect(redirectPath)
  },
  getDashboard: async(req, res) => {
    // Propriétaire ou admin ?
    if (req.session.passport.user.level === 1) {
      // TODO Status of all and owned
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
  redirectStations: async(req, res) => {
    if (req.session.passport.user.level === 1) {
      res.redirect('/admin/stations')
    } else {
      res.redirect('/userstations')
    }
  },
  redirectRfids: async(req, res) => {
    if (req.session.passport.user.level === 1) {
      res.redirect('/admin/rfids')
    } else {
      res.redirect('/userrfids')
    }
  },
  logout: (req, res, next) => {
    req.logout(function(err) {
      if (err) { return next(err) }
      //req.session.destroy()
      res.redirect('/')
    })
  },
}

export default BaseController