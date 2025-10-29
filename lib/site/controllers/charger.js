import { matchedData } from 'express-validator'
import sqlite from '../../datas/db.js'
// import csms from '../../csms/csms.js'
// , validationResult

const ChargerController = {
  getMainPage: async (req, res) => {
    const data = matchedData(req)
    // Get ChargeBox table data
    const res1 = await sqlite.getChargeBoxByName(data.ocppName, req.session.passport.user.ownedSite)
    if (res1.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res1.error}`}] }
      res.redirect('/stations')
    }
    // Get ChargeBoxInfos table data
    const res2 = await sqlite.getChargeBoxBootInfo(data.ocppName, req.session.passport.user.ownedSite)
    if (res2 && res2.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${res2.error}`}] }
    }
    // Render
    res.render('granted_charger_main.ejs', {
      onStations: true, station: res1, cbinfos: res2,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  }
}

export default ChargerController