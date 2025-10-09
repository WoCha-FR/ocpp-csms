import express from 'express'
import { checkSchema } from 'express-validator'
import Log from 'debug-level'

import utils from '../helpers/utils.js'
import middlewareConfig from './middlewares.js'
import BaseController from './controllers/base.js'
import StationsController from './controllers/stations.js'
import RfidController from './controllers/rfidtag.js'
import StationController from './controllers/station.js'
import AdminController from './controllers/admin.js'

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
    // Redirectors
    this.app.get('/stations', this.checkAuthenticated, BaseController.redirectStations)
    // Stations
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
    // RFID & Driver Page
    this.app.get('/rfids', this.checkAuthenticated, RfidController.getMainPage)
    this.app.post('/rfids/add', this.checkAuthenticated)
    this.app.get('/rfids/edit/:idTag', this.checkAuthenticated)
    this.app.post('/rfids/edit', this.checkAuthenticated)
    this.app.post('/rfids/delete', this.checkAuthenticated)
    // User Page

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
    // ADMIN - RFIDs

    // ADMIN - Users Page
    this.app.get('/users', this.checkAdminAuthenticated, AdminController.getAllUsers)
    this.app.post('/users/add', this.checkAdminAuthenticated, checkSchema(AdminController.UserSchema), AdminController.addUser)
    this.app.get('/users/edit/:userId', this.checkAdminAuthenticated, checkSchema(AdminController.UserId), AdminController.formUpdUser)
    this.app.post('/users/edit', this.checkAdminAuthenticated, checkSchema(AdminController.UserUpdSchema), AdminController.updUser)
    this.app.post('/users/delete/', this.checkAdminAuthenticated, checkSchema(AdminController.UserId), AdminController.delUser)
    // ADMIN - Config OCPP Page
    this.app.get('/configocpp', this.checkAdminAuthenticated, AdminController.formConfigOcpp)
    this.app.post('/configocpp', this.checkAdminAuthenticated, AdminController.dataConfigOcpp)
    this.app.post('/configocpp/update', this.checkAdminAuthenticated, checkSchema(AdminController.ConfOcppSchema), AdminController.updateConfigOcpp)
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
      if (req.session.passport.user.level === 3) {
        // TODO Driver Page
      } else {
        return next()
      }
    }
    res.redirect('/login')
  }
  checkAdminAuthenticated(req, res, next) {
    if (req.isAuthenticated() ) {
      if (req.session.passport.user.level === 1) {
        return next()
      }
      return res.redirect('/dashboard')
    }
    res.redirect('/login')
  }

  async Start () {
    this.listener = this.app.listen(utils.config().http.port, () => {
      this.log.log('Web UI started at port ' + utils.config().http.port)
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