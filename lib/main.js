import './helpers/exithandler.js'
import utils from './helpers/utils.js'
import eMailer from './notifs/mailer.js'
import sqlite from './datas/db.js'
import CSMS from './csms/csms.js'
import WebApp from './site/site.js'
import logger from './helpers/logger.js'

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
    await CSMS.initServer()
    await WebApp.initWebUI()
    // Start Modules
    await CSMS.Start()
    await WebApp.Start()
  }
}

export default new Main()
