import conf from 'config'
import express from 'express'
import { checkSchema } from 'express-validator'
import logger from '../helpers/logger.js'
import middlewareConfig from './middlewares.js'
import authConfig from './passportauth.js'
import BaseController from './controllers/base.js'
import AdminController from './controllers/admin.js'
import OwnerController from './controllers/owner.js'
import StationsController from './controllers/stations.js'
import ChargerController from './controllers/charger.js'
import RfidController from './controllers/rfid.js'
import ReportController from './controllers/reports.js'

export default new (class WebApp {
  constructor() {
    this.log = logger.child({ childLabel: 'WEBUI' })
    this.listener = false
  }

  async initWebUI() {
    // Express
    this.app = express()
    // Configuration express
    await middlewareConfig(this.app)
    // Passport internal login
    await authConfig(this.app)
    // Index Page
    this.app.get('/', BaseController.indexPage)
    // Login - Logout - Language
    this.app.get('/auth/login', this.checkNotAuthenticated, BaseController.formLogin)
    this.app.post('/logout', BaseController.logout)
    this.app.get('/logout', BaseController.logout)
    this.app.get('/language/:lng', BaseController.changeLanguage)
    // DASHBOARD - Redirect & Pages & Ajax
    this.app.get('/dashboard', this.checkAuthenticated, BaseController.redirectDashboard)
    this.app.get('/admin/dashboard', this.checkIsAdmin, AdminController.getDashboard)
    this.app.get('/site/dashboard', this.checkIsOwner, OwnerController.getDashboard)
    this.app.get('/mydashboard', this.checkAuthenticated, BaseController.getDashboard)
    this.app.post(
      '/ajax/stations_stats',
      this.ajaxIsGranted,
      StationsController.ajaxGetDashboardCBStatus
    )
    this.app.post(
      '/ajax/connectors_stats',
      this.ajaxIsGranted,
      StationsController.ajaxGetDashboardConnStatus
    )
    this.app.post(
      '/ajax/cbconstransac_data',
      this.ajaxIsGranted,
      StationsController.ajaxGetDashboardCbConnsTransac
    )
    this.app.post(
      '/ajax/upduserdashboard',
      this.ajaxIsAuthenticated,
      BaseController.ajaxUpdUserDashboard
    )
    this.app.post(
      '/ajax/upduserpage_chargerstatus',
      this.ajaxIsAuthenticated,
      checkSchema(BaseController.OcppidSchema),
      BaseController.ajaxUpdUserChargerStatus
    )
    this.app.post(
      '/ajax/upduserpage_chargerconnstatus',
      this.ajaxIsAuthenticated,
      checkSchema(BaseController.OcppidSchema),
      BaseController.ajaxUpdUserChargerConnsStatus
    )
    // TOUS - Connectors & Charge & ...
    this.app.get(
      '/connectors/:ocppName',
      this.checkAuthenticated,
      checkSchema(BaseController.OcppidSchema),
      BaseController.getConnectors
    )
    this.app.post(
      '/charger/:ocppName/start',
      this.checkAuthenticated,
      checkSchema(ChargerController.ConnectorSchema),
      ChargerController.UserRemoteStartTrans
    )
    this.app.post(
      '/charger/:ocppName/stop',
      this.checkAuthenticated,
      checkSchema(ChargerController.TransactionSchema),
      ChargerController.UserRemoteStopTrans
    )
    // ADMIN - Sites
    this.app.get('/admin/sites', this.checkIsAdmin, AdminController.getAllSites)
    this.app.post(
      '/admin/site/add',
      this.checkIsAdmin,
      checkSchema(AdminController.SiteSchema),
      AdminController.addSite
    )
    this.app.get(
      '/admin/site/edit/:elemId',
      this.checkIsAdmin,
      checkSchema(BaseController.IdSchema),
      AdminController.formUpdSite
    )
    this.app.post(
      '/admin/site/edit',
      this.checkIsAdmin,
      checkSchema(AdminController.UpdSiteSchema),
      AdminController.updSite
    )
    this.app.post(
      '/admin/site/delete',
      this.checkIsAdmin,
      checkSchema(BaseController.IdSchema),
      AdminController.delSite
    )
    // USERS - Redirect
    this.app.get('/users', this.checkIsGranted, BaseController.redirectUsers)
    // ADMIN - Users
    this.app.get('/admin/users', this.checkIsAdmin, AdminController.getAllUsers)
    this.app.post(
      '/admin/user/add',
      this.checkIsAdmin,
      checkSchema(AdminController.UserAddSchema),
      AdminController.addUser
    )
    this.app.get(
      '/admin/user/edit/:elemId',
      this.checkIsAdmin,
      checkSchema(BaseController.IdSchema),
      AdminController.formUpdUser
    )
    this.app.post(
      '/admin/user/edit',
      this.checkIsAdmin,
      checkSchema(AdminController.UserUpdSchema),
      AdminController.updUser
    )
    this.app.post(
      '/admin/user/delete/',
      this.checkIsAdmin,
      checkSchema(BaseController.IdSchema),
      AdminController.delUser
    )
    this.app.post(
      '/admin/user/deleteinsite',
      this.checkIsAdmin,
      checkSchema(BaseController.IdSchema),
      AdminController.delSiteUser
    )
    // OWNER - Users
    this.app.get('/site/users', this.checkIsOwner, OwnerController.getAllUsers)
    this.app.post(
      '/site/user/add',
      this.checkIsOwner,
      checkSchema(OwnerController.UserAddSchema),
      OwnerController.addSiteUser
    )
    this.app.get(
      '/site/user/edit/:elemId',
      this.checkIsOwner,
      checkSchema(BaseController.IdSchema),
      OwnerController.formUpdSiteUser
    )
    this.app.post(
      '/site/user/edit',
      this.checkIsOwner,
      checkSchema(OwnerController.UserUpdSchema),
      OwnerController.updSiteUser
    )
    this.app.post(
      '/site/user/delete',
      this.checkIsOwner,
      checkSchema(BaseController.IdSchema),
      OwnerController.delSiteUser
    )
    // RFIDS - Redirect
    this.app.get('/rfids', this.checkIsGranted, BaseController.redirectRfids)
    // ADMIN - Rfids
    this.app.get('/admin/rfids', this.checkIsAdmin, RfidController.getAllRfids)
    this.app.post(
      '/admin/rfid/add',
      this.checkIsAdmin,
      checkSchema(RfidController.RfidTagAddSchema),
      RfidController.addRfidTag
    )
    this.app.get(
      '/admin/rfid/edit/:elemId',
      this.checkIsAdmin,
      checkSchema(BaseController.IdSchema),
      RfidController.formUpdRfidTag
    )
    this.app.post(
      '/admin/rfids/ajax/updsiteusers',
      this.ajaxIsAdmin,
      checkSchema(RfidController.RfidUsersOfSite),
      RfidController.ajaxGetUsersOfSite
    )
    this.app.post(
      '/admin/rfid/edit',
      this.checkIsAdmin,
      checkSchema(RfidController.RfidTagUpdSchema),
      RfidController.updRfidTag
    )
    this.app.post(
      '/admin/rfid/delete',
      this.checkIsAdmin,
      checkSchema(BaseController.IdSchema),
      RfidController.delRfidTag
    )
    // OWNER - Rfids
    this.app.get('/site/rfids', this.checkIsOwner, RfidController.getOwnerRfids)
    this.app.post(
      '/site/rfid/add',
      this.checkIsOwner,
      checkSchema(RfidController.RfidTagAddSchema),
      RfidController.addRfidTag
    )
    this.app.get(
      '/site/rfid/edit/:elemId',
      this.checkIsOwner,
      checkSchema(BaseController.IdSchema),
      RfidController.formUpdOwnerRfidTag
    )
    this.app.post(
      '/site/rfid/edit',
      this.checkIsOwner,
      checkSchema(RfidController.RfidTagUpdSchema),
      RfidController.updOwnerRfidTag
    )
    this.app.post(
      '/site/rfid/delete',
      this.checkIsOwner,
      checkSchema(BaseController.IdSchema),
      RfidController.delRfidTag
    )
    // ADMIN - Config Page OCPP default configuration
    this.app.get('/admin/ocppdefault', this.checkIsAdmin, AdminController.formConfigOcpp)
    this.app.post('/admin/ocppdefault', this.checkIsAdmin, AdminController.dataConfigOcpp)
    this.app.post(
      '/admin/ocppdefault/edit',
      this.checkIsAdmin,
      checkSchema(AdminController.ConfOcppSchema),
      AdminController.updateConfigOcpp
    )
    // TOUS - Compte Utilisateur
    this.app.get('/compte', this.checkAuthenticated, BaseController.monCompte)
    this.app.post(
      '/compte',
      this.checkAuthenticated,
      checkSchema(BaseController.CompteSchema),
      BaseController.updMonCompte
    )
    this.app.post(
      '/compte/notifications',
      this.checkAuthenticated,
      checkSchema(BaseController.NotifsSchema),
      BaseController.updMesNotifications
    )
    // ADMIN - Pendings Station
    this.app.post('/refreshPendings', this.ajaxIsAdmin, AdminController.ajaxPendings)
    this.app.post(
      '/registerPending/:ocppName',
      this.checkIsAdmin,
      checkSchema(AdminController.PendingSchema),
      AdminController.registerPending
    )
    // STATIONS - Redirect
    this.app.get('/stations', this.checkIsGranted, BaseController.redirectStations)
    // ADMIN - Stations
    this.app.get('/admin/stations', this.checkIsAdmin, StationsController.getAllStations)
    this.app.post(
      '/admin/station/add',
      this.checkIsAdmin,
      checkSchema(StationsController.StationSchema),
      StationsController.addStation
    )
    this.app.get(
      '/admin/station/edit/:elemId',
      this.checkIsAdmin,
      checkSchema(BaseController.IdSchema),
      StationsController.formUpdStation
    )
    this.app.post(
      '/admin/station/edit',
      this.checkIsAdmin,
      checkSchema(StationsController.updStationSchema),
      StationsController.updStation
    )
    this.app.post(
      '/admin/station/delete',
      this.checkIsAdmin,
      checkSchema(BaseController.IdSchema),
      StationsController.delStation
    )
    this.app.get(
      '/admin/station/:ocppName/diagnostic',
      this.checkIsAdmin,
      checkSchema(BaseController.OcppidSchema),
      StationsController.getStationDiag
    )
    // OWNER - Stations
    this.app.get('/site/stations', this.checkIsOwner, StationsController.getOwnerStations)
    // AJAX STATIONS - Admin & Owner
    this.app.post(
      '/ajax/stations_status',
      this.ajaxIsGranted,
      StationsController.ajaxStationsOnline
    )
    // AJAX CHARGEUR - Admin & Owner
    this.app.post(
      '/ajax/charger_status',
      this.ajaxIsGranted,
      checkSchema(BaseController.OcppidSchema),
      ChargerController.ajaxGetChargerStatus
    )
    this.app.post(
      '/ajax/connectors_status',
      this.ajaxIsGranted,
      checkSchema(BaseController.OcppidSchema),
      ChargerController.ajaxGetChargerConnsStatus
    )
    this.app.post(
      '/ajax/connectors_last_trans',
      this.ajaxIsGranted,
      checkSchema(BaseController.OcppidSchema),
      ChargerController.ajaxGetConsLastTransac
    )
    // AJAX CHARGEUR - Admin
    this.app.post(
      '/ajax/charger_logs',
      this.ajaxIsAdmin,
      checkSchema(ChargerController.LogsSchema),
      ChargerController.ajaxGetLogs
    )
    // CHARGEUR - Admin
    this.app.get(
      '/charger/:ocppName/ocppconfig',
      this.checkIsAdmin,
      checkSchema(BaseController.OcppidSchema),
      ChargerController.getOcppForm
    )
    this.app.post(
      '/charger/:ocppName/reqocppkeys',
      this.checkIsAdmin,
      checkSchema(BaseController.OcppidSchema),
      ChargerController.reqOcppConfig
    )
    this.app.post(
      '/charger/:ocppName/updocppkey',
      this.checkIsAdmin,
      checkSchema(ChargerController.ConfigSchema),
      ChargerController.updOcppConfig
    )
    this.app.get(
      '/charger/:ocppName/logs',
      this.checkIsAdmin,
      checkSchema(BaseController.OcppidSchema),
      ChargerController.getLogPage
    )
    // CHARGEUR - Admin & Owner
    this.app.get(
      '/charger/:ocppName',
      this.checkIsGranted,
      checkSchema(BaseController.OcppidSchema),
      ChargerController.getMainPage
    )
    this.app.post(
      '/charger/:ocppName/update',
      this.checkIsGranted,
      checkSchema(ChargerController.UpdChargerSchema),
      ChargerController.updCharger
    )
    this.app.get(
      '/charger/:ocppName/connectors',
      this.checkIsGranted,
      checkSchema(BaseController.OcppidSchema),
      ChargerController.getSocketPage
    )
    this.app.post(
      '/charger/:ocppName/updconnector',
      this.checkIsGranted,
      checkSchema(ChargerController.UpdConnPersoSchema),
      ChargerController.updConnPerso
    )
    // CHARGEUR - Admin & Owner COMMANDES
    this.app.post(
      '/charger/:ocppName/reboot',
      this.checkIsGranted,
      checkSchema(ChargerController.RebootSchema),
      ChargerController.rebootStation
    )
    this.app.post(
      '/charger/:ocppName/available',
      this.checkIsGranted,
      checkSchema(ChargerController.AvailabilitySchema),
      ChargerController.setAvailability
    )
    this.app.post(
      '/charger/:ocppName/reqconnector',
      this.checkIsGranted,
      checkSchema(ChargerController.ConnTriggerSchema),
      ChargerController.triggerMessage
    )
    this.app.post(
      '/charger/:ocppName/unlockcon',
      this.checkIsGranted,
      checkSchema(ChargerController.ConnectorSchema),
      ChargerController.unlockConnector
    )
    this.app.post(
      '/charger/:ocppName/clearcache',
      this.checkIsGranted,
      checkSchema(BaseController.OcppidSchema),
      ChargerController.ClearCache
    )
    this.app.post(
      '/charger/:ocppName/getlocallist',
      this.checkIsGranted,
      checkSchema(BaseController.OcppidSchema),
      ChargerController.GetLocalListVersion
    )
    this.app.post(
      '/charger/:ocppName/remotestart',
      this.checkIsGranted,
      checkSchema(ChargerController.ConnectorSchema),
      ChargerController.GrantedRemoteStartTrans
    )
    this.app.post(
      '/charger/:ocppName/remotestop',
      this.checkIsGranted,
      checkSchema(ChargerController.TransactionSchema),
      ChargerController.RemoteStopTrans
    )
    // CHARGEUR - Admin COMMANDES
    this.app.post(
      '/charger/:ocppName/request',
      this.checkIsAdmin,
      checkSchema(ChargerController.TriggerSchema),
      ChargerController.triggerMessage
    )
    // REPORTS - Admin & Owner
    this.app.get('/admin/reports/', this.checkIsAdmin, ReportController.getAdminReportPage)
    this.app.get('/site/reports/', this.checkIsOwner, ReportController.getOwnerReportPage)
    this.app.post(
      '/ajax/grantedreports_list',
      this.ajaxIsGranted,
      checkSchema(ReportController.getChargingReportsSchema),
      ReportController.ajaxGetGrantedChargingReports
    )
    this.app.post(
      '/ajax/grantedauthreports_list',
      this.ajaxIsGranted,
      checkSchema(ReportController.getChargingReportsSchema),
      ReportController.ajaxGetGrantedAuthReports
    )
    // REPORTS - AUTHENTIFICATIONS ADMIN
    this.app.get('/admin/reports/auth', this.checkIsAdmin, ReportController.getAdminAuthReportPage)
    // REPORTS - AUTHENTIFICATIONS OWNER
    this.app.get('/site/reports/auth', this.checkIsOwner, ReportController.getOwnerAuthReportPage)
    // REPORTS - TOUS
    this.app.get('/reports/', this.checkAuthenticated, ReportController.getUserReportPage)
    this.app.get(
      '/reports/charge/:elemId',
      this.checkAuthenticated,
      checkSchema(BaseController.IdSchema),
      ReportController.getChargeReport
    )
    this.app.post(
      '/ajax/userreports_list',
      this.ajaxIsAuthenticated,
      checkSchema(ReportController.getChargingReportsSchema),
      ReportController.ajaxGetUserChargingReports
    )
    // 403 Error
    this.app.get('/forbidden', (req, res) => {
      let errormsg = {
        code: '403',
        title: 'Accès refusé',
        message: "Vous n'êtes pas autorisé à consulter cette page.",
      }
      // Ajax Request
      if (req.headers['sec-fetch-dest'] == 'empty') {
        res.status(403).send('Forbidden')
        return
      }
      // Standard Request
      res.status(403).render('errors.ejs', { errorinfo: errormsg })
    })
    // 404 Error
    this.app.get('/not-found', (req, res) => {
      let errormsg = {
        code: '404',
        title: 'Oups ! Page non trouvée',
        message: "La page que vous recherchez n'existe pas ou à été déplacée.",
      }
      // Ajax Request
      if (req.headers['sec-fetch-dest'] == 'empty') {
        res.status(403).send('Forbidden')
        return
      }
      // Standard Request
      res.status(404).render('errors.ejs', { errorinfo: errormsg })
    })
    // Automatic 404 Error - End of all routes
    this.app.use((req, res) => {
      let errormsg = {
        code: '404',
        title: 'Oups ! Page non trouvée',
        message: "La page que vous recherchez n'existe pas ou à été déplacée.",
      }
      // Ajax Request
      if (req.headers['sec-fetch-dest'] == 'empty') {
        res.status(403).send('Forbidden')
        return
      }
      // Standard Request
      res.status(404).render('errors.ejs', { errorinfo: errormsg })
    })
    // All Good
    this.log.info('Web UI configured')
  }
  /* User Not logged */
  checkNotAuthenticated(req, res, next) {
    if (!req.isAuthenticated()) {
      return next()
    }
    return res.redirect('/dashboard')
  }
  /* User logged : User / Owner / Admin */
  checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next()
    }
    return res.redirect('/auth/login')
  }
  /* User logged : Owner / Admin */
  checkIsGranted(req, res, next) {
    if (req.isAuthenticated()) {
      if (req.session.passport.user.isAdmin === 1 || req.session.passport.user.ownedSite !== null) {
        return next()
      }
      return res.redirect('/forbidden')
    }
    return res.redirect('/auth/login')
  }
  /* User logged: Owner */
  checkIsOwner(req, res, next) {
    if (req.isAuthenticated()) {
      if (req.session.passport.user.ownedSite !== null) {
        return next()
      }
      return res.redirect('/forbidden')
    }
    return res.redirect('/auth/login')
  }
  /* User logged: Admin */
  checkIsAdmin(req, res, next) {
    if (req.isAuthenticated()) {
      if (req.session.passport.user.isAdmin === 1) {
        return next()
      }
      return res.redirect('/forbidden')
    }
    return res.redirect('/auth/login')
  }
  /* Ajax check loggin */
  ajaxIsAdmin(req, res, next) {
    if (req.isAuthenticated()) {
      if (req.session.passport.user.isAdmin === 1 || req.session.passport.user.ownedSite !== null) {
        return next()
      }
      return res.status(403).send('Forbidden')
    }
    return res.status(401).send('Unauthorized')
  }
  ajaxIsGranted(req, res, next) {
    if (req.isAuthenticated()) {
      if (req.session.passport.user.isAdmin === 1 || req.session.passport.user.ownedSite !== null) {
        return next()
      }
      return res.status(403).send('Forbidden')
    }
    return res.status(401).send('Unauthorized')
  }
  ajaxIsAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next()
    }
    return res.status(401).send('Unauthorized')
  }
  /* Internal Functions */
  async Start() {
    this.listener = this.app.listen(conf.get('http.port'), conf.get('http.listenip'), () => {
      this.log.info(`Web UI started on ${conf.get('http.listenip')}:${conf.get('http.port')}`)
    })
  }
  async Stop() {
    if (this.listener) {
      await this.listener.close()
      this.listener = false
      this.log.info('Web UI stopped')
    }
  }
})()
