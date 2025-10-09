import sqlite from '../../datas/db.js'

const StationsController = {
  getList: async (req, res) => {
    // Get all Stations of user
    const result = await sqlite.getUserChargeBox(req.session.passport.user.user_pk)
    if (result.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${result.error}`}] }
    }
    res.render('stations_user.ejs', {
      onStations: true, stations: result,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  }
}

export default StationsController