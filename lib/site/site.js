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
    this.app.get('/admin/sites', this.checkIsAdmin, AdminController.getAllSites)
    this.app.post('/admin/site/add', this.checkIsAdmin, checkSchema(AdminController.SiteSchema), AdminController.addSite)
    this.app.get('/admin/site/edit/:elemId', this.checkIsAdmin, checkSchema(BaseController.IdSchema), AdminController.formUpdSite)
    this.app.post('/admin/site/edit', this.checkIsAdmin, checkSchema(AdminController.UpdSiteSchema), AdminController.updSite)
    this.app.post('/admin/site/delete', this.checkIsAdmin, checkSchema(BaseController.IdSchema), AdminController.delSite)
    // USERS - Redirect
    this.app.get('/users', this.checkIsGranted, BaseController.redirectUsers)
    // ADMIN - Users
    this.app.get('/admin/users', this.checkIsAdmin, AdminController.getAllUsers)
    this.app.post('/admin/user/add', this.checkIsAdmin, checkSchema(AdminController.UserAddSchema), AdminController.addUser)
    this.app.get('/admin/user/edit/:elemId', this.checkIsAdmin, checkSchema(BaseController.IdSchema), AdminController.formUpdUser)
    this.app.post('/admin/user/edit', this.checkIsAdmin, checkSchema(AdminController.UserUpdSchema), AdminController.updUser)
    this.app.post('/admin/user/delete/', this.checkIsAdmin, checkSchema(BaseController.IdSchema), AdminController.delUser)
    // OWNER - Users
    this.app.get('/site/users', this.checkIsOwner, OwnerController.getAllUsers)
    this.app.post('/site/user/add', this.checkIsOwner, checkSchema(OwnerController.UserAddSchema), OwnerController.addSiteUser)
    this.app.get('/site/user/edit/:elemId', this.checkIsOwner, checkSchema(BaseController.IdSchema), OwnerController.formUpdSiteUser)
    this.app.post('/site/user/edit', this.checkIsOwner, checkSchema(OwnerController.UserUpdSchema), OwnerController.updSiteUser)
    this.app.post('/site/user/delete', this.checkIsOwner, checkSchema(BaseController.IdSchema), OwnerController.delSiteUser)
    // RFIDS - Redirect
    this.app.get('/rfids', this.checkIsGranted, BaseController.redirectRfids, OwnerController.addSiteUser)
    // ADMIN - Rfids
    this.app.get('/admin/rfids', this.checkIsAdmin, AdminController.getAllRfids)
    this.app.post('/admin/rfid/add', this.checkIsAdmin, checkSchema(AdminController.RfidTagAddSchema), AdminController.addRfidTag)
    this.app.get('/admin/rfid/edit/:elemId', this.checkIsAdmin, checkSchema(BaseController.IdSchema), AdminController.formUpdRfidTag)
    this.app.post('/admin/rfid/edit', this.checkIsAdmin, checkSchema(AdminController.RfidTagUpdSchema), AdminController.updRfidTag)
    this.app.post('/admin/rfid/delete', this.checkIsAdmin, checkSchema(BaseController.IdSchema), AdminController.delRfidTag)
    // OWNER - Rfids
    this.app.get('/site/rfids', this.checkIsOwner, OwnerController.getAllRfids)
    this.app.post('/site/rfid/add', this.checkIsOwner, checkSchema(OwnerController.RfidTagAddSchema), OwnerController.addRfidTag)
    this.app.get('/site/rfid/edit/:elemId', this.checkIsOwner, checkSchema(BaseController.IdSchema), OwnerController.formUpdRfidTag)
    this.app.post('/site/rfid/edit', this.checkIsOwner, checkSchema(OwnerController.RfidTagUpdSchema), OwnerController.updRfidTag)
    this.app.post('/site/rfid/delete', this.checkIsOwner, checkSchema(BaseController.IdSchema), OwnerController.delRfidTag)
    // ADMIN - Config Page OCPP default configuration
    this.app.get('/admin/ocppdefault', this.checkIsAdmin, AdminController.formConfigOcpp)
    this.app.post('/admin/ocppdefault', this.checkIsAdmin, AdminController.dataConfigOcpp)
    this.app.post('/admin/ocppdefault/edit', this.checkIsAdmin, checkSchema(AdminController.ConfOcppSchema), AdminController.updateConfigOcpp)
    // TOUS - Compte Utilisateur
    this.app.get('/compte', this.checkAuthenticated, BaseController.monCompte)
    this.app.post('/compte', this.checkAuthenticated, checkSchema(BaseController.CompteSchema), BaseController.updmonCompte)
    // ADMIN - Pendings Station
    this.app.post('/refreshPendings', this.checkIsAdmin, AdminController.ajaxPendings)
    this.app.post('/registerPending/:ocppName', this.checkIsAdmin, checkSchema(AdminController.PendingSchema), AdminController.registerPending)
    // STATIONS - Redirect
    this.app.get('/stations', this.checkIsGranted, BaseController.redirectStations)
    // ADMIN - Stations
    this.app.get('/admin/stations', this.checkIsAdmin, AdminController.getAllStations)
    this.app.post('/admin/station/add', this.checkIsAdmin, checkSchema(AdminController.StationSchema), AdminController.addStation)
    this.app.get('/admin/station/edit/:elemId', this.checkIsAdmin, checkSchema(BaseController.IdSchema), AdminController.formUpdStation)
    this.app.post('/admin/station/edit', this.checkIsAdmin, checkSchema(AdminController.updStationSchema), AdminController.updStation)
    this.app.post('/admin/station/delete', this.checkIsAdmin, checkSchema(BaseController.IdSchema), AdminController.delStation)
    this.app.get('/admin/station/:ocppName/diagnostic', this.checkIsAdmin, checkSchema(AdminController.OcppidSchema), AdminController.getStationDiag)
    this.app.put('/admin/station/:ocppName/diagnostic/:fileName', AdminController.recvDiagnosticFile)
    // OWNER - Stations
    this.app.get('/site/stations', this.checkIsOwner)
    // STATIONS - Admin AJAX
    this.app.post('/ajax/stations_status', this.checkIsGranted, StationsController.ajaxOnline)



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






    // 404 Error
    this.app.use((req, res) => {
      res.status(404).send("Sorry can't find that!")
    })
    // All Good
    this.log.log('Web UI configured')
  }
  /* Redirect when valid login */
  checkLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) {
      return res.redirect('/dashboard')
    }
    next()
  }
  /* User logged : User / Owner / Admin */
  checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next()
    }
    res.redirect('/login')
  }
  checkIsGranted(req, res, next) {
    if (req.isAuthenticated() ) {
      if (req.session.passport.user.isAdmin === 1 || req.session.passport.user.ownedSite !== null) {
        return next()
      }
      return res.redirect('/dashboard')
    }
    res.redirect('/login')
  }
  /* User logged: Owner */
  checkIsOwner(req, res, next) {
    if (req.isAuthenticated() ) {
      if (req.session.passport.user.ownedSite !== null) {
        return next()
      }
      return res.redirect('/dashboard')
    }
    res.redirect('/login')
  }
  /* User logged: Admin */
  checkIsAdmin(req, res, next) {
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