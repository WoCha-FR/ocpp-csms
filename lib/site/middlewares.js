import express from 'express'
import favicon from 'express-favicon'
import session from 'express-session'
import { checkSchema } from 'express-validator'
import morgan from 'morgan'
import { createStream } from 'rotating-file-stream'
import cookieParser from 'cookie-parser'
import i18nExpress from 'i18n-express'
import { JSONFilePreset } from 'lowdb/node'
import lowdbStore from 'connect-lowdb'
import passport from 'passport'
import { Strategy } from 'passport-local'
import bcrypt from 'bcrypt'

import utils from '../helpers/utils.js'
import sqlite from '../datas/db.js'

const rootDir = utils.rootdir()

export default async app => {
  // Templating system
  app.set('view engine', 'ejs')
  // Body Parser
  app.use(express.urlencoded({ extended: false }))
  // HTTP Log
  const stream = createStream('file.log', {
    size: '10M',
    interval: '1d',
    compress: 'gzip',
    path: rootDir + '/datas/'
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
  // Passport Session Middleware
  app.use(session({
    store: new LowdbStore({ db }, { ttl: 86400}),
    secret: 'KjWGT;G(OZqJw6^;3}Kj',
    rolling: true,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000, sameSite: 'lax' }
  }))
  // PassPort Middleware
  app.use(passport.initialize())
  app.use(passport.session())
  // Passport Local Strategy
  passport.use(new Strategy((username, password, done) => {
    const user = sqlite.getUsernameCredentials(username)
    if (!user) {
      return done(null, false, { message: 'USERNAME' })
    }
    bcrypt.compare(password, user.password, (err, result) => {
      if (err) {
        // eslint-disable-next-line no-undef
        console.log('Error comparing passwords:', err)
        return done(null, false, { message: 'Error comparing passwords' })
      }
      if (result) {
        return done(null, user)
      } else {
        return done(null, false, { message: 'PASSWORD' })
      }
    })
  }))
  // Passport Serialize
  passport.serializeUser( (user, done) => {
    delete(user.password)
    done(null, user)
  })
  // Passport Deserialize
  passport.deserializeUser((user, done) => {
    const userdata = sqlite.getUserInfosById(user.user_pk)
    done(null, userdata)
  })
  // Schema Nettoyage seul express-validator
  let loginSchema = {
    username: { trim: true, escape: true},
    password: { trim: true, escape: true}
  }
  // Sanitize and Authenticate
  app.post('/login', checkSchema(loginSchema), passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/login',
    failureMessage: true
  }))
  // Initialise session container for app
  function initOcppSession(req, res, next) {
    if (req.session && req.session.ocppcsms === undefined) {
      req.session.ocppcsms = {}
    }
    next()
  }
  app.use(initOcppSession)
  // Passport DEV
  /*
  let count = 1
  let printData = (req, res, next) => {
    console.log("\n==============================")
    console.log(`------------>  ${count++}`)
    console.log(`req.body.username -------> ${req.body.username}`)
    console.log(`req.body.password -------> ${req.body.password}`)
    console.log(`\n req.session.passport -------> `)
    console.log(req.session.passport)
    console.log(`\n req.user -------> `)
    console.log(req.user)
    console.log("\n Session and Cookie")
    console.log(`req.session.id -------> ${req.session.id}`)
    console.log(`req.session.cookie -------> `)
    console.log(req.session.cookie)
    console.log(`req.session.messages -------> `)
    console.log(req.session.messages)
    console.log("===========================================\n")
    next()
  }
  app.use(printData)
  */
}