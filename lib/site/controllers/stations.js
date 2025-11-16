import { matchedData, validationResult } from 'express-validator'
import { JSONFilePreset } from 'lowdb/node'
import fs from 'fs'
import utils from '../../helpers/utils.js'
import sqlite from '../../datas/db.js'
import csms from '../../csms/csms.js'

const StationsController = {
  /* STATIONS Admin */
  getAllStations: async (req, res) => {
    // Get all Stations
    const result = await sqlite.getAllStations()
    if (result.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${result.error}`}] }
    }
    // Get Sites for Form Select
    const sites = await sqlite.getAllSites()
    if (sites.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${sites.error}`}] }
    }
    // Pendings Stations
    const PendingCB = await JSONFilePreset(utils.rootdir() + '/datas/pendings.json', { pendings: [] })
    const { pendings } = PendingCB.data
    // WebSocket information
    let wsdata = {
      wsfqdn: utils.config().ocpp.hostws
    }
    res.render('admin_stations.ejs', {
      onStations: true, stations: result, sites: sites,
      pendings: pendings, wsinfo: wsdata,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  StationSchema: {
    cbname: {
      trim: true, escape: true,
      matches: { options: /^[a-zA-ZÀ-Ÿ0-9-_ ]*$/ },
      isLength: {options: {min: 4, max:75}},
    },
    cbsite: {
      isInt: true, trim: true, escape: true
    },
    cbid: {
      matches: { options: /^[a-zA-Z0-9-_]*$/ },
      isLength: {options: {min: 5, max:75}},
      trim: true, escape: true
    },
    regstatus: {
      trim: true,
      isIn: {
        options: [['Accepted', 'Rejected', 'Pending']],
      }
    },
    cbpwd: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true,
      isLength: {options: {min: 5, max:75}}
    }
  },
  addStation: async(req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        ocppid: data.cbid,
        cbname: data.cbname,
        cbpwd: data.cbpwd || null,
        cbsite: data.cbsite,
        regstatus: data.regstatus
      }
      let response = await sqlite.addStation(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/admin/stations')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/admin/stations')
      return undefined
    }
  },
  formUpdStation: async(req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let response = await sqlite.getStationInfosById(data.elemId)
      // Tentative d'accès à un ID inexistant
      if (!response) {
        res.redirect('/forbidden')
        return undefined
      }
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
        res.redirect('/admin/stations')
        return undefined
      }
      // Get Sites - Form Select
      let sites = await sqlite.getAllSites()
      if (sites.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${sites.error}`}] }
      }
      // render
      res.render('admin_station_updform.ejs', {
        charger: response, sites: sites,
        userInfo: req.session.passport.user,
        infosui: req.session.ocppcsms
      })
      req.session.ocppcsms = {}
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/admin/stations')
      return undefined
    }
  },
  updStationSchema: {
    cbpk: {
      isInt: true, trim: true, escape: true
    },
    cbname: {
      trim: true, escape: true,
      matches: { options: /^[a-zA-ZÀ-Ÿ0-9-_ ]*$/ },
      isLength: {options: {min: 4, max:75}},
    },
    cbsite: {
      isInt: true, trim: true, escape: true
    },
    cbid: {
      matches: { options: /^[a-zA-Z0-9-_]*$/ },
      isLength: {options: {min: 5, max:75}},
      trim: true, escape: true
    },
    regstatus: {
      trim: true,
      isIn: {
        options: [['Accepted', 'Rejected', 'Pending']],
      }
    },
    cbpwd: {
      optional : { options: { values: 'falsy' } },
      trim: true, escape: true,
      isLength: {options: {min: 5, max:75}}
    }
  },
  updStation: async(req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        cbpk: data.cbpk,
        ocppid : data.cbid,
        cbname: data.cbname,
        cbpwd: data.cbpwd || null,
        cbsite: data.cbsite,
        regstatus: data.regstatus
      }
      let response = await sqlite.updStation(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/admin/stations')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/admin/stations')
      return undefined
    }
  },
  delStation: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        cbpk: data.elemId
      }
      let response = await sqlite.delStation(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/admin/stations')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/admin/stations')
      return undefined
    }
  },
  getStationDiag: async (req, res) => {
    const data = matchedData(req)
    // TODO : FTP url from config
    //data.url = 'http://10.42.5.13:8080/admin/station/WBCB1082422/diagnostic'
    // url: /admin/station/:ocppName/diagnostic/:fileName
    let result = await csms.GetDiagnostics(data)
    req.session.ocppcsms.ocppResult = result
    res.redirect('/admin/stations')
  },
  recvDiagnosticFile: async (req, res) => {
    req.pipe(fs.createWriteStream(utils.rootdir() + '/' + req.params.fileName))
    req.on('end', function () {
      res.sendStatus(200)
    })
  },
  /* STATIONS Owner */
  getOwnerStations: async (req, res) => {
    // Get Owner Stations
    const result = await sqlite.getAllStations(req.session.passport.user.ownedSite)
    if (result.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${result.error}`}] }
    }
    res.render('site_stations.ejs', {
      onStations: true, stations: result,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  /* STATIONS Common */
  ajaxStationsOnline: async (req, res) => {
    if (req.session.passport.user.isAdmin == 1) {
      const result = await sqlite.ajaxGetStationsStatus()
      if (result.error) {
        res.status(500).send(result.error)
      }
      res.send({ data: result })
    }
    if (req.session.passport.user.ownedSite) {
      const result = await sqlite.ajaxGetStationsStatus(req.session.passport.user.ownedSite)
      if (result.error) {
        res.status(500).send(result.error)
      }
      res.send({ data: result })
    }
    return undefined
  }
}

export default StationsController