/* eslint-disable no-undef */
import utils from './utils.js'
import sqlite from '../datas/db.js'
import WebApp from '../site/site.js'
import CSMS from '../csms/csms.js'

import { logger } from 'debug-level'
const log = logger('exitHandler')

export default new class ExitHandler {
  constructor () {
    // First Init
    this.init()
  }

  init () {
    process.on('exit', this.processExit.bind(null, 0))
    process.on('SIGINT', this.processExit.bind(null, 0))
    process.on('SIGTERM', this.processExit.bind(null, 0))
    process.on('uncaughtException', (err) => {
      log.error(err.message)
      log.error(err.stack)
      this.processExit(2)
    })

    process.on('unhandledRejection', (err) => {
      log.warn('WARNING - Unhandled Promise Rejection')
      log.warn(err)
    })
  }

  async processExit (exitCode) {
    log.log('The OCPP-CSMS process is shutting down...')
    await CSMS.Stop()
    await WebApp.Stop()
    await sqlite.closeDB()
    await utils.sleep(1)
    if (exitCode || exitCode === 0) log.log(`Exit code: ${exitCode}`)
    process.exit()
  }
}()