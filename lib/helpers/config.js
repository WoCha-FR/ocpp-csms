import fs from 'fs'
import { readFile } from 'fs/promises'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import utils from './utils.js'

import { logger } from 'debug-level'
const log = logger('config')

export default new class Config {
  constructor () {
    this.data = {}
    // First Init
    this.init()
  }

  async init () {
    // eslint-disable-next-line no-undef
    const configPath = dirname(fileURLToPath(new URL('../', import.meta.url)))
    this.file = configPath + '/datas/config/config.json'
    // Use dev file if exists
    if (fs.existsSync(configPath + '/datas/config/config.dev.json')) {
      this.file = configPath + '/datas/config/config.dev.json'
      log.log('Using config.dev.json')
    }
    await this.loadConfigFile()
    utils.event.emit('config_loaded')
  }

  async loadConfigFile () {
    try {
      this.data = JSON.parse(await readFile(this.file))
      log.debug('Config: ' + JSON.stringify(this.data))
    } catch (err) {
      log.fatal(err.message)
      log.fatal('Configuration file could not be read, check that it exist and is valid.')
      // eslint-disable-next-line no-undef
      process.exit(1)
    }
  }
}()
