import sqlite from '../../datas/db.js'

const StationsController = {
  ajaxOnline: async (req, res) => {
    if (req.session.passport.user.isAdmin == 1) {
      const result = await sqlite.ajaxGetStationsStatus()
      if (result.error) {
        res.status(500).send(result.error)
      }
      res.send({ data: result })
    }
    return undefined
  }
}

export default StationsController