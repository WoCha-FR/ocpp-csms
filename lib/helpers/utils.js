import fs from 'fs'
import { EventEmitter } from 'events'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

class Utils {
  constructor() {
    this.event = new EventEmitter()
  }

  msleep(msec) {
    // eslint-disable-next-line no-undef
    return new Promise((resolve) => setTimeout(resolve, msec))
  }

  sleep(sec) {
    return this.msleep(sec * 1000)
  }

  capitalize(val) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1)
  }

  escapeRegExpChars(string) {
    const regExpChars = /[|\\{}()[\]^$+*?.]/g
    if (!string) {
      return ''
    }
    return String(string).replace(regExpChars, '\\$&')
  }

  rootdir() {
    // eslint-disable-next-line no-undef
    return dirname(fileURLToPath(new URL('../', import.meta.url)))
  }

  async test() {
    return true
  }

  appVersion() {
    const packageJSON = JSON.parse(fs.readFileSync('package.json', 'utf8'))
    return packageJSON.version
  }

  generatePwd(len = 12) {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+|}{[]:;?><,./-='
    let password = ''
    for (let i = 0; i < len; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length)
      password += chars[randomIndex]
    }
    return password
  }
}

export default new Utils()
