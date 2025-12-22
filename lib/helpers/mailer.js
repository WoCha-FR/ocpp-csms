import { Log } from 'debug-level'
import nodemailer from 'nodemailer'
import utils from '../helpers/utils.js'

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
  }

}()