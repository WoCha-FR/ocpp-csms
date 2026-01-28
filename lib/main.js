import './helpers/exithandler.js'
import utils from './helpers/utils.js'
import eMailer from './notifs/mailer.js'
import sqlite from './datas/db.js'
import CSMS from './csms/csms.js'
import WebApp from './site/site.js'
import fs from 'fs'
import logger from './helpers/logger.js'

export default new (class Main {
  constructor() {
    this.log = logger
    utils.event.on('config_loaded', () => {
      this.Start()
    })
  }

  async Start() {
    this.log.info('START: ' + utils.appVersion())
    // Data Dir
    const datadir = utils.rootdir() + '/datas'
    if (!fs.existsSync(datadir)) {
      fs.mkdirSync(datadir)
    }
    // Init Modules
    await eMailer.initMailer()
    await sqlite.initDB()
    await CSMS.initServer()
    await WebApp.initWebUI()
    // Start Modules
    await CSMS.Start()
    await WebApp.Start()
  }
})()
