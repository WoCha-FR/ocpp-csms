import { matchedData, validationResult } from 'express-validator'
import { JSONFilePreset } from 'lowdb/node'
import utils from '../../helpers/utils.js'
import ReportDB from '../../datas/reports-db.js'

const ReportController = {
  // ADMIN - Accueil des rapports
  getReportPage: async(req,res) => {
    // Pendings Stations
    const PendingCB = await JSONFilePreset(utils.rootdir() + '/datas/pendings.json', { pendings: [] })
    const { pendings } = PendingCB.data
    res.render('admin_reports.ejs', {
      onReports: true,
      pendings: pendings,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  // Liste des rapports bsTble
  ajaxGetChargingReports: async(req,res) => {
    const res1 = await ReportDB.getTransacList()
    //TODO: Gestion erreurs SQL?
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
      let data = matchedData(req)
      let params = {
        tpk: data.elemId
      }
      const res1 = await ReportDB.getTransacGraphData(params)
      if (res1.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res1.error}`}] }
      }
      res.render('report_charge_session.ejs', {
        all: res1,
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