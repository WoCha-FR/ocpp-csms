import express from 'express'
import favicon from 'express-favicon'
import session from 'express-session'
import morgan from 'morgan'
import { createStream } from 'rotating-file-stream'
import cookieParser from 'cookie-parser'
import i18nExpress from 'i18n-express'
import { JSONFilePreset } from 'lowdb/node'
import lowdbStore from 'connect-lowdb'

import utils from '../helpers/utils.js'

const rootDir = utils.rootdir()

export default async app => {
  // Templating system
  app.set('view engine', 'ejs')
  // Body Parser
  app.use(express.urlencoded({ extended: false }))
  // HTTP Log
  const stream = createStream('express.log', {
    size: '10M',
    interval: '1d',
    compress: 'gzip',
    maxFiles: 30,
    path: rootDir + '/logs/'
  })
  app.use(morgan('combined', { stream: stream }))
  // Static
  app.use(favicon(rootDir + '/public/img/favicon.ico'))
  app.use(express.static(rootDir + '/public'))
  // Cookie Traduction
  app.use(cookieParser())
  app.use(i18nExpress({
    translationsPath: rootDir + '/i18n',
    siteLangs: ['en', 'fr'],
    defaultLang: 'fr',
    cookieLangName: 'ocppcsmsLang',
    updateFiles: false
  }))
  // Session Storage
  const db = await JSONFilePreset(rootDir + '/datas/sessions.json', null)
  const LowdbStore = lowdbStore(session)
  // Session Middleware
  app.use(session({
    store: new LowdbStore({ db }, { ttl: 86400}),
    secret: 'KjWGT;G(OZqJw6^;3}Kj',
    rolling: true,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000, sameSite: 'lax' }
  }))
  // Initialise session container for app
  function initOcppSession(req, res, next) {
    if (req.session && req.session.ocppcsms === undefined) {
      req.session.ocppcsms = {}
    }
    next()
  }
  app.use(initOcppSession)
}