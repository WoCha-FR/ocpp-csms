import sqlite from '../../datas/db.js'

const RfidController = {
  getMainPage: async (req, res) => {
    // Get all RFID Tag of user
    const result = await sqlite.getUserRfidTags(req.session.passport.user.user_pk)
    if (result.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${result.error}`}] }
    }
    // Render
    res.render('rfid_tags.ejs', {
      onRfids: true,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  }
}
export default RfidController