import conf from 'config'
import nodemailer from 'nodemailer'
import { readFile } from 'fs/promises'
import utils from '../helpers/utils.js'
import Pushover from '../helpers/pushover.js'
import userDB from '../datas/user-db.js'
import logger from '../helpers/logger.js'

class eMailer {
  constructor() {
    this.log = logger.child({ childLabel: 'NOTIFS' })
    this.transporter
    this.langs = []
  }

  async initMailer() {
    // Setup sendmail transporter
    if (conf.get('email.mode') === 'sendmail') {
      this.transporter = nodemailer.createTransport(conf.get('email.sendmail'))
    }
    // Setup SMTP transporter
    else if (conf.get('email.mode') === 'smtp') {
      this.transporter = nodemailer.createTransport(conf.get('email.smtp'))
    }
    // Setup service transporter
    else if (conf.get('email.mode') === 'service') {
      this.transporter = nodemailer.createTransport(conf.get('email.service'))
    }
    // Verify connection configuration
    try {
      await this.transporter.verify()
      this.log.info('Server is ready to accept messages')
    } catch (err) {
      this.log.error(`Configuration error: ${err.message}`)
    }
    // Load available languages
    this.langs['fr'] = JSON.parse(await readFile(utils.rootdir() + '/i18n/fr_notifs.json', 'utf8'))
    this.langs['en'] = JSON.parse(await readFile(utils.rootdir() + '/i18n/en_notifs.json', 'utf8'))
    // Event listener for sending email on charger connection/disconnection
    utils.event.on('cbOnline', (ocppid) => {
      this.log.debug('Event cbOnline received in mailer')
      this.sendConnectInfo(ocppid)
    })
    utils.event.on('cbOffline', (ocppid) => {
      this.log.debug('Event cbOffline received in mailer')
      this.sendDisconnectInfo(ocppid)
    })
    // Diagnostics notifications
    utils.event.on('cbDiag', (ocppid, status) => {
      this.log.debug('Event cbDiag received in mailer')
      this.sendDiagFileInfo(ocppid, status)
    })
    // Connector status change notifications
    utils.event.on('chgStatus', (ocppid, data) => {
      this.log.debug('Event chgStatus received in mailer')
      // Available / Unavailable / Faulted statuses for Admin & Owner
      if (['Available', 'Unavailable', 'Faulted'].includes(data.status)) {
        this.sendAdminStatusInfo(ocppid, data)
      }
      // Charging / SuspendedEVSE / SuspendedEV statuses for users
      if (['Charging', 'SuspendedEVSE', 'SuspendedEV'].includes(data.status)) {
        this.sendChargeEventInfo(ocppid, data)
      }
    })
    // User Creation notifications
    utils.event.on('userCreated', (usermail, userpwd) => {
      this.log.debug('Event userCreated received in mailer')
      const replaceStr = {
        '{webname}': conf.get('http.title'),
        '{weburl}': conf.get('http.host'),
        '{user_mail}': usermail,
        '{user_pwd}': userpwd,
      }
      const userData = {
        to: usermail,
        subject: this.replaceVars(this.langs['fr'].NEWUSER_SUB, replaceStr),
        text: this.replaceVars(this.langs['fr'].NEWUSER_TXT, replaceStr),
        html: this.replaceVars(this.langs['fr'].NEWUSER_HTM, replaceStr),
      }
      this.sendMail(userData)
    })
  }

  async sendDiagFileInfo(ocppid, status) {
    const users = await userDB.getAdminToNotifyCB('cbDiag', ocppid)
    // If error retrieving users, exit
    if (!users) {
      this.log.error(`Error retrieving users to notify for charger ${ocppid} diagnostics ${status}`)
      return
    }
    // If no users to notify, exit
    if (users.length === 0) {
      this.log.info(`No users to notify for charger ${ocppid} diagnostics ${status}`)
      return
    }
    // Send email to each user
    for (const user of users) {
      const replaceStr = { '{cb_name}': user.cb_name, '{diag_status}': status }
      if (user.mailEnabled === 1) {
        let userData = {
          to: user.usermail,
          subject: this.replaceVars(this.langs[user.lang || 'fr'].DIAG_SUB, replaceStr),
          text: this.replaceVars(this.langs[user.lang || 'fr'].DIAG_TXT, replaceStr),
          html: this.replaceVars(this.langs[user.lang || 'fr'].DIAG_HTM, replaceStr),
        }
        // Add site info for admin
        if (user.isAdmin === 1) {
          userData.subject += ` (${user.site_name})`
        }
        this.sendMail(userData)
      }
      if (user.pushEnabled === 1 && user.pushuser !== null && user.pushtokn !== null) {
        const pushData = {
          user: user.pushuser,
          token: user.pushtokn,
          title: this.replaceVars(this.langs[user.lang || 'fr'].DIAG_SUB, replaceStr),
          message: this.replaceVars(this.langs[user.lang || 'fr'].DIAG_HTM, replaceStr),
          html: 1,
        }
        // Add site info for admin
        if (user.isAdmin === 1) {
          pushData.title += ` (${user.site_name})`
        }
        this.sendPush(pushData)
      }
    }
  }

