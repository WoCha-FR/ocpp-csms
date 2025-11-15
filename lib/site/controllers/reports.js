import { matchedData, validationResult } from 'express-validator'
import sqlite from '../../datas/db.js'

const ReportController = {
  // Session  de charge
  getChargeReport: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        tpk: data.elemId
      }
      const res3 = await sqlite.getTransacGraphData(params)
      if (res3.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res3.error}`}] }
      }
      res.render('report_charge_session.ejs', {
        all: res3,
        userInfo: req.session.passport.user,
        infosui: req.session.ocppcsms
      })
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('')
      return undefined
    }
  }
}

export default ReportController