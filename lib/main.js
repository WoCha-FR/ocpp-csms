import './helpers/exithandler.js'
import conf from 'config'
import utils from './helpers/utils.js'
import eMailer from './notifs/mailer.js'
import sqlite from './datas/db.js'
//import CSMS from './csms/csms.js'
import WebApp from './site/site.js'
import logger from './helpers/logger.js'

import srvWS16 from './csms/ocpp16ws.js'
import srvWSS16 from './csms/ocpp16wss.js'

class Main {
  constructor() {
    this.log = logger
    this.Start()
  }

  async Start() {
    this.log.info(`START: ${utils.appVersion()}`)
    // Init Modules
    await sqlite.initDB()
    await eMailer.initMailer()
    //await CSMS.initServer()
    if (conf.get('ocpp.enablews')) {
      await srvWS16.initServer()
    }
    if (conf.get('ocpp.enablewss')) {
      await srvWSS16.initServer()
    }
    await WebApp.initWebUI()
    // Start Modules
    //await CSMS.Start()
    if (conf.get('ocpp.enablews')) {
      await srvWS16.Start()
    }
    if (conf.get('ocpp.enablewss')) {
      await srvWSS16.Start()
    }
    await WebApp.Start()
  }
}

export default new Main()