  async sendAdminStatusInfo(ocppid, stData) {
    let users = undefined
    if (stData.status === 'Faulted') {
      users = await userDB.getAdminToNotifyConnector('conFaulted', ocppid, stData.connectorId)
    } else if (stData.status === 'Unavailable') {
      users = await userDB.getAdminToNotifyConnector('conUnavailable', ocppid, stData.connectorId)
    } else if (stData.status === 'Available') {
      users = await userDB.getAdminToNotifyConnector('conAvailable', ocppid, stData.connectorId)
    }
    // If error retrieving users, exit
    if (!users) {
      this.log.warn(
        `Error retrieving users to notify for charger ${ocppid} connector #${stData.connectorId} ${stData.status}`
      )
      return
    }
    // If no users to notify, exit
    if (users.length === 0) {
      this.log.info(`No users to notify for charger ${ocppid} connector #${stData.connectorId} ${stData.status}`)
      return
    }
    // Send email to each user
    for (const user of users) {
      const replaceStr = {
        '{cb_name}': user.cb_name,
        '{c_id}': stData.connectorId,
        '{c_name}': user.c_name || '',
        '{c_status}': user.c_status || '',
        '{ecode}': stData.errorCode,
        '{einfo}': stData.info || '',
        '{vcode}': stData.vendorErrorCode || '----',
      }
      if (user.mailEnabled === 1) {
        let userData = { to: user.usermail, subject: '', text: '', html: '' }
        // Faulted message
        if (stData.status === 'Faulted') {
          userData.subject = this.replaceVars(this.langs[user.lang || 'fr'].FAULTED_SUB, replaceStr)
          userData.text = this.replaceVars(this.langs[user.lang || 'fr'].FAULTED_TXT, replaceStr)
          userData.html = this.replaceVars(this.langs[user.lang || 'fr'].FAULTED_HTM, replaceStr)
        }
        // Unavailable message
        if (stData.status === 'Unavailable') {
          userData.subject = this.replaceVars(this.langs[user.lang || 'fr'].UNAVAILABLE_SUB, replaceStr)
          userData.text = this.replaceVars(this.langs[user.lang || 'fr'].UNAVAILABLE_TXT, replaceStr)
          userData.html = this.replaceVars(this.langs[user.lang || 'fr'].UNAVAILABLE_HTM, replaceStr)
        }
        // Available message
        if (stData.status === 'Available') {
          userData.subject = this.replaceVars(this.langs[user.lang || 'fr'].AVAILABLE_SUB, replaceStr)
          userData.text = this.replaceVars(this.langs[user.lang || 'fr'].AVAILABLE_TXT, replaceStr)
          userData.html = this.replaceVars(this.langs[user.lang || 'fr'].AVAILABLE_HTM, replaceStr)
        }
        // Add site info for admin
        if (user.isAdmin === 1) {
          userData.subject += ` (${user.site_name})`
        }
        this.sendMail(userData)
      }
      if (user.pushEnabled === 1 && user.pushuser !== null && user.pushtokn !== null) {
        let pushData = { user: user.pushuser, token: user.pushtokn, priority: 0, title: '', message: '', html: 1 }
        // Faulted message
        if (stData.status === 'Faulted') {
          pushData.priority = 1
          pushData.title = this.replaceVars(this.langs[user.lang || 'fr'].FAULTED_SUB, replaceStr)
          pushData.message = this.replaceVars(this.langs[user.lang || 'fr'].FAULTED_HTM, replaceStr)
        }
        // Unavailable message
        if (stData.status === 'Unavailable') {
          pushData.priority = 1
          pushData.title = this.replaceVars(this.langs[user.lang || 'fr'].UNAVAILABLE_SUB, replaceStr)
          pushData.message = this.replaceVars(this.langs[user.lang || 'fr'].UNAVAILABLE_HTM, replaceStr)
        }
        // Available message
        if (stData.status === 'Available') {
          pushData.title = this.replaceVars(this.langs[user.lang || 'fr'].AVAILABLE_SUB, replaceStr)
          pushData.message = this.replaceVars(this.langs[user.lang || 'fr'].AVAILABLE_HTM, replaceStr)
        }
        // Add site info for admin
        if (user.isAdmin === 1) {
          pushData.title += ` (${user.site_name})`
        }
        this.sendPush(pushData)
      }
    }
  }

