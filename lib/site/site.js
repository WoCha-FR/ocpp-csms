import express from 'express'
import { checkSchema } from 'express-validator'
import Log from 'debug-level'

import utils from '../helpers/utils.js'
import middlewareConfig from './middlewares.js'
import BaseController from './controllers/base.js'
import AdminController from './controllers/admin.js'
import OwnerController from './controllers/owner.js'
import StationsController from './controllers/stations.js'
import StationController from './controllers/station.js'

export default new class WebApp {
  constructor () {
    this.log
    this.listener = false
  }

  async initWebUI () {
    // Logger
    this.log = new Log('webui', { level: utils.config().http.loglvl })
    // Express
    this.app = express()
    // Configuration express
    await middlewareConfig(this.app)
    // Index Page
    this.app.get('/', BaseController.indexPage)
    // Login - Logout - Language
    this.app.get('/login', this.checkLoggedIn, BaseController.formLogin)
    this.app.post('/logout', BaseController.logout)
    this.app.get('/language/:lng', BaseController.changeLanguage)
    this.app.get('/dashboard', this.checkAuthenticated, BaseController.getDashboard)
    // ADMIN - Sites
    this.app.get('/admin/sites', this.checkAdminAuthenticated, AdminController.getAllSites)
    this.app.post('/admin/site/add', this.checkAdminAuthenticated, checkSchema(AdminController.SiteSchema), AdminController.addSite)
    this.app.get('/admin/site/edit/:elemId', this.checkAdminAuthenticated, checkSchema(BaseController.IdSchema), AdminController.formUpdSite)
    this.app.post('/admin/site/edit', this.checkAdminAuthenticated, checkSchema(AdminController.UpdSiteSchema), AdminController.updSite)
    this.app.post('/admin/site/delete', this.checkAdminAuthenticated, checkSchema(BaseController.IdSchema), AdminController.delSite)
    // USERS - Redirect
    this.app.get('/users', this.checkAuthenticated, BaseController.redirectUsers)
    // ADMIN - Users
    this.app.get('/admin/users', this.checkAdminAuthenticated, AdminController.getAllUsers)
    this.app.post('/admin/user/add', this.checkAdminAuthenticated, checkSchema(AdminController.UserAddSchema), AdminController.addUser)
    this.app.get('/admin/user/edit/:elemId', this.checkAdminAuthenticated, checkSchema(BaseController.IdSchema), AdminController.formUpdUser)
    this.app.post('/admin/user/edit', this.checkAdminAuthenticated, checkSchema(AdminController.UserUpdSchema), AdminController.updUser)
    this.app.post('/admin/user/delete/', this.checkAdminAuthenticated, checkSchema(BaseController.IdSchema), AdminController.delUser)
    // OWNER - Users
    this.app.get('/site/users', this.checkAuthenticated, OwnerController.getAllUsers)
    this.app.post('/site/user/add', this.checkAuthenticated, checkSchema(OwnerController.UserAddSchema), OwnerController.addSiteUser)
    this.app.get('/site/user/edit/:elemId', this.checkAuthenticated, checkSchema(BaseController.IdSchema), OwnerController.formUpdSiteUser)
    this.app.post('/site/user/edit', this.checkAuthenticated, checkSchema(OwnerController.UserUpdSchema), OwnerController.updSiteUser)
    this.app.post('/site/user/delete', this.checkAuthenticated, checkSchema(BaseController.IdSchema), OwnerController.delSiteUser)
    // RFIDS - Redirect
    this.app.get('/rfids', this.checkAuthenticated, BaseController.redirectRfids, OwnerController.addSiteUser)
    // ADMIN - Rfids
    this.app.get('/admin/rfids', this.checkAdminAuthenticated, AdminController.getAllRfids)
    this.app.post('/admin/rfid/add', this.checkAdminAuthenticated, checkSchema(AdminController.RfidTagAddSchema), AdminController.addRfidTag)
    this.app.get('/admin/rfid/edit/:elemId', this.checkAdminAuthenticated, checkSchema(BaseController.IdSchema), AdminController.formUpdRfidTag)
    this.app.post('/admin/rfid/edit', this.checkAdminAuthenticated, checkSchema(AdminController.RfidTagUpdSchema), AdminController.updRfidTag)
    this.app.post('/admin/rfid/delete', this.checkAdminAuthenticated, checkSchema(BaseController.IdSchema), AdminController.delRfidTag)
    // OWNER - Rfids
    this.app.get('/site/rfids', this.checkAuthenticated, OwnerController.getAllRfids)
    this.app.post('/site/rfid/add', this.checkAuthenticated, checkSchema(OwnerController.RfidTagAddSchema), OwnerController.addRfidTag)
    this.app.get('/site/rfid/edit/:elemId', this.checkAuthenticated, checkSchema(BaseController.IdSchema), OwnerController.formUpdRfidTag)
    this.app.post('/site/rfid/edit', this.checkAuthenticated, checkSchema(OwnerController.RfidTagUpdSchema), OwnerController.updRfidTag)
    this.app.post('/site/rfid/delete', this.checkAuthenticated, checkSchema(BaseController.IdSchema), OwnerController.delRfidTag)






    // Stations
    this.app.get('/stations', this.checkAuthenticated, BaseController.redirectStations)
    this.app.get('/userstations', this.checkAuthenticated, StationsController.getList)
    // Station
    this.app.get('/station/:ocppName', this.checkAuthenticated, checkSchema(StationController.OcppidSchema), StationController.getMainPage)
    this.app.post('/station/:ocppName/remotestart', this.checkAuthenticated, checkSchema(StationController.ConnectorSchema), StationController.RemoteStartTrans)
    this.app.post('/station/:ocppName/remotestop', this.checkAuthenticated, checkSchema(StationController.TransactionSchema), StationController.RemoteStopTrans)
    this.app.post('/station/:ocppName/unlockconnector', this.checkAuthenticated, checkSchema(StationController.ConnectorSchema), StationController.unlockConnector)
    this.app.get('/station/:ocppName/manage', this.checkAuthenticated, checkSchema(StationController.OcppidSchema), StationController.getManagePage)
    this.app.post('/station/:ocppName/reboot', this.checkAuthenticated, checkSchema(StationController.RebootSchema), StationController.rebootStation)
    this.app.post('/station/:ocppName/dispo', this.checkAuthenticated, checkSchema(StationController.AvailabilitySchema), StationController.setAvailability)
    this.app.post('/station/:ocppName/request', this.checkAuthenticated, checkSchema(StationController.TriggerSchema), StationController.triggerMessage)
    this.app.post('/station/:ocppName/update', this.checkAuthenticated, checkSchema(StationController.UpdChargerSchema), StationController.updChargerInfos)
    this.app.get('/station/:ocppName/logs', this.checkAuthenticated, checkSchema(StationController.OcppidSchema), StationController.getLogsPage)
    this.app.post('/station/:ocppName/logs', this.checkAuthenticated, checkSchema(StationController.LogsSchema), StationController.getLogs)
    this.app.get('/station/:ocppName/ocppkeys', this.checkAuthenticated, checkSchema(StationController.OcppidSchema), StationController.getOcppPage)
    this.app.post('/station/:ocppName/getocppkeys', this.checkAuthenticated, checkSchema(StationController.OcppidSchema), StationController.getConfiguration)
    this.app.post('/station/:ocppName/setocppkey', this.checkAuthenticated, checkSchema(StationController.ConfigSchema), StationController.setConfiguration)
    // ADMIN - Charger
    this.app.get('/adminstations', this.checkAdminAuthenticated, AdminController.getAllChargers)
    this.app.post('/stations/add', this.checkAdminAuthenticated, checkSchema(AdminController.ChargerSchema), AdminController.addCharger)
    this.app.post('/station/delete', this.checkAdminAuthenticated, checkSchema(AdminController.ChargerId), AdminController.delCharger)
    this.app.get('/station/edit/:chargerId', this.checkAdminAuthenticated, checkSchema(AdminController.ChargerId), AdminController.formUpdCharger)
    this.app.post('/station/edit', this.checkAdminAuthenticated, checkSchema(AdminController.updChargerSchema), AdminController.updCharger)
    this.app.post('/refreshPendings', this.checkAdminAuthenticated, AdminController.ajaxPendings)
    this.app.post('/station/:ocppName/register', this.checkAdminAuthenticated, checkSchema(AdminController.PendingSchema), AdminController.registerPending)
    this.app.get('/station/:ocppName/diagnostic', this.checkAdminAuthenticated, checkSchema(AdminController.OcppidSchema), AdminController.getDiagnostic)
    this.app.put('/station/:ocppName/diagnostic/:fileName', AdminController.recvDiagnosticFile)
    // ADMIN - Config OCPP Page
    this.app.get('/configocpp', this.checkAdminAuthenticated, AdminController.formConfigOcpp)
    this.app.post('/configocpp', this.checkAdminAuthenticated, AdminController.dataConfigOcpp)
    this.app.post('/configocpp/update', this.checkAdminAuthenticated, checkSchema(AdminController.ConfOcppSchema), AdminController.updateConfigOcpp)
    // 404 Error
    this.app.use((req, res) => {
      res.status(404).send("Sorry can't find that!")
    })
    // All Good
    this.log.log('Web UI configured')
  }

  checkLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) {
      return res.redirect('/dashboard')
    }
    next()
  }
  checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next()
    }
    res.redirect('/login')
  }
  checkAdminAuthenticated(req, res, next) {
    if (req.isAuthenticated() ) {
      if (req.session.passport.user.isAdmin === 1) {
        return next()
      }
      return res.redirect('/dashboard')
    }
    res.redirect('/login')
  }

  async Start () {
    this.listener = this.app.listen(utils.config().http.port, utils.config().http.listenip, () => {
      this.log.log('Web UI started on ' + utils.config().http.listenip + ':' + utils.config().http.port)
    })
  }

  async Stop () {
    if (this.listener) {
      await this.listener.close()
      this.listener = false
      this.log.log('Web UI stopped')
    }
  }

}()