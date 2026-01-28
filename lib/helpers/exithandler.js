/* eslint-disable no-undef */
import utils from './utils.js'
import sqlite from '../datas/db.js'
import WebApp from '../site/site.js'
import CSMS from '../csms/csms.js'
import log from '../helpers/logger.js'

class ExitHandler {
  constructor() {
    // First Init
    this.init()
  }

  async init() {
    process.on('exit', this.processExit.bind(null, 0))
    process.on('SIGINT', this.processExit.bind(null, 0))
    process.on('SIGTERM', this.processExit.bind(null, 0))
    process.on('SIGUSR2', this.processExit.bind(null, 0))
    process.on('uncaughtException', (err) => {
      log.error('FATAL - Uncaught Exception')
      log.error(err.message)
      log.error(err.stack)
      this.processExit(2)
    })

    process.on('unhandledRejection', (err) => {
      log.warn('WARNING - Unhandled Promise Rejection')
      log.warn(err)
    })
  }

  async processExit(exitCode) {
    log.info('The OCPP-CSMS process is shutting down...')
    await CSMS.Stop()
    await WebApp.Stop()
    await sqlite.closeDB()
    await utils.sleep(1)
    if (exitCode || exitCode === 0) log.info(`Exit code: ${exitCode}`)
    process.exit()
  }
}

export default new ExitHandler()
