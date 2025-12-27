import { Log } from 'debug-level'
import nodemailer from 'nodemailer'
import utils from '../helpers/utils.js'
import Pushover from "../helpers/pushover.js"
import userDB from '../datas/user-db.js'

export default new class eMailer {
  constructor () {
    this.log
    this.transporter
  }

  async initMailer () {
    this.log = new Log('mailer', { level: utils.config().loglvl })
    // Setup sendmail transporter
    if (utils.config().email.mode === 'sendmail') {
      this.transporter = nodemailer.createTransport(
        utils.config().email.sendmail
      )
    }
    // Setup SMTP transporter
    else if (utils.config().email.mode === 'smtp') {
      this.transporter = nodemailer.createTransport(
        utils.config().email.smtp
      )
    }
    // Setup service transporter
    else if (utils.config().email.mode === 'service') {
      this.transporter = nodemailer.createTransport(
        utils.config().email.service
      )
    }
    // Verify connection configuration
    try {
      await this.transporter.verify()
      this.log.log('Server is ready to accept messages')
    } catch (err) {
      this.log.error('Configuration error:', err.message)
    }
    // Event listener for sending email on client connect
    utils.event.on('client_connected', (ocppid) => {
      this.log.log('Event client_connected received in mailer')
      this.sendConnectInfo(ocppid)
    })
    utils.event.on('client_disconnect', (ocppid) => {
      this.log.log('Event client_disconnect received in mailer')
      this.sendDisconnectInfo(ocppid)
    })
  }

  async sendConnectInfo(ocppid) {
    const users = await userDB.getAdminToNotify('cbOnline', ocppid)
    // If error retrieving users, exit
    if (users instanceof Error) {
      this.log.error(`Error retrieving users to notify for charger ${ocppid} connection: ${users.message}`)
      return
    }
    // If no users to notify, exit
    if (users.length === 0) {
      this.log.info(`No users to notify for charger ${ocppid} connection`)
      return
    }
    // Send email to each user
    for (const user of users) {
      if (user.mailEnabled === 1) {
        const info = await this.transporter.sendMail({
          from: utils.config().email.from,
          replyTo: utils.config().email.replyTo,
          to: user.usermail,
          subject: "Charger Connected",
          text: ocppid + " is now connected.",
          html: "<p><b>" + ocppid + "</b> is now connected.</p>",
        })
        this.log.info('Message sent: %s', info.messageId)
      }
      if (user.pushEnabled === 1 && (user.pushuser !== null && user.pushtoken !== null)) {
        const po = new Pushover()
        po.setUser(user.pushuser)
        po.setToken(user.pushtoken)
        po.setTitle('Charger Connected')
        po.setMessage('<p><b>' + ocppid + '</b> is now connected.</p>')
        po.setHtml()
        try {
          await po.send()
          this.log.info('Notification sent successfully')
        } catch (error) {
          this.log.error(error.message)
        }
      }
    }
  }

  async sendDisconnectInfo(ocppid) {
    const users = await userDB.getAdminToNotify('cbOffline', ocppid)
    // If error retrieving users, exit
    if (users instanceof Error) {
      this.log.error(`Error retrieving users to notify for charger ${ocppid} disconnection: ${users.message}`)
      return
    }
    // If no users to notify, exit
    if (users.length === 0) {
      this.log.info(`No users to notify for charger ${ocppid} disconnection`)
      return
    }
    // Send email to each user
    for (const user of users) {
      if (user.mailEnabled === 1) {
        const info = await this.transporter.sendMail({
          from: utils.config().email.from,
          replyTo: utils.config().email.replyTo,
          to: user.usermail,
          subject: "Charger Disconnected",
          text: ocppid + " is now disconnected.",
          html: "<p><b>" + ocppid + "</b> is now disconnected.</p>",
        })
        this.log.info('Message sent: %s', info.messageId)
      }
      if (user.pushEnabled === 1 && (user.pushuser !== null && user.pushtoken !== null)) {
        const po = new Pushover()
        po.setUser(user.pushuser)
        po.setToken(user.pushtoken)
        po.setTitle('Charger Connected')
        po.setMessage('<p><b>' + ocppid + '</b> is now connected.</p>')
        po.setHtml()
        try {
          await po.send()
          this.log.info('Notification sent successfully')
        } catch (error) {
          this.log.error(error.message)
        }
      }
    }
  }

}()