import conf from 'config'
import { checkSchema } from 'express-validator'
import passport from 'passport'
import { Strategy as LocalStrategy } from 'passport-local'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import bcrypt from 'bcrypt'
import sqlite from '../datas/db.js'

export default async (app) => {
  // PassPort Middleware
  app.use(passport.initialize())
  app.use(passport.session())
  // Passport Serialize & Deserialize
  passport.serializeUser((user, done) => {
    delete user.password
    done(null, user)
  })
  passport.deserializeUser((user, done) => {
    const userdata = sqlite.getUserInfosById(user.user_pk)
    done(null, userdata)
  })
  // Passport GoogleStrategy
  if (conf.get('authGoogle.enabled') === true) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: conf.get('authGoogle.clientID'),
          clientSecret: conf.get('authGoogle.clientSecret'),
          callbackURL: conf.get('http.host') + '/auth/google/callback/',
          scope: ['email', 'profile'],
          state: true,
        },
        function verify(accessToken, refreshToken, profile, done) {
          // Check if user with Google ID exists
          const userg = sqlite.getUserGoogleCredentials(profile.id)
          if (userg) {
            return done(null, userg)
          }
          // Check if user with email exists
          const userm = sqlite.getUserCredentials(profile.emails[0].value)
          if (!userm) {
            return done(null, false, { message: 'USERNAME' })
          }
          // Link Google ID to existing user
          const upd = sqlite.setGoogleId(userm.user_pk, profile.id)
          if (upd.error) {
            return done(null, false, { message: 'SET PROFILE ID ERROR' })
          }
          return done(null, userm)
        }
      )
    )
    // Get login
    app.get('/auth/google', passport.authenticate('google'))
    app.get(
      '/auth/google/callback',
      passport.authenticate('google', {
        successReturnToOrRedirect: '/dashboard',
        failureRedirect: '/auth/login',
        failureMessage: true,
      })
    )
  }
  // Passport LocalStrategy
  passport.use(
    new LocalStrategy((username, password, done) => {
      const user = sqlite.getUserCredentials(username)
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
    })
  )
  // Schema Nettoyage seul express-validator
  let loginSchema = {
    username: {
      trim: true,
      escape: true,
      normalizeEmail: { options: { gmail_remove_dots: false } },
      isEmail: { options: { allow_ip_domain: false } },
    },
    password: { trim: true, escape: true },
  }
  // Sanitize and Authenticate
  app.post(
    '/auth/login',
    checkSchema(loginSchema),
    passport.authenticate('local', { successRedirect: '/dashboard', failureRedirect: '/auth/login', failureMessage: true })
  )
}
