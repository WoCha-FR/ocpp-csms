import './helpers/exithandler.js'
import utils from './helpers/utils.js'
import sqlite from './datas/db.js'
import CSMS from './csms/csms.js'
import WebApp from './site/site.js'
import fs from 'fs'
import Log from 'debug-level'

export default new class Main {
  constructor () {
    this.log
    utils.event.on('config_loaded', () => {
      this.Start()
    })
  }

  async Start () {
    // Init Log
    this.log = new Log('main', { level: utils.config().loglvl })
    this.log.log('START: ' + utils.appVersion())
    // Data Dir
    const datadir = utils.rootdir() + '/datas'
    if (!fs.existsSync(datadir)){
      fs.mkdirSync(datadir)
    }
    // Init Modules
    await sqlite.initDB()
    await CSMS.initServer()
    await WebApp.initWebUI()
    // Start Modules
    await CSMS.Start()
    await WebApp.Start()
  }
}()