  async sendChargeEventInfo(ocppid, stData) {
    const user = await userDB.getUserToNotifyChargeEvent(ocppid, stData.connectorId)
    // If error retrieving users, exit
    if (!user) {
      this.log.warn(
        `Error retrieving users to notify for charger ${ocppid} connector #${stData.connectorId} ${stData.status}`
      )
      return
    }
    // If no users to notify, exit
    if (user.length === 0) {
      this.log.info(`No users to notify for charger ${ocppid} connector #${stData.connectorId} ${stData.status}`)
      return
    }
    // Assign variables for replacement in message templates
    const replaceStr = { '{cb_name}': user.cb_name, '{c_id}': stData.connectorId, '{c_name}': user.c_name || '' }
    // Send email to user
    if (user.mailEnabled === 1) {
      let userData = { to: user.usermail, subject: '', text: '', html: '' }
      if (stData.status === 'Charging') {
        userData.subject = this.replaceVars(this.langs[user.lang || 'fr'].CHARGING_SUB, replaceStr)
        userData.text = this.replaceVars(this.langs[user.lang || 'fr'].CHARGING_TXT, replaceStr)
        userData.html = this.replaceVars(this.langs[user.lang || 'fr'].CHARGING_HTM, replaceStr)
      } else if (stData.status === 'SuspendedEVSE') {
        userData.subject = this.replaceVars(this.langs[user.lang || 'fr'].SUSPENDEVSE_SUB, replaceStr)
        userData.text = this.replaceVars(this.langs[user.lang || 'fr'].SUSPENDEVSE_TXT, replaceStr)
        userData.html = this.replaceVars(this.langs[user.lang || 'fr'].SUSPENDEVSE_HTM, replaceStr)
      } else if (stData.status === 'SuspendedEV') {
        userData.subject = this.replaceVars(this.langs[user.lang || 'fr'].SUSPENDEV_SUB, replaceStr)
        userData.text = this.replaceVars(this.langs[user.lang || 'fr'].SUSPENDEV_TXT, replaceStr)
        userData.html = this.replaceVars(this.langs[user.lang || 'fr'].SUSPENDEV_HTM, replaceStr)
      }
      this.sendMail(userData)
    }
    // Send push notification to user
    if (user.pushEnabled === 1 && user.pushuser !== null && user.pushtokn !== null) {
      let pushData = { user: user.pushuser, token: user.pushtokn, title: '', message: '', html: 1 }
      if (stData.status === 'Charging') {
        pushData.title = this.replaceVars(this.langs[user.lang || 'fr'].CHARGING_SUB, replaceStr)
        pushData.message = this.replaceVars(this.langs[user.lang || 'fr'].CHARGING_HTM, replaceStr)
      } else if (stData.status === 'SuspendedEVSE') {
        pushData.title = this.replaceVars(this.langs[user.lang || 'fr'].SUSPENDEVSE_SUB, replaceStr)
        pushData.message = this.replaceVars(this.langs[user.lang || 'fr'].SUSPENDEVSE_HTM, replaceStr)
      } else if (stData.status === 'SuspendedEV') {
        pushData.title = this.replaceVars(this.langs[user.lang || 'fr'].SUSPENDEV_SUB, replaceStr)
        pushData.message = this.replaceVars(this.langs[user.lang || 'fr'].SUSPENDEV_HTM, replaceStr)
      }
      this.sendPush(pushData)
    }
  }

