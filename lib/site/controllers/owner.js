//import { matchedData, validationResult, body } from 'express-validator'
import { matchedData, validationResult } from 'express-validator'
//import { JSONFilePreset } from 'lowdb/node'
//import { URL } from 'url'
//import fs from 'fs'
//import ejs from 'ejs'
//import bcrypt from 'bcrypt'
//import utils from '../../helpers/utils.js'
import sqlite from '../../datas/db.js'
//import csms from '../../csms/csms.js'

const OwnerController = {
  /* USERS */
  getAllUsers: async (req, res) => {
    const result = await sqlite.getSiteUsers(req.session.passport.user.ownedSite)
    if (result.error) {
      req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${result.error}`}] }
    }
    // Render
    res.render('site_users.ejs', {
      onUsers: true, siteusers: result,
      userInfo: req.session.passport.user,
      infosui: req.session.ocppcsms
    })
    req.session.ocppcsms = {}
  },
  UserAddSchema: {
    usermail: {
      normalizeEmail: true,
      isEmail: {options: {allow_ip_domain: false}}
    },
    uname: {
      trim: true, escape: true,
      isLength: { options: { min: 5, max:50 } },
      matches: { options: /^[a-zA-Z0-9-_ ]*$/ },
    }
  },
  addSiteUser: async (req, res) => {
    const result = validationResult(req)
    let uid = null
    if (result.isEmpty()) {
      let data = matchedData(req)
      // Recup UserPK from users table if exists.
      let response = await sqlite.getUserIdByMail(data.usermail)
      if (response) {
        if (response.error) {
          req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
        } else {
          // pas d'admin
          if (response.isAdmin === 1) {
            req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `This user is an administrator`}] }
          } else {
            uid = response.user_pk
          }
        }
      } else {
        // Create in users table.
        let params = {
          umail: data.usermail,
          uname: 'Utilisateur',
          upass: 'NOTCRYPTEDPASSWORD',
          owner: null,
          admin: 0
        }
        let response2 = await sqlite.addUser(params)
        if (response2.error) {
          req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response2.error}`}] }
        } else {
          uid = response2.lastInsertRowid
        }
      }
      // Add in sites_users table
      if (uid) {
        let params = {
          spk: req.session.passport.user.ownedSite,
          upk: uid,
          uname: data.uname
        }
        let response3 = await sqlite.addSiteUser(params)
        if (response3.error) {
          req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response3.error}`}] }
        }
      }
      res.redirect('/users')
      return undefined
    } else {
      // Validation False
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/users')
      return undefined
    }
  },
  formUpdSiteUser: async (req, res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        pk: data.elemId,
        spk: req.session.passport.user.ownedSite
      }
      let response = await sqlite.getUserSiteUserById(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
        res.redirect('/users')
        return undefined
      }
      // Render
      res.render('site_user_updform.ejs', {
        onUsers: true, user: response,
        userInfo: req.session.passport.user,
        infosui: req.session.ocppcsms
      })
      req.session.ocppcsms = {}
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/users')
      return undefined
    }
  },
  UserUpdSchema: {
    pk: {
      isInt: true, trim: true, escape: true
    },
    uname: {
      trim: true, escape: true,
      isLength: { options: { min: 5, max:50 } },
      matches: { options: /^[a-zA-Z0-9-_ ]*$/ },
    }
  },
  updSiteUser: async (req,res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        pk: data.pk,
        uname: data.uname,
        spk: req.session.passport.user.ownedSite
      }
      let response = await sqlite.updSiteUser(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/users')
      return undefined
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/users')
      return undefined
    }
  },
  delSiteUser: async (req,res) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
      let data = matchedData(req)
      let params = {
        pk: data.elemId,
        spk: req.session.passport.user.ownedSite
      }
      let response = await sqlite.delSiteUser(params)
      if (response.error) {
        req.session.ocppcsms.ocppErrors = { sqlite: [{sqlerror: `${response.error}`}] }
      }
      res.redirect('/users')
      return undefined
    } else {
      req.session.ocppcsms.ocppErrors = { ocppInput: result.array() }
      res.redirect('/users')
      return undefined
    }
  }
}

export default OwnerController