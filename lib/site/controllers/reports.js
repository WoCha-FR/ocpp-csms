import { matchedData, validationResult } from 'express-validator'
import { JSONFilePreset } from 'lowdb/node'
import utils from '../../helpers/utils.js'
import ReportDB from '../../datas/reports-db.js'

const ReportController = {
  // ADMIN - Accueil des rapports
  getAdminReportPage: async(req,res) => {
    // Pendings Stations
    const PendingCB = await JSONFilePreset(utils.rootdir() + '/datas/pendings.json', { pendings: [] })
    const { pendings } = PendingCB.data
    res.render('admin_reports.ejs', {
      onReports: true, pendings: pendings,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  // OWNER - Accueil des rapports
  getOwnerReportPage: async(req,res) => {
    res.render('site_reports.ejs', {
      onReports: true,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  // All Users - Accueil des rapports
  getUserReportPage: async(req,res) => {
    res.render('user_reports.ejs', {
      onReports: true,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  getChargingReportsSchema: {
    start: {
      isInt: true, trim: true, escape: true
    },
    stop: {
      isInt: true, trim: true, escape: true
    }
  },
  // Liste des rapports bsTable
  ajaxGetGrantedChargingReports: async(req,res) => {
    let data = matchedData(req)
    data.sid = req.session.passport.user.ownedSite
    const res1 = await ReportDB.getTransacList(data)
    if (res1.error) {
      res.status(500).send(`${res1.error}`)
      return undefined
    }
    res.send(res1)
  },
  // Session de charge
  getChargeReport: async(req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      const data = matchedData(req)
      const params = {
        tpk: data.elemId
      }
      //TODO: Show only for Admin / SiteAdmin of charger / User who have charged
      const res1 = await ReportDB.getTransacData(params)
      if (res1.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res1.error}`}] }
      }
      const res2 = await ReportDB.getTransacGraphData(params)
      if (res2.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res2.error}`}] }
      }
      res.render('report_charge_session.ejs', {
        onReports: true, data: res1, all: res2,
        userInfo: req.session.passport.user,
        infosui: req.session.ocppcsms
      })
      req.session.ocppcsms = {}
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect(req.get('Referrer') || '/')
      return undefined
    }
  }
}

export default ReportController