  async sendConnectInfo(ocppid) {
    const users = await userDB.getAdminToNotifyCB('cbOnline', ocppid)
    // If error retrieving users, exit
    if (!users) {
      this.log.error(`Error retrieving users to notify for charger ${ocppid}`)
      return
    }
    // If no users to notify, exit
    if (users.length === 0) {
      this.log.info(`No users to notify for charger ${ocppid}`)
      return
    }
    // Send email & Pushover to each user
    for (const user of users) {
      const replaceStr = { '{cb_name}': user.cb_name }
      if (user.mailEnabled === 1) {
        let userData = {
          to: user.usermail,
          subject: this.replaceVars(this.langs[user.lang || 'fr'].ONLINE_SUB, replaceStr),
          text: this.replaceVars(this.langs[user.lang || 'fr'].ONLINE_TXT, replaceStr),
          html: this.replaceVars(this.langs[user.lang || 'fr'].ONLINE_HTM, replaceStr),
        }
        // Add site info for admin
        if (user.isAdmin === 1) {
          userData.subject += ` (${user.site_name})`
        }
        this.sendMail(userData)
      }
      if (user.pushEnabled === 1 && user.pushuser !== null && user.pushtokn !== null) {
        const pushData = {
          user: user.pushuser,
          token: user.pushtokn,
          title: this.replaceVars(this.langs[user.lang || 'fr'].ONLINE_SUB, replaceStr),
          message: this.replaceVars(this.langs[user.lang || 'fr'].ONLINE_HTM, replaceStr),
          html: 1,
        }
        // Add site info for admin
        if (user.isAdmin === 1) {
          pushData.title += ` (${user.site_name})`
        }
        this.sendPush(pushData)
      }
    }
  }

  async sendDisconnectInfo(ocppid) {
    const users = await userDB.getAdminToNotifyCB('cbOffline', ocppid)
    // If error retrieving users, exit
    if (!users) {
      this.log.error(`Error retrieving users to notify for charger ${ocppid}`)
      return
    }
    // If no users to notify, exit
    if (users.length === 0) {
      this.log.info(`No users to notify for charger ${ocppid}`)
      return
    }
    // Send email to each user
    for (const user of users) {
      const replaceStr = { '{cb_name}': user.cb_name }
      if (user.mailEnabled === 1) {
        const userData = {
          to: user.usermail,
          subject: this.replaceVars(this.langs[user.lang || 'fr'].ONLINE_SUB, replaceStr),
          text: this.replaceVars(this.langs[user.lang || 'fr'].ONLINE_TXT, replaceStr),
          html: this.replaceVars(this.langs[user.lang || 'fr'].ONLINE_HTM, replaceStr),
        }
        // Add site info for admin
        if (user.isAdmin === 1) {
          userData.subject += ` (${user.site_name})`
        }
        this.sendMail(userData)
      }
      if (user.pushEnabled === 1 && user.pushuser !== null && user.pushtokn !== null) {
        const pushData = {
          user: user.pushuser,
          token: user.pushtokn,
          priority: 1,
          title: this.replaceVars(this.langs[user.lang || 'fr'].ONLINE_SUB, replaceStr),
          message: this.replaceVars(this.langs[user.lang || 'fr'].ONLINE_HTM, replaceStr),
          html: 1,
        }
        // Add site info for admin
        if (user.isAdmin === 1) {
          pushData.title += ` (${user.site_name})`
        }
        this.sendPush(pushData)
      }
    }
  }

  async sendMail(userData) {
    const mailData = { from: conf.get('email.from'), replyTo: conf.get('email.replyTo'), ...userData }
    try {
      const info = await this.transporter.sendMail(mailData)
      this.log.debug(`Message sent: ${info.messageId}`)
    } catch (err) {
      this.log.error(`Error while sending mail: ${err.message}`)
    }
  }

  async sendPush(pushData) {
    try {
      const po = new Pushover()
      await po.sendWithPayload(pushData)
      this.log.debug('Notification sent successfully')
    } catch (error) {
      this.log.error(`Error while sending pushover: ${error.message}`)
    }
  }

  replaceVars(str, replaceto) {
    // Create regex pattern to match all keys at once (e.g., /{cb_name}|{c_id}|{c_name}/g)
    const keys = Object.keys(replaceto)
    if (keys.length === 0) return str
    const pattern = keys.map((k) => k.replace(/[{}]/g, '\\$&')).join('|')
    const regex = new RegExp(pattern, 'g')
    return str.replace(regex, (match) => replaceto[match])
  }
}
export default new eMailer()
