import conf from 'config'
import express from 'express'
import favicon from 'express-favicon'
import session from 'express-session'
import { express as useragent } from 'express-useragent'
import morgan from 'morgan'
import winston from 'winston'
import 'winston-daily-rotate-file'
import cookieParser from 'cookie-parser'
import i18nExpress from 'i18n-express'
import { JSONFilePreset } from 'lowdb/node'
import lowdbStore from 'connect-lowdb'

import utils from '../helpers/utils.js'

const rootDir = utils.rootdir()

export default async (app) => {
  // Templating system
  app.set('view engine', 'ejs')
  app.set('views', rootDir + '/web/views')
  // App Locals
  app.locals.APPTITLE = conf.get('http.title') || 'OCPP CSMS'
  app.locals.APPVERSION = utils.appVersion()
  // Body Parser
  app.use(express.urlencoded({ extended: false }))
  // Winston Logger
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.printf(({ message }) => {
      return `${message}`
    }),
    transports: [
      new winston.transports.DailyRotateFile({
        filename: 'combined-%DATE%.log',
        dirname: utils.rootdir() + '/datas/httplogs',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '30d',
        maxSize: '10m',
        zippedArchive: true,
      }),
      new winston.transports.Console({
        format: winston.format.printf(({ message }) => {
          return `${message}`
        }),
      }),
    ],
  })
  const stream = {
    write: (message) => {
      logger.info(message.trim())
    },
  }
  app.use(morgan('combined', { stream: stream }))
  // Static
  app.use(favicon(rootDir + '/web/public/img/favicon.ico'))
  app.use(express.static(rootDir + '/web/public'))
  // Cookie Traduction
  app.use(cookieParser())
  app.use(
    i18nExpress({
      translationsPath: rootDir + '/i18n',
      siteLangs: ['en', 'fr'],
      defaultLang: 'fr',
      cookieLangName: 'ocppcsmsLang',
      updateFiles: false,
    })
  )
  // User Agent
  app.use(useragent())
  // Session Storage
  const db = await JSONFilePreset(rootDir + '/datas/sessions.json', null)
  const LowdbStore = lowdbStore(session)
  // Session Middleware
  app.use(
    session({
      store: new LowdbStore({ db }, { ttl: 86400 }),
      secret: 'KjWGT;G(OZqJw6^;3}Kj',
      rolling: true,
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 60 * 60 * 1000, sameSite: 'lax' },
    })
  )
  // Initialise session container for app
  function initOcppSession(req, res, next) {
    if (req.session && req.session.ocppcsms === undefined) {
      req.session.ocppcsms = {}
    }
    next()
  }
  app.use(initOcppSession)
}
