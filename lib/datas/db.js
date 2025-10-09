/* eslint-disable no-undef */
import Database from 'better-sqlite3'
import fs from 'fs'
import { Log } from 'debug-level'
import utils from '../helpers/utils.js'

export default new class sqlite {
  constructor () {
    this.db
    //this.log
  }

  async initDB() {
    // Logger
    this.log = new Log('sqlite', { level: utils.config().sqlite.loglvl })
    // Path of DB
    const dbFile = utils.rootdir() + '/datas/ocpp-csms.db'
    // Create DB if needed
    fs.stat(dbFile, async function(err) {
      // Fichier inconnu
      if (err && err.code === 'ENOENT') {
        // Create DB
        const tempDB = new Database(dbFile)
         // Create structure
        const path = utils.rootdir() + '/lib/datas/schemas/'
        const struct = fs.readFileSync(path + 'db.sql', { encoding: 'utf8', flag: 'r' })
        try {
          tempDB.exec(struct)
          tempDB.close()
        } catch (err) {
          this.log.fatal(err.message)
          process.exit(1)
        }
      }
    })
    // Ouverture DB
    await utils.sleep(1)
    //this.db = new Database(dbFile, { verbose: this.log.debug })
    this.db = new Database(dbFile)
    // Migration needed ?
    const dbversion = this.db.prepare('SELECT version FROM schema_version WHERE schema_pk=1').pluck().get()
    if (utils.appVersion() != dbversion) {
      this.log.log('Migration de la base de données en cours...', utils.appVersion(), dbversion)
    }
    // Initialisation ok
    this.log.log('Database ready')
  }
  /* WEBUI - USERS LOGIN */
  getUsernameCredentials(username) {
    // Passport login
    try {
      const stmt = this.db.prepare('SELECT `user_pk`, `password`, `name`, `level` FROM users WHERE username = ?')
      const res = stmt.get(username)
      return res
    } catch (err) {
      this.log.warn(err.message)
      return undefined
    }
  }
  getUserInfosById(uid) {
    // Passport deserialize => reprends champs de getUsernameCredentials
    try {
      const stmt = this.db.prepare('SELECT * FROM users WHERE user_pk = ?')
      const res = stmt.get(uid)
      return res
    } catch (err) {
      this.log.warn(err.message)
      return undefined
    }
  }
  /* WEBUI - SITES */
  async getAllSites() {
    try {
      const stmt = this.db.prepare('SELECT `s_pk`, `s_name`, `s_address`, `s_codp`, `s_ville` FROM sites')
      const res = stmt.all()
      return res
    } catch(err) {
      this.log.warn('getAllSites: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  /* WEBUI - USERS */
  async getAllUsers() {
    try {
      const stmt = this.db.prepare('SELECT `user_pk`, `name`, `username`, `level` FROM users')
      const res = stmt.all()
      return res
    } catch(err) {
      this.log.warn('getAllUsers: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  async addUser(params) {
    let query = 'INSERT INTO users (`name`,`username`,`password`,`email`,`level`) VALUES ' +
      '(@name,@uname,@upass,@umail,@ulvl)'
    try {
      let stmt = this.db.prepare(query)
      let res = stmt.run(params)
      return res
    } catch (err) {
      this.log.warn('addUser: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  async updUser(params) {
    let query = 'UPDATE users SET `name`=@name, `username`=@uname, `email`=@umail, '
    if (params.upass) {
      query = query + '`password`=@upass, '
    }
    query = query + '`level`=@ulvl WHERE `user_pk`=@uid'
    try {
      let stmt = this.db.prepare(query)
      let res = stmt.run(params)
      return res
    } catch (err) {
      this.log.warn('updUser: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  async delUser(params) {
    try {
      let stmt = this.db.prepare('DELETE FROM users WHERE `user_pk`=@uid')
      let res = stmt.run(params)
      return res
    } catch (err) {
      this.log.warn('delUser: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  /* CSMS - AUTH STATION */
  getCBAuth(ocppid) {
    ocppid = ocppid.replace(/[!@#$%^&*]/g, '')
    try {
      let stmt = this.db.prepare('SELECT `cb_pwd` FROM charge_box WHERE cb_id = ?')
      let res = stmt.get(ocppid)
      return res // Values or undefined
    } catch (err) {
      this.log.warn('getCBAuth: ' + err)
      return undefined
    }
  }
  getCBRegStatus(ocppid) {
    ocppid = ocppid.replace(/[!@#$%^&*]/g, '')
    try {
      let stmt = this.db.prepare('SELECT `registration_status` FROM charge_box WHERE cb_id = ?')
      let res = stmt.get(ocppid)
      return res // Values or undefined
    } catch (err) {
      this.log.warn('getCBRegStatus: ' + err)
      return undefined
    }
  }
  async setChargeBoxOnOffLine(ocppid, status) {
    try {
      const stmt = this.db.prepare('UPDATE charge_box SET online = ? WHERE cb_id = ?')
      const info = stmt.run(status, ocppid)
      this.log.debug('setChargeBoxOnOffLine: ' + info.changes + ' updated')
    } catch (err) {
      this.log.warn('setChargeBoxOnOffLine: ' + err)
    }
  }  /* CSMS - client.handle() */
  addToLog(params) {
    // Query
    let stmt = this.db.prepare('INSERT INTO charge_box_log (cb_id,timestamp,direction,type,method,message) ' +
    'VALUES (@ocppid, @ts, @direction, @type, @methode, @message)')
    let insertMany = this.db.transaction((logs) => {
      for (const log of logs) {
        stmt.run(log)
      }
    })
    try {
      insertMany.immediate(params)
    } catch (err) {
      this.log.warn('addToLog: ' + err)
    }
  }
  async AutoAddChargeBox(params) {
    /* Pendings & Autoadd params */
    let query = 'INSERT INTO charge_box (cb_id,cb_name,registration_status) VALUES (@id,@name,@regstatus)'
    let data = {
      id : params.ocppid,
      name: params.cbname,
      regstatus: params.regstatus
    }
    try {
      let stmt = this.db.prepare(query)
      let res = stmt.run(data)
      return res
    } catch (err) {
      this.log.warn('AutoAddChargeBox: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  updChargeBoxBootNotif(client, params) {
    let query = 'INSERT INTO charge_box_infos ' +
    '(cb_id,endpoint_address,ocpp_protocol,cp_vendor,cp_model,cp_serial_number,' +
    'cb_serial_number,fw_version,iccid,imsi,meter_type,meter_serial_number) VALUES ' +
    '(@id,@ea,@proto,@cpv,@cpm,@cpsn,@cbsn,@fwv,@iccid,@imsi,@mtyp,@mtsn) ' +
    'ON CONFLICT(cb_id) DO UPDATE SET ' +
    'endpoint_address=excluded.endpoint_address,ocpp_protocol=excluded.ocpp_protocol,cp_vendor=excluded.cp_vendor,' +
    'cp_model=excluded.cp_model,cp_serial_number=excluded.cp_serial_number,cb_serial_number=excluded.cb_serial_number,' +
    'fw_version=excluded.fw_version,iccid=excluded.iccid,imsi=excluded.imsi,meter_type=excluded.meter_type,' +
    'meter_serial_number=excluded.meter_serial_number WHERE cb_id=@id;'
    let data = {
      id : client.ocppid,
      ea : client.endpoint_address || null,
      proto: client.ocpp_protocol || null,
      cpv : params.chargePointVendor,
      cpm : params.chargePointModel,
      cpsn: params.chargePointSerialNumber || null,
      cbsn: params.chargeBoxSerialNumber || null,
      fwv : params.firmwareVersion || null,
      iccid : params.iccid || null,
      imsi: params.imsi || null,
      mtyp: params.meterType || null,
      mtsn: params.meterSerialNumber || null
    }
    try {
      let stmt = this.db.prepare(query)
      let res = stmt.run(data)
      return res
    } catch (err) {
      this.log.warn('updBootNotification: ' + err)
      return undefined
    }
  }
  updHeartBeat(ocppid) {
    let hb_ts = Math.floor(Date.now() / 1000)
    try {
      let stmt = this.db.prepare('UPDATE charge_box SET last_heartbeat_ts = ? WHERE cb_id = ?')
      let res = stmt.run(hb_ts, ocppid)
      return res
    } catch (err) {
      this.log.warn('updHeartBeat: ' + err)
      return undefined
    }
  }
  updLastBoot(ocppid) {
    let hb_ts = Math.floor(Date.now() / 1000)
    try {
      let stmt = this.db.prepare('UPDATE charge_box SET last_bootnotif_ts = ? WHERE cb_id = ?')
      let res = stmt.run(hb_ts, ocppid)
      return res
    } catch (err) {
      this.log.warn('updHeartBeat: ' + err)
      return undefined
    }
  }
  updConnectorStatus(ocppid, params) {
    // Query
    let query = 'INSERT INTO connector_status (' +
      'cb_id,connector_id,status,status_ts,error_code,error_info,vendor_id,vendor_error_code'+
      ') VALUES ' +
      '(@cb_id,@conn_id,@stat,@stat_ts,@ec,@ei,@vei,@vec) ' +
      'ON CONFLICT(cb_id,connector_id) DO UPDATE SET ' +
      'status=excluded.status, status_ts=excluded.status_ts, error_code=excluded.error_code, ' +
      'error_info=excluded.error_info, vendor_id=excluded.vendor_id, ' +
      'vendor_error_code=excluded.vendor_error_code WHERE cb_id=@cb_id AND connector_id=@conn_id;'
    // Data
    let status_ts = new Date()
    if (params.timestamp) {
      status_ts = new Date(params.timestamp)
    }
    let data = {
      cb_id: ocppid,
      conn_id: params.connectorId,
      stat: params.status,
      stat_ts: Math.floor(status_ts.getTime() / 1000),
      ec: params.errorCode,
      ei: params.info || null,
      vei: params.vendorId || null,
      vec: params.errorCode || null
    }
    // Execution
    try {
      let stmt = this.db.prepare(query)
      let res = stmt.run(data)
      return res
    } catch (err) {
      this.log.warn('updConnectorStatus: ' + err)
      return undefined
    }
  }
  async getChargeBoxAuthMode(ocppid) {
    try {
      let stmt = this.db.prepare('SELECT cb_mode FROM charge_box WHERE cb_id=?')
      let res = stmt.get(ocppid)
      if (res.cb_mode === 0) {
        return true
      }
      return false
    } catch(err) {
      this.log.warn('getChargeBoxAuthMode: ' + err)
      return false
    }
  }
  async setChargeBoxConfigKeys(ocppid, config) {
    try {
      // Statement
      let stmt = this.db.prepare('INSERT INTO charge_box_conf (' +
        'cb_id, key, value, readonly) VALUES '+
        '(@id, @key, @value, @readonly) ' +
        'ON CONFLICT(cb_id,key) DO UPDATE SET ' +
        'value=excluded.value, readonly=excluded.readonly'
      )
      // Transaction
      let insertAll = this.db.transaction((keys) => {
        for (const k of keys) {
          stmt.run({
            id: ocppid, key: k.key, value: k.value,
            readonly: k.readonly === true ? 1 : 0
          })
        }
      })
      // Execute
      insertAll.immediate(config.configurationKey)
    } catch (err) {
      this.log.warn('setChargeBoxConfigKeys: ' + err)
      return { error: new Error(`${err}`)}
    }
    return { status: 'Updated'}
  }
  async updMeterValues(params) {
    try {
      let stmt = this.db.prepare('UPDATE connector_status SET energy=@energy WHERE cb_id=@cbid AND connector_id=@cnid')
      stmt.run(params)
      return true
    } catch(err) {
      this.log.warn('updMeterValues: ' + err)
      return false
    }
  }
  async updTransactionMeterValues(params) {
    try {
      let stmt = this.db.prepare('UPDATE transactions SET energy=@energy-meterStart, power=@power WHERE t_pk=@tpk')
      stmt.run(params)
      return true
    } catch(err) {
      this.log.warn('updTransactionMeterValues: ' + err)
      return false
    }
  }
  /* Autorize & Transaction */
  async getAuthorizeResponse(ocppid, idTag) {
   let query = 'SELECT CB.expire, CB.blocked FROM charge_box_rfids AS CB ' +
   'LEFT JOIN rfid_tags AS RF ON (CB.rf_pk = RF.rf_pk) WHERE CB.cb_id=? AND RF.idtag=?'
   try {
    let stmt = this.db.prepare(query)
    let res = stmt.get(ocppid,idTag)
    // Date now
    let now = Math.floor(Date.now() / 1000)
    if (res === undefined) {
      return { status: 'Invalid' }
    } else if (res.blocked === 1) {
      return { status: 'Blocked' }
    } else if (res.expire !== null && res.expire < now) {
      return { status: 'Expired' }
    } else {
      // TODO SET REAL EXPIRY IF NECESSARY
      let expiry = new Date(Date.now() + 86400000).toISOString()
      return { status: 'Accepted', expiryDate: expiry }
    }
   } catch(err) {
    this.log.warn('getAuthorizeResponse: ' + err)
    return { status: 'Invalid' }
   }
  }
  async generateTransactionId() {
    // Year-Day
    let today = new Date()
    let daynum = ((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(today.getFullYear(), 0, 0)) / 86400000)
    let ydstr = today.getUTCFullYear().toString().slice(-2) + ('000' + daynum).slice(-3)
    // Query
    try {
      let stmt = this.db.prepare('SELECT MAX(t_pk) AS max FROM transactions WHERE t_pk > ?')
      let res = stmt.get(ydstr)
      // No Value
      if (res.max === null) {
        return parseInt(ydstr + '0001')
      } else {
        return (parseInt(res.max) + 1)
      }
    } catch(err) {
      this.log.warn('generateTransactionId: ' + err)
      return false
    }
  }
  async addTransaction(params) {
    let query = 'INSERT INTO transactions (t_pk,cb_id,con_id,IdToken,meterStart,tsStart,status) ' +
    'VALUES (@tpk,@ocppid,@conid,@idtag,@meter,@start,@status)'
    try {
      let stmt = this.db.prepare(query)
      stmt.run(params)
      return true
    } catch(err) {
      this.log.warn('addTransaction: ' + err)
      return false
   }
  }
  async stopTransaction(params) {
    let query = 'UPDATE transactions SET meterStop=@meter, tsStop=@stop, ' +
    'reason=@reason, energy=@meter-meterStart, power=@power WHERE t_pk=@tpk'
    try {
      let stmt = this.db.prepare(query)
      stmt.run(params)
      return true
    } catch(err) {
      this.log.warn('stopTransaction: ' + err)
      return false
    }
  }
  /* WEBUI - RFIDS Tags */
  async getAllRfidTags() {
    let query = 'SELECT owner, idtag, infos FROM rfid_tags ORDER BY owner, idtag'
    try {
      let stmt = this.db.prepare(query)
      let res = stmt.all()
      return res
    } catch(err) {
      this.log.warn('getAllRfidTags: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  async getUserRfidTags(userid) {
    let query = 'SELECT owner, idtag, infos FROM rfid_tags WHERE owner=? ORDER BY infos'
    try {
      let stmt = this.db.prepare(query).bind(userid)
      let res = stmt.all()
      return res
    } catch(err) {
      this.log.warn('getUserRfidTags: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  /* WEBUI - Request Charger DATA */
  async getAllChargers() {
    let query = 'SELECT CB.cb_pk, CB.cb_id, CB.cb_name, CB.registration_status, CB.online, SI.s_name ' +
      'FROM charge_box CB LEFT JOIN sites SI on SI.s_pk = CB.site ' +
      'ORDER BY s_name, cb_name'
    try {
      const stmt = this.db.prepare(query)
      const res = stmt.all()
      return res
    } catch (err) {
      this.log.warn('getAllChargers: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  async getUserChargeBox(userid) {
    try {
      const stmt = this.db.prepare('SELECT * FROM charge_box WHERE owner=? ORDER BY cb_id').bind(userid)
      const res = stmt.all()
      return res
    } catch (err) {
      this.log.warn('getUserChargeBox: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  async getChargeBoxByName(ocppid) {
    try {
      const stmt = this.db.prepare('SELECT * FROM charge_box WHERE cb_id = ?')
      const res = stmt.get(ocppid)
      return res
    } catch (err) {
      this.log.warn('getChargeBoxByName: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  async getChargeBoxConnectors(ocppid) {
    try {
      const stmt = this.db.prepare('SELECT * FROM connector_status WHERE cb_id = ? AND connector_id > 0')
      const res = stmt.all(ocppid)
      return res
    } catch (err) {
      this.log.warn('getChargeBoxConnectors: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  async getChargeBoxBootInfo(ocppid) {
    try {
      const stmt = this.db.prepare('SELECT * FROM charge_box_infos WHERE cb_id = ?')
      const res = stmt.get(ocppid)
      return res
    } catch (err) {
      this.log.warn('getChargeBoxBootInfo: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  async setChargeBoxConfigKey(params) {
    try {
      let stmt = this.db.prepare('UPDATE charge_box_conf SET ' +
        'value=@value WHERE cb_id = @ocppName AND key = @key')
      let res = stmt.run(params)
      return res
    } catch(err) {
      this.log.warn('setChargeBoxConfigKey: ' + err)
      return { error: new Error(`${err}`)}
    }
  }
  async getChargeBoxConfigKeys(ocppid) {
    try {
    let stmt = this.db.prepare('SELECT key, value, readonly FROM charge_box_conf WHERE cb_id = ?')
    const res = stmt.all(ocppid)
    return res
    } catch (err) {
      this.log.warn('getChargeBoxConfigKeys: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  async usrUpdChargeBoxInfos(params) {
    try {
      let stmt = this.db.prepare('UPDATE charge_box ' +
        'SET cb_name=@name, cb_pwd=@pwd, cb_mode=@mode ' +
        'WHERE cb_id=@id')
      let res = stmt.run(params)
      return res
    } catch(err) {
      this.log.warn('usrUpdChargeBoxInfos: ' + err)
      return { error: new Error(`${err}`)}
    }
  }
  /* WEBUI - Request Charger DATA Ajax */
  async getChargeBoxLogs(params) {
    let query = 'SELECT * FROM charge_box_log WHERE cb_id = ? AND timestamp BETWEEN ? AND ? ORDER BY log_pk DESC, type ASC'
    let stop = (parseInt(params.start) + 86400000)
    try {
      let stmt = this.db.prepare(query)
      let res = stmt.all(params.ocppName, params.start, stop)
      return res
    } catch (err) {
      this.log.warn('getChargeBoxLogs: ' + err)
      return { error: new Error(`${err}`) } // TODO requete ajax ne prends pas l'erreur
    }
  }
  /* WEBUI - Admin */
  async AdminAddChargeBox(params) {
    /* By Admin form */
    let query = 'INSERT INTO charge_box (cb_id,cb_name,cb_pwd,registration_status,site) VALUES (@id,@name,@pwd,@regstatus,@site)'
    let data = {
      id : params.ocppid,
      name: params.cbname,
      pwd: params.cbpwd || null,
      regstatus: params.regstatus,
      site: params.cbsite
    }
    try {
      let stmt = this.db.prepare(query)
      let res = stmt.run(data)
      return res
    } catch (err) {
      this.log.warn('AutoAddChargeBox: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  async updChargeBox(params) {
    let query = 'UPDATE charge_box SET cb_id=@id, cb_name=@name, cb_pwd=@pwd, registration_status=@regstatus, site=@site WHERE cb_pk=@cbpk'
    let data = {
      cbpk: params.cbpk,
      id: params.ocppid,
      name: params.cbname,
      pwd: params.cbpwd || null,
      regstatus: params.regstatus,
      site: params.cbsite
    }
    try {
      let stmt = this.db.prepare(query)
      let res = stmt.run(data)
      return res
    } catch (err) {
      this.log.warn('updChargeBox: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  async delChargeBox(params) {
    try {
      let stmt = this.db.prepare('DELETE FROM charge_box WHERE `cb_pk`=@cbpk')
      let res = stmt.run(params)
      return res
    } catch (err) {
      this.log.warn('delChargeBox: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  async getChargeBoxInfosById(cbpk) {
    let query = 'SELECT cb_pk, cb_id, cb_name, cb_pwd, registration_status, site ' +
      'FROM charge_box WHERE cb_pk=?'
    try {
      const stmt = this.db.prepare(query).bind(cbpk)
      const res = stmt.get()
      return res
    } catch (err) {
      this.log.warn('getChargeBoxInfosById: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  /* WEBUI - Admin OCPP Default Config */
  async getOcppDefaultConf() {
    try {
      let stmt = this.db.prepare('SELECT * FROM ocpp_default_conf ORDER BY enabled DESC, key ASC')
      let res = stmt.all()
      return res
    } catch(err) {
      this.log.warn('getOcppDefaultConf: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  async updOcppDefaultConf(params) {
    try {
      let stmt = this.db.prepare('UPDATE ocpp_default_conf SET value=@value, enabled=@enabled WHERE cfg_pk=@cfg_pk')
      let res = stmt.run(params)
      return res
    } catch(err) {
      this.log.warn('updOcppDefaultConf: ' + err)
      return { error: new Error(`${err}`) }
    }
  }




  /* CLOSE FUNCTIONS */
  async setAllChargeBoxOffline() {
    try {
      const info = this.db.prepare('UPDATE charge_box SET online = 0 WHERE online = 1').run()
      this.log.debug('setAllChargeBoxOffline: ' + info.changes + ' set offline')
    } catch(err) {
      this.log.warn('setAllChargeBoxOffline: ' + err)
    }
  }
  async closeDB() {
    await this.setAllChargeBoxOffline()
    this.db.close()
    this.log.log('Database closed')
  }
}