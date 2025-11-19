/* eslint-disable no-undef */
import Database from 'better-sqlite3'
import fs from 'fs'
import { Log } from 'debug-level'
import utils from '../helpers/utils.js'

export default new class sqlite {
  constructor () {
    this.db
    this.log
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
          console.log(err.code + ': ' + err.message)
          console.log('PLEASE DELETE /datas/ocpp-csms.db BEFORE RETRY')
          process.exit(1)
        }
      }
    })
    // Ouverture DB
    await utils.sleep(1)
    //this.db = new Database(dbFile, { verbose: this.log.debug })
    this.db = new Database(dbFile)
    // Migration needed ?
    try {
      const dbversion = this.db.prepare('SELECT `version` FROM `schema_version` WHERE `schema_pk`=1').pluck().get()
      if (utils.appVersion() != dbversion) {
        this.log.log('Migration de la base de données en cours...', utils.appVersion(), dbversion)
      }
    } catch(err) {
      this.log.fatal(err.code + ': ' + err.message)
      process.exit(1)
    }
    // Initialisation ok
    this.log.log('Database ready')
  }
  /* WEBUI - USERS LOGIN */
  getUserCredentials(usermail) {
    // Passport login
    try {
      const stmt = this.db.prepare('SELECT `user_pk`,`usermail`,`password`,`name`,`isAdmin`,`ownedSite` FROM `users` WHERE `usermail`=?')
      const res = stmt.get(usermail)
      return res
    } catch (err) {
      this.log.warn(err.message)
      return undefined
    }
  }
  getUserInfosById(uid) {
    // Passport deserialize => reprends champs de getUserCredentials
    try {
      const stmt = this.db.prepare('SELECT * FROM `users` WHERE `user_pk`=?')
      const res = stmt.get(uid)
      return res
    } catch (err) {
      this.log.warn(err.message)
      return undefined
    }
  }
  /* WEBUI - SITES - Admin Only */
  async getAllSites() {
    const query = 'SELECT `s_pk`,`s_name`,`s_address`,`s_codp`,`s_ville` FROM `sites` ORDER BY `s_name`'
    return await this.sqliteAll('getAllSites', query, null, true)
  }
  async addSite(params) {
    const query = 'INSERT INTO `sites` (`s_name`,`s_address`,`s_codp`,`s_ville`) VALUES ' +
      '(@name,@address,@codp,@ville)'
    return await this.sqliteRun('addSite', query, params, true)
  }
  async getSiteInfosById(sid) {
    const query = 'SELECT * FROM `sites` WHERE `s_pk`=?'
    return await this.sqliteGet('getSiteInfosById', query, sid, true)
  }
  async updSite(params) {
    const query = 'UPDATE `sites` SET `s_name`=@name,`s_address`=@address,`s_codp`=@codp,' +
      '`s_ville`=@ville WHERE `s_pk`=@sid'
    return await this.sqliteRun('updSite', query, params, true)
  }
  async delSite(params) {
    const query = 'DELETE FROM `sites` WHERE `s_pk`=@sid'
    return await this.sqliteRun('delSite', query, params, true)
  }
  /* WEBUI - USERS - Admin Only */
  async getAllUsers() {
    const query = 'SELECT `U`.`user_pk`,`U`.`name`,`U`.`usermail`,`U`.`isAdmin`,`U`.`ownedSite`,`S`.`s_name`,' +
      '(SELECT COUNT(`pk`) FROM `sites_users` WHERE `upk`=`U`.`user_pk`) AS `nbSites` ' +
      'FROM `users` `U` LEFT JOIN `sites` `S` ON (`U`.`ownedSite`=`S`.`s_pk`)'
    return await this.sqliteAll('getAllUsers', query, null, true)
  }
  async getAllSiteUsers(sid) {
    const query = 'SELECT NULL AS `pk`, `U`.`user_pk`,`U`.`name`,`U`.`usermail` FROM `users` `U` ' +
      'WHERE `U`.`ownedSite`=@siteid ' +
      'UNION ' +
      'SELECT `S`.`pk`,`S`.`upk`,`S`.`uname`,`U`.`usermail` FROM `sites_users` `S` ' +
      'LEFT JOIN `users` `U` ON (`S`.`upk`=`U`.`user_pk`) WHERE `S`.`spk`=@siteid ' +
      'ORDER BY `name` ASC'
    const params = { siteid: sid }
    return await this.sqliteAll('getSiteUsers', query, params, true)
  }
  async updUser(params) {
    let query = 'UPDATE `users` SET `usermail`=@umail,`name`=@uname,`isAdmin`=@admin,`ownedSite`=@owner'
    if (params.upass) {
      query = query + ', `password`=@upass'
    }
    query = query + ' WHERE `user_pk`=@uid'
    return await this.sqliteRun('updUser', query, params, true)
  }
  async delUser(params) {
    const query = 'DELETE FROM `users` WHERE `user_pk`=@uid'
    return await this.sqliteRun('delUser', query, params, true)
  }
  // Special
  async getNbAdmins() {
    try {
      let stmt = this.db.prepare('SELECT COUNT(`user_pk`) AS `nbadmin` FROM `users` WHERE `isAdmin`=1')
      let res = stmt.get()
      return res.nbadmin
    } catch (err) {
      this.log.warn('getNbAdmins: ' + err)
      return { error: new Error(`${err}`) }
    }
  }  /* WEBUI - USERS - Owner Only */
  async getSiteUsers(sid) {
    const query = 'SELECT `S`.`pk`,`S`.`upk`,`S`.`uname`,`U`.`usermail` FROM `sites_users` `S` ' +
      'LEFT JOIN `users` `U` ON (`S`.`upk`=`U`.`user_pk`) WHERE `S`.`spk`=?'
    return await this.sqliteAll('getSiteUsers', query, sid, true)
  }
  async getUserSiteUserById(params) {
    const query = 'SELECT `SU`.`pk`,`SU`.`uname`,`U`.`usermail` FROM `sites_users` `SU` ' +
      'LEFT JOIN `users` `U` ON (`SU`.`upk`=`U`.`user_pk`) ' +
      'WHERE `SU`.`pk`=@pk AND `SU`.`spk`=@spk'
    return await this.sqliteGet('getUserSiteUserById', query, params, true)
  }
  async updSiteUser(params) {
    const query = 'UPDATE `sites_users` SET `uname`=@uname WHERE `pk`=@pk AND `spk`=@spk'
    return await this.sqliteRun('updSiteUser', query, params, true)
  }
  async getUserIdByMail(umail) {
    const query = 'SELECT `user_pk`,`isAdmin` FROM `users` WHERE `usermail`=?'
    return await this.sqliteGet('getUserIdByMail', query, umail, true)
  }
  async addSiteUser(params) {
    const query = 'INSERT INTO `sites_users` (`spk`,`upk`,`uname`) VALUES (@spk,@upk,@uname)'
    return await this.sqliteRun('addSiteUser', query, params, true)
  }
  async delSiteUser(params) {
    const query = 'DELETE FROM `sites_users` WHERE `pk`=@pk AND `spk`=@spk'
    return await this.sqliteRun('delSiteUser', query, params, true)
  }
  /* WEBUI - USERS - Admin & Owner Only */
  async addUser(params) {
    const query = 'INSERT INTO `users` (`usermail`,`password`,`name`,`isAdmin`,`ownedSite`) VALUES ' +
      '(@umail,@upass,@uname,@admin,@owner)'
    return await this.sqliteRun('addUser', query, params, true)
  }
  /* WEBUI - USERS - Self update */
  async updUserSelf(params) {
    let query = 'UPDATE `users` SET `name`=@uname'
    if (params.upass) {
      query = query + ',`password`=@upass'
    }
    query = query + ' WHERE `user_pk`=@uid'
    return await this.sqliteRun('updUserSelf', query, params, true)
  }
  /* WEBUI - RFIDS Tags - Admin Only */
  async getAllRfidTags() {
    const query = 'SELECT `RF`.`rf_pk`,`RF`.`idtag`,`RF`.`rf_name`,`RF`.`expire`,`RF`.`blocked`,`SI`.`s_name` ' +
      'FROM `rfid_tags` `RF` LEFT JOIN `sites` `SI` on `SI`.`s_pk` = `RF`.`site` ' +
      'ORDER BY `SI`.`s_name`, `RF`.`idtag`'
    return await this.sqliteAll('getAllRfidTags', query, null, true)
  }
  /* WEBUI - RFIDS Tags - Owner Only */
  async getSiteRfidTags(sid) {
    const query = 'SELECT `RF`.`rf_pk`,`RF`.`idtag`,`RF`.`rf_name`,`RF`.`user`,`RF`.`expire`,`RF`.`blocked`,`SU`.`uname` ' +
      'FROM `rfid_tags` `RF` LEFT JOIN `sites_users` `SU` ON (`RF`.`user`=`SU`.`upk`) ' +
      'WHERE `RF`.`site`=? ORDER BY `RF`.`idtag`'
    return await this.sqliteAll('getSiteRfidTags', query, sid, true)
  }
  /* WEBUI - RFIDS - Admin & Owner Only */
  async getRfidTagInfosById(params) {
    let query = 'SELECT `rf_pk`,`idtag`,`rf_name`,`user`,`expire`,`blocked`,`site` ' +
      'FROM `rfid_tags` WHERE `rf_pk`=@rf_pk'
    // Requête depuis Owner
    if (params.sid) {
      query = query + ' AND `site`=@sid'
    }
    return await this.sqliteGet('getRfidTagInfosById', query, params, true)
  }
  async addRfidTag(params) {
    const query = 'INSERT INTO `rfid_tags` (`site`,`idtag`,`rf_name`,`user`,`expire`,`blocked`) ' +
      'VALUES (@site,@idtag,@rf_name,@user,@expire,@blocked)'
    return await this.sqliteRun('addRfidTag', query, params, true)
  }
  async updRfidTag(params) {
    let query = ''
    if (params.isAdmin) {
      query = 'UPDATE `rfid_tags` SET `site`=@site,`idtag`=@idtag,`rf_name`=@rf_name,`user`=@user,`expire`=@expire,' +
        '`blocked`=@blocked WHERE `rf_pk`=@rf_pk'
    } else {
      query = 'UPDATE `rfid_tags` SET `idtag`=@idtag,`rf_name`=@rf_name,`user`=@user,`expire`=@expire,`blocked`=@blocked' +
        ' WHERE `rf_pk`=@rf_pk AND `site`=@site'
    }
    return await this.sqliteRun('updRfidTag', query, params, true)
  }
  async delRfidTag(params) {
    let query = ''
    if (params.isAdmin) {
      query = 'DELETE FROM `rfid_tags` WHERE `rf_pk`=@rf_pk'
    } else {
      query = 'DELETE FROM `rfid_tags` WHERE `rf_pk`=@rf_pk AND `site`=@site'
    }
    return await this.sqliteRun('delRfidTag', query, params, true)
  }
  /* WEBUI - Admin OCPP Default Config */
  async getOcppDefaultConf() {
    const query = 'SELECT * FROM `ocpp_default_conf` ORDER BY `enabled` DESC, `key` ASC'
    return await this.sqliteAll('getOcppDefaultConf', query, null, true)
  }
  async updOcppDefaultConf(params) {
    const query = 'UPDATE `ocpp_default_conf` SET `value`=@value, `enabled`=@enabled WHERE `cfg_pk`=@cfg_pk'
    return await this.sqliteRun('updOcppDefaultConf', query, params, true)
  }
  /* WEBUI - STATIONS List - Admin & Owner Only */
  async getAllStations(sid=null) {
    let query = ''
    if (sid) {
      query = 'SELECT `cb`.`cb_pk`,`cb`.`cb_id`,`cb`.`cb_name`,`cb`.`registration_status`,`cb`.`online`, ' +
        '(SELECT COUNT(`pk`) FROM `connector_status` WHERE `cb_pk`= `cb`.`cb_pk`) AS `nbcon` ' +
        'FROM `charge_box` `cb` WHERE `cb`.`site`=' + sid + ' ORDER BY `cb`.`cb_name`'
    } else {
      query = 'SELECT `cb`.`cb_pk`, `cb`.`cb_id`, `cb`.`cb_name`, `cb`.`registration_status`, `cb`.`online`, `si`.`s_name`, ' +
        '(SELECT COUNT(`pk`) FROM `connector_status` WHERE `cb_pk`= `cb`.`cb_pk`) AS `nbcon` ' +
        'FROM `charge_box` `cb` LEFT JOIN `sites` `si` ON(`si`.`s_pk`=`cb`.`site`) ' +
        'ORDER BY `si`.`s_name`, `cb`.`cb_name`'
    }
    return await this.sqliteAll('getAllStations', query, null, true)
  }
  /* WEBUI - STATIONS - Admin Only */
  async addStation(params) {
    /* By Admin form */
    const query = 'INSERT INTO `charge_box` (`cb_id`,`cb_name`,`cb_pwd`,`registration_status`,`site`) VALUES (@id,@name,@pwd,@regstatus,@site)'
    const data = {
      id : params.ocppid,
      name: params.cbname,
      pwd: params.cbpwd || null,
      regstatus: params.regstatus,
      site: params.cbsite
    }
    return await this.sqliteRun('addStation', query, data, true)
  }
  async getStationInfosById(cbpk) {
    const query = 'SELECT `cb_pk`,`cb_id`,`cb_name`,`cb_pwd`,`registration_status`,`site` ' +
      'FROM `charge_box` WHERE `cb_pk`=?'
    return await this.sqliteGet('getStationInfosById', query, cbpk, true)
  }
  async updStation(params) {
    const query = 'UPDATE `charge_box` SET `cb_id`=@id,`cb_name`=@name,`cb_pwd`=@pwd,`registration_status`=@regstatus,`site`=@site WHERE `cb_pk`=@cbpk'
    const data = {
      cbpk: params.cbpk,
      id: params.ocppid,
      name: params.cbname,
      pwd: params.cbpwd || null,
      regstatus: params.regstatus,
      site: params.cbsite
    }
    return await this.sqliteRun('updStation', query, data, true)
  }
  async delStation(params) {
    const query = 'DELETE FROM `charge_box` WHERE `cb_pk`=@cbpk'
    return await this.sqliteRun('delStation', query, params, true)
  }
  async getChargeBoxConfigKeys(ocppid) {
    const query = 'SELECT `cc`.`key`,`cc`.`value`,`cc`.`readonly` FROM `charge_box_conf` `cc` ' +
      'LEFT JOIN `charge_box` `cb` ON(`cb`.`cb_pk`=`cc`.`cb_pk`) WHERE `cb`.`cb_id` = ?'
    return await this.sqliteAll('getChargeBoxConfigKeys', query, ocppid, true)
  }
  /* WEBUI - CHARGER - Admin & Owner Only */
  async getChargeBoxByName(ocppid, sid=null) {
    let query = ''
    if (sid === null) {
      query = 'SELECT * FROM `charge_box` WHERE `cb_id`=?'
    } else {
      query = 'SELECT * FROM `charge_box` WHERE `site`=' + sid + ' AND `cb_id`=?'
    }
    return await this.sqliteGet('getChargeBoxByName', query, ocppid, true)
  }
  async getChargeBoxBootInfo(ocppid, sid=null) {
    let query = ''
    if (sid === null) {
      query = 'SELECT `ci`.* FROM `charge_box_infos` `ci` LEFT JOIN `charge_box` `cb` ON(`cb`.`cb_pk`=`ci`.`cb_pk`) WHERE `cb`.`cb_id`=?'
    } else {
      query = 'SELECT `ci`.* FROM `charge_box_infos` `ci` LEFT JOIN `charge_box` `cb` ON(`cb`.`cb_pk`=`ci`.`cb_pk`) WHERE `cb`.`site`=' + sid + ' AND `cb`.`cb_id`=?'
    }
    return await this.sqliteGet('getChargeBoxBootInfo', query, ocppid, true)
  }
  async updChargeBoxNameMode(params, sid=null) {
    let query = ''
    if (sid===null) {
      query = 'UPDATE `charge_box` SET `cb_name`=@name, `cb_mode`=@mode WHERE `cb_id`=@id'
    } else {
      query = 'UPDATE `charge_box` SET `cb_name`=@name, `cb_mode`=@mode WHERE `site`=' + sid + ' AND cb_id=@id'
    }
    return await this.sqliteRun('updChargeBoxNameMode', query, params, true)
  }
  // Special
  async isOwnerOfChargeBox(ocppid, sid) {
    const query = 'SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=? AND `site`=?'
    try {
      const stmt = this.db.prepare(query)
      const res = stmt.get(ocppid, sid)
      if (res) {
        return true
      }
      return false
    } catch (err) {
      this.log.warn('isOwnerOfChargeBox: ' + err)
      return false
    }
  }
  async getChargeBoxConnectors(ocppid, sid=null) {
    let query = ''
    if (sid === null) {
      query = 'SELECT `cs`.* FROM `connector_status` `cs` LEFT JOIN `charge_box` `cb` ON(`cs`.`cb_pk`=`cb`.`cb_pk`) WHERE `cb`.`cb_id`=?'
    } else {
      query = 'SELECT `cs`.* FROM `connector_status` `cs` LEFT JOIN `charge_box` `cb` ON(`cs`.`cb_pk`=`cb`.`cb_pk`) ' +
        'WHERE `cb`.`site`=' + sid + ' AND `cb`.`cb_id`=?'
    }
    return await this.sqliteAll('getChargeBoxConnectors', query, ocppid, true)
  }
  async getChargeBoxConsLastTransac(ocppid, sid=null) {
    let query = ''
    if (sid === null) {
      query = 'WITH tempt AS (SELECT `t`.*,`cb`.`online`,`rf`.`rf_name`,`u`.`name` AS `uname`,`u`.`usermail`,' +
        'ROW_NUMBER() OVER(PARTITION BY `con_pk` ORDER BY `t_pk` DESC) AS `nc` ' +
        'FROM `transactions` `t` ' +
        'LEFT JOIN `connector_status` `cs` ON (`t`.`con_pk`=`cs`.`pk`) ' +
        'LEFT JOIN `charge_box` `cb` ON (`cs`.`cb_pk`=`cb`.`cb_pk`) ' +
        'LEFT JOIN `rfid_tags` `rf` ON (`t`.`IdToken`=`rf`.`idtag`) ' +
        'LEFT JOIN `users` `u` ON (`rf`.`user`=`u`.`user_pk`) ' +
        'WHERE `cb`.`cb_id`=?) ' +
        'SELECT * FROM `tempt` WHERE `nc`=1'
    } else {
      query = 'WITH tempt AS (SELECT `t`.*,`cb`.`online`,`rf`.`rf_name`,`su`.`uname`,`u`.`usermail`,' +
        'ROW_NUMBER() OVER(PARTITION BY `con_pk` ORDER BY `t_pk` DESC) AS `nc` ' +
        'FROM `transactions` `t` ' +
        'LEFT JOIN `connector_status` `cs` ON (`t`.`con_pk`=`cs`.`pk`) ' +
        'LEFT JOIN `charge_box` `cb` ON (`cs`.`cb_pk`=`cb`.`cb_pk`) ' +
        'LEFT JOIN `rfid_tags` `rf` ON (`t`.`IdToken`=`rf`.`idtag`) ' +
        'LEFT JOIN `sites_users` `su` ON (`rf`.`user`=`su`.`upk` AND `su`.`spk`=' + sid + ') ' +
        'LEFT JOIN `users` `u` ON (`rf`.`user`=`u`.`user_pk`) ' +
        'WHERE `cb`.`site`=' + sid + ' AND `cb`.`cb_id`=?) ' +
        'SELECT * FROM `tempt` WHERE `nc`=1'
    }
    return await this.sqliteAll('getChargeBoxConsLastTransac', query, ocppid, true)
  }
  async updConnectorPerso(params) {
    let query = ''
    if (params.sid===null) {
      query = 'UPDATE `connector_status` SET `cname`=@cname,`maxPower`=@cmax,`format`=@cfor,`type`=@ctyp ' +
        'WHERE `cb_pk`=(SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@cbid) AND `connector_id`=@cid'
    } else {
      query = 'UPDATE `connector_status` SET `cname`=@cname,`maxPower`=@cmax,`format`=@cfor,`type`=@ctyp ' +
        'WHERE (SELECT `site` FROM `charge_box` WHERE `cb_id`=@cbid)=@sid ' +
        'AND `cb_pk`=(SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@cbid) AND `connector_id`=@cid'
    }
    return await this.sqliteRun('updConnectorPerso', query, params, true)
  }
  /* WEBUI - AJAX */
  async ajaxGetStationsStatus(sid=null) {
    let query = ''
    if (sid) {
      query = 'SELECT `cb_pk`,`registration_status`,`online`, ' +
        '(SELECT COUNT(`pk`) FROM `connector_status` WHERE `cb_pk`=`cb_pk`) AS `nbcon` ' +
        'FROM `charge_box` `cb` WHERE `site`=' + sid
    } else {
      query = 'SELECT `cb`.`cb_pk`,`cb`.`registration_status`,`cb`.`online`, ' +
        '(SELECT COUNT(`pk`) FROM `connector_status` WHERE `cb_pk`=`cb`.`cb_pk`) AS `nbcon` ' +
        'FROM `charge_box` `cb`'
    }
    try {
      const stmt = this.db.prepare(query)
      const res = stmt.all()
      return res
    } catch (err) {
      this.log.warn('ajaxGetStationsStatus: ' + err)
      return { error: `${err}` }
    }
  }
  async ajaxGetChargeurStatus(ocppid, sid=null) {
    let query = ''
    if (sid === null) {
      query = 'SELECT `online`,`last_heartbeat_ts`,`last_bootnotif_ts` FROM `charge_box` WHERE `cb_id`=?'
    } else {
      query = 'SELECT `online`,`last_heartbeat_ts`,`last_bootnotif_ts` FROM `charge_box` WHERE `site`=' + sid + ' AND `cb_id`=?'
    }
    try {
      const stmt = this.db.prepare(query)
      const res = stmt.get(ocppid)
      return res
    } catch (err) {
      this.log.warn('ajaxGetChargeurStatus: ' + err)
      return { error: `${err}` }
    }
  }
  async ajaxGetChargeurConnsStatus(ocppid, sid=null) {
    let query = ''
    if (sid === null) {
      query = 'SELECT `cs`.`pk`,`cs`.`connector_id`,`cs`.`status`,`cs`.`status_ts`,`cs`.`energy`,`cb`.`online` FROM `connector_status` `cs` ' +
      'LEFT JOIN `charge_box` `cb` ON(`cb`.`cb_pk`=`cs`.`cb_pk`) WHERE `cb`.`cb_id`=?'
    } else {
      query = 'SELECT `cs`.`pk`,`cs`.`connector_id`,`cs`.`status`,`cs`.`status_ts`,`cs`.`energy`,`cb`.`online` FROM `connector_status` `cs` ' +
        'LEFT JOIN `charge_box` `cb` ON(`cb`.`cb_pk`=`cs`.`cb_pk`) ' +
        'WHERE `cb`.`site`=' + sid + ' AND `cb`.`cb_id`=?'
    }
    try {
      const stmt = this.db.prepare(query)
      const res = stmt.all(ocppid)
      return res
    } catch (err) {
      this.log.warn('ajaxGetChargeurConnsStatus: ' + err)
      return { error: `${err}` }
    }
  }
  async ajaxgetChargeBoxLogs(params) {
    let query = 'SELECT `cl`.* FROM `charge_box_log` `cl` ' +
    'LEFT JOIN `charge_box` `cb` ON(`cl`.`cb_pk`=`cb`.`cb_pk`)' +
    'WHERE `cb`.`cb_id`=? AND `cl`.`timestamp` BETWEEN ? AND ? ORDER BY `cl`.`timestamp` DESC'
    try {
      let stmt = this.db.prepare(query)
      let res = stmt.all(params.ocppName, params.start, params.stop)
      return res
    } catch (err) {
      this.log.warn('ajaxgetChargeBoxLogs: ' + err)
      return { error:`${err}` }
    }
  }
  /* WEBUI - Report */
  async getTransacGraphData(params) {
    const query = 'SELECT TIME(data_ts, \'unixepoch\') AS x, ROUND(CAST(energy AS real)/1000, 3) AS energy, ' +
      'ROUND(CAST(power AS real)/1000, 1) AS power ' +
      'FROM transactions_data WHERE t_pk=@tpk'
    return await this.sqliteAll('getTransacGraphData', query, params, true)
  }
  /* WEBUI - DASHBOARD ADMIN & Owners */
  async getDashboardCBStatus(sid=null) {
    let query = 'SELECT SUM(CASE WHEN `online`=1 THEN 1 ELSE 0 END) as `online`,' +
      'SUM(CASE WHEN `online`=0 THEN 1 ELSE 0 END) as `offline` ' +
      'FROM `charge_box`'
    if (sid) {
      query = query + ' WHERE `site`=' + sid
    }
    return await this.sqliteGet('getDashboardCBStatus', query, null, true)
  }
  async getDashboardConnStatus(sid=null) {
    let query = ''
    if (sid) {
      query = 'SELECT TOTAL(CASE WHEN `CS`.`status`=\'Available\' THEN 1 ELSE 0 END) as `available`,' +
        'TOTAL(CASE WHEN `CS`.`status`=\'Unavailable\' THEN 1 ELSE 0 END) as `unavailable`, ' +
        'TOTAL(CASE WHEN `CS`.`status`=\'Charging\' THEN 1 ELSE 0 END) as `charging`, ' +
        'TOTAL(CASE WHEN `CS`.`status`=\'Faulted\' THEN 1 ELSE 0 END) as `faulted`, ' +
        'TOTAL(CASE WHEN `CS`.`status` NOT IN (\'Available\',\'Unavailable\',\'Charging\',\'Faulted\') THEN 1 ELSE 0 END) as `occupied` ' +
        'FROM `connector_status` `CS` LEFT JOIN `charge_box` `CB` ON (`CS`.`cb_pk`=`CB`.`cb_pk`) ' +
        'WHERE `CB`.`site`=' + sid + ' AND `CB`.`online`=1'
    } else {
      query = 'SELECT TOTAL(CASE WHEN `CS`.`status`=\'Available\' THEN 1 ELSE 0 END) as `available`,' +
        'TOTAL(CASE WHEN `CS`.`status`=\'Unavailable\' THEN 1 ELSE 0 END) as `unavailable`, ' +
        'TOTAL(CASE WHEN `CS`.`status`=\'Charging\' THEN 1 ELSE 0 END) as `charging`, ' +
        'TOTAL(CASE WHEN `CS`.`status`=\'Faulted\' THEN 1 ELSE 0 END) as `faulted`, ' +
        'TOTAL(CASE WHEN `CS`.`status` NOT IN (\'Available\',\'Unavailable\',\'Charging\',\'Faulted\') THEN 1 ELSE 0 END) as `occupied` ' +
        'FROM `connector_status` `CS` LEFT JOIN `charge_box` `CB` ON (`CS`.`cb_pk`=`CB`.`cb_pk`) ' +
        'WHERE `CB`.`online`=1'
    }
    return await this.sqliteGet('getDashboardConnStatus', query, null, true)
  }
  async getDashboardSiteCbConnTransac(sid=null) {
    let query = ''
    if (sid) {
      query = 'WITH tempt AS (' +
        'SELECT ROW_NUMBER() OVER(PARTITION BY COALESCE(`T`.`con_pk`,CONCAT(`SI`.`s_pk`,\'-\',COALESCE(`CB`.`cb_pk`,0))) ORDER BY `T`.`t_pk` DESC) AS `nc`,' +
        '`SI`.`s_pk`,`SI`.`s_name`,`CB`.`cb_pk`,`CB`.`cb_name`,`CB`.`online`,`CB`.`cb_id`,' +
        '`CS`.`pk`,`CS`.`status`,`CS`.`connector_id`,`CS`.`cname`,' +
        '`T`.`t_pk`,`T`.`tsStart`,`T`.`tsStop`,`T`.`tsEnergy`,`T`.`tsPower`,`T`.`tsReason` ' +
        'FROM `sites` `SI` ' +
        'LEFT JOIN `charge_box` `CB` ON(`CB`.`site`=`SI`.`s_pk`) ' +
        'LEFT JOIN `connector_status` `CS` ON(`CS`.`cb_pk`=`CB`.`cb_pk`) ' +
        'LEFT JOIN `transactions` `T` ON(`T`.`con_pk`=`CS`.`pk`) ' +
        ') ' +
        'SELECT * FROM `tempt` WHERE `s_pk`=' + sid +' AND `nc`=1'
      } else {
        query = 'WITH tempt AS (' +
          'SELECT ROW_NUMBER() OVER(PARTITION BY COALESCE(`T`.`con_pk`,CONCAT(`SI`.`s_pk`,\'-\',COALESCE(`CB`.`cb_pk`,0))) ORDER BY `T`.`t_pk` DESC) AS `nc`,' +
          '`SI`.`s_pk`,`SI`.`s_name`,`CB`.`cb_pk`,`CB`.`cb_name`,`CB`.`online`,`CB`.`cb_id`,' +
          '`CS`.`pk`,`CS`.`status`,`CS`.`connector_id`,`CS`.`cname`,' +
          '`T`.`t_pk`,`T`.`tsStart`,`T`.`tsStop`,`T`.`tsEnergy`,`T`.`tsPower`,`T`.`tsReason` ' +
          'FROM `sites` `SI` ' +
          'LEFT JOIN `charge_box` `CB` ON(`CB`.`site`=`SI`.`s_pk`) ' +
          'LEFT JOIN `connector_status` `CS` ON(`CS`.`cb_pk`=`CB`.`cb_pk`) ' +
          'LEFT JOIN `transactions` `T` ON(`T`.`con_pk`=`CS`.`pk`) ' +
          ') ' +
          'SELECT * FROM `tempt` WHERE `nc`=1'
    }
    return await this.sqliteAll('getDashboardSiteCbConnTransac', query, null, true)
  }
  /* CSMS - Chargebox base function (online/auth/reg status) */
  getCBAuth(ocppid) {
    ocppid = ocppid.replace(/[!@#$%^&*]/g, '')
    try {
      let stmt = this.db.prepare('SELECT `cb_pwd` FROM `charge_box` WHERE `cb_id`=?')
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
      let stmt = this.db.prepare('SELECT `registration_status` FROM `charge_box` WHERE `cb_id`=?')
      let res = stmt.get(ocppid)
      return res // Values or undefined
    } catch (err) {
      this.log.warn('getCBRegStatus: ' + err)
      return undefined
    }
  }
  async setChargeBoxOnOffLine(ocppid, status) {
    try {
      const stmt = this.db.prepare('UPDATE `charge_box` SET `online`=? WHERE `cb_id`=?')
      const info = stmt.run(status, ocppid)
      this.log.debug('setChargeBoxOnOffLine: ' + info.changes + ' updated')
    } catch (err) {
      this.log.warn('setChargeBoxOnOffLine: ' + err)
    }
  }
  /* CSMS - Chargebox default OCPP Config */
  async getOcppDefaultConfig() {
    try {
      let stmt = this.db.prepare('SELECT `key`,`value` FROM `ocpp_default_conf` WHERE `enabled`=1 ORDER BY `key` ASC')
      let res = stmt.all()
      return res
    } catch(err) {
      this.log.warn('getOcppDefaultConfig: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  async setCBDefaultOcppKey(params) {
    let stmt = this.db.prepare('INSERT INTO `charge_box_conf`(`cb_pk`,`key`,`value`,`readonly`) VALUES '+
      '((SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@id), @key, @value, @readonly) ' +
      'ON CONFLICT(`cb_pk`,`key`) DO UPDATE SET `value`=excluded.value, `readonly`=excluded.readonly'
    )
    try {
      let res = stmt.run(params)
      return res
    } catch (err) {
      this.log.warn('setCBDefaultOcppKe: ' + err)
      return { error: new Error(`${err}`) }
    }
  }
  /* CSMS - AutoAdd or PendingAdd */
  async AutoAddChargeBox(params) {
    /* Pendings & Autoadd params */
    let query = 'INSERT INTO `charge_box` (`cb_id`,`cb_name`,`registration_status`) VALUES (@id,@name,@regstatus)'
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
  /* CSMS - client.handle() */
  updChargeBoxBootNotif(client, params) {
    let query = 'INSERT INTO `charge_box_infos` ' +
    '(`cb_pk`,`endpoint_address`,`ocpp_protocol`,`cp_vendor`,`cp_model`,`cp_serial_number`,' +
    '`cb_serial_number`,`fw_version`,`iccid`,`imsi`,`meter_type`,`meter_serial_number`) VALUES ' +
    '((SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@id),@ea,@proto,@cpv,@cpm,@cpsn,@cbsn,@fwv,@iccid,@imsi,@mtyp,@mtsn) ' +
    'ON CONFLICT(`cb_pk`) DO UPDATE SET ' +
    '`endpoint_address`=excluded.endpoint_address,`ocpp_protocol`=excluded.ocpp_protocol,`cp_vendor`=excluded.cp_vendor,' +
    '`cp_model`=excluded.cp_model,`cp_serial_number`=excluded.cp_serial_number,`cb_serial_number`=excluded.cb_serial_number,' +
    '`fw_version`=excluded.fw_version,`iccid`=excluded.iccid,`imsi`=excluded.imsi,`meter_type`=excluded.meter_type,' +
    '`meter_serial_number`=excluded.meter_serial_number WHERE `cb_pk`=(SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@id)'
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
  updLastBoot(ocppid) {
    let hb_ts = Math.floor(Date.now() / 1000)
    try {
      let stmt = this.db.prepare('UPDATE `charge_box` SET `last_bootnotif_ts`=? WHERE `cb_id`=?')
      let res = stmt.run(hb_ts, ocppid)
      return res
    } catch (err) {
      this.log.warn('updHeartBeat: ' + err)
      return undefined
    }
  }
  updHeartBeat(ocppid) {
    let hb_ts = Math.floor(Date.now() / 1000)
    try {
      let stmt = this.db.prepare('UPDATE `charge_box` SET `last_heartbeat_ts`=? WHERE `cb_id`=?')
      let res = stmt.run(hb_ts, ocppid)
      return res
    } catch (err) {
      this.log.warn('updHeartBeat: ' + err)
      return undefined
    }
  }
  updConnectorStatus(ocppid, params) {
    let queryS = 'SELECT `pk` FROM `connector_status` WHERE ' +
      '`cb_pk`=(SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@cb_id) AND `connector_id`=@conn_id'
    // Update Query
    let queryU = 'UPDATE `connector_status` SET `status`=@stat,`status_ts`=@stat_ts,`error_code`=@ec,`error_info`=@ei,' +
      '`vendor_id`=@vei,`vendor_error_code`=@vec WHERE `pk`=?'
    // Insert Query
    let queryI = 'INSERT INTO `connector_status` ' +
      '(`cb_pk`,`connector_id`,`status`,`status_ts`,`error_code`,`error_info`,`vendor_id`,`vendor_error_code`) ' +
      'VALUES ((SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@cb_id),@conn_id,@stat,@stat_ts,@ec,@ei,@vei,@vec)'
    // Affect Datas
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
    // FIRST : Exists ?
    try {
      let stmt1 = this.db.prepare(queryS)
      let res1 = stmt1.get(data)
      // res1 === undefined => Insert
      if (res1 === undefined) {
        try {
          let stmtI = this.db.prepare(queryI)
          let resI = stmtI.run(data)
          return resI
        } catch (err) {
          this.log.warn('updConnectorStatus #Insert: ' + err)
          return undefined
        }
      // res1 !== undefined => Update
      } else {
        try {
          let stmtU = this.db.prepare(queryU)
          let resU = stmtU.run(res1.pk, data)
          return resU
        } catch (err) {
          this.log.warn('updConnectorStatus #Update: ' + err)
          return undefined
        }
      }
    } catch (err) {
      this.log.warn('updConnectorStatus #1: ' + err)
      return undefined
    }
  }
  async updMeterValues(params) {
    try {
      let stmt = this.db.prepare('UPDATE `connector_status` SET `energy`=@energy WHERE ' +
        '`cb_pk`=(SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@cbid) AND `connector_id`=@cnid')
      stmt.run(params)
      return true
    } catch(err) {
      this.log.warn('updMeterValues: ' + err)
      return false
    }
  }
  async updTransactionMeterValues(params) {
    try {
      let stmt = this.db.prepare('UPDATE `transactions` SET `tsEnergy`=@energy-`meterStart`, `tsPower`=@power WHERE `t_pk`=@tpk')
      stmt.run(params)
      return true
    } catch(err) {
      this.log.warn('updTransactionMeterValues: ' + err)
      return false
    }
  }
  addToLog(params) {
    // Query
    let stmt = this.db.prepare('INSERT INTO `charge_box_log` (`cb_pk`,`timestamp`,`direction`,`type`,`method`,`message`) ' +
    'VALUES ((SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@ocppid), @ts, @direction, @type, @methode, @message)')
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
  /* CSMS - client.GetConfiguration */
  async setChargeBoxConfigKeys(ocppid, config) {
    try {
      // Statement
      let stmt = this.db.prepare('INSERT INTO `charge_box_conf` (' +
        '`cb_pk`,`key`,`value`,`readonly`) VALUES '+
        '((SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@id),@key,@value,@readonly) ' +
        'ON CONFLICT(`cb_pk`,`key`) DO UPDATE SET ' +
        '`value`=excluded.value,`readonly`=excluded.readonly'
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
  /* CSMS - Update OCPP config by Admin in WEBUI */
  async updChargeBoxConfigKey(params) {
    const query = 'UPDATE `charge_box_conf` SET `value`=@value ' +
      'WHERE `cb_pk`=(SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@ocppName) AND `key`=@key'
    return await this.sqliteRun('updChargeBoxConfigKey', query, params)
  }
  /* CSMS - Autorize & Transaction */
  async generateTransactionId() {
    // Year-Day
    let today = new Date()
    let daynum = ((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(today.getFullYear(), 0, 0)) / 86400000)
    let ydstr = today.getUTCFullYear().toString().slice(-2) + ('000' + daynum).slice(-3)
    // Query
    try {
      let stmt = this.db.prepare('SELECT MAX(`t_pk`) AS `max` FROM `transactions` WHERE `t_pk` > ?')
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
    try {
      /* Select Con_PK */
      let query = 'SELECT `pk` FROM `connector_status` WHERE `connector_id`=@conid AND '+
        '`cb_pk`=(SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@ocppid)'
      const stmtpk = this.db.prepare(query)
      const con_data = stmtpk.get(params)
      if (con_data === undefined) {
        return false
      }
      try {
        let query = 'INSERT INTO `transactions` (`t_pk`,`con_pk`,`IdToken`,`meterStart`,`tsStart`,`tsStatus`) ' +
          'VALUES (@tpk,' + con_data.pk + ',@idtag,@meter,@start,@status)'
        let stmt = this.db.prepare(query)
        stmt.run(params)
        return true
      } catch(err) {
        this.log.warn('addTransaction #2: ' + err)
        return false
      }
    } catch(err) {
      this.log.warn('addTransaction #1: ' + err)
      return false
   }
  }
  async initTransactionData(params) {
    const query = 'INSERT INTO `transactions_data` (`t_pk`,`data_ts`,`energy`) VALUES (@tpk,@ts,0)'
    return await this.sqliteRun('initTransactionData', query, params)
  }
  async addTransactionData(params) {
    const query = 'INSERT INTO `transactions_data` (`t_pk`,`data_ts`,`power`,`energy`) ' +
      'VALUES (@tpk,@ts,@power,@energy-(SELECT `meterStart` FROM `transactions` WHERE `t_pk`=@tpk))'
    return await this.sqliteRun('addTransactionData', query, params)
  }
  async stopTransaction(params) {
    const query = 'UPDATE `transactions` SET `meterStop`=@meter,`tsStop`=@stop,' +
    '`tsReason`=@reason,`tsEnergy`=@meter-`meterStart`,`tsPower`=@power WHERE `t_pk`=@tpk'
    return await this.sqliteRun('stopTransaction', query, params)
  }
/* CSMS - Autostart by OCPP / Charger Mode */
  async isChargerAutoOCPP(ocppid) {
    let stmt = this.db.prepare('SELECT `cb_mode` FROM `charge_box` WHERE `cb_id`=?')
    try {
      let res = stmt.get(ocppid)
      if (res.cb_mode === 0) {
        return true
      }
      return false
    } catch(err) {
      this.log.warn('isChargerAutoOCPP: ' + err)
      return false
    }
  }
  async isChargerAutonomous(ocppid) {
    let stmt = this.db.prepare('SELECT `cb_mode` FROM `charge_box` WHERE `cb_id`=?')
    try {
      let res = stmt.get(ocppid)
      if (res.cb_mode === 2) {
        return true
      }
      return false
    } catch(err) {
      this.log.warn('isChargerAutonomous: ' + err)
      return false
    }
  }
  /* Autorize & Transaction */
  async getAuthorizeResponse(ocppid, idTag) {
    const query = 'SELECT `RT`.`blocked`, `RT`.`expire` FROM `rfid_tags` AS `RT` ' +
      'LEFT JOIN `charge_box` `CB` ON (`RT`.`site`=`CB`.`site`) ' +
      'WHERE (`CB`.`cb_id`=? OR `RT`.`site` IS NULL) AND `RT`.`idtag`=?'
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
        let expiry
        if (res.expire !== null) {
          expiry = new Date(res.expire * 1000).toISOString()
        } else {
          expiry = new Date(Date.now() + 86400000).toISOString()
        }
        return { status: 'Accepted', expiryDate: expiry }
      }
    } catch(err) {
      this.log.warn('getAuthorizeResponse: ' + err)
      return { status: 'Invalid' }
    }
  }
  /* GLOBAL FUNCTIONS */
  /* ALL - only on statements that return data */
  /* Array of data / empty array / Error */
  async sqliteAll(funcname, query, params=null, forUi=false) {
    try {
      const stmt = this.db.prepare(query)
      if (params) {
        stmt.bind(params)
      }
      const res = stmt.all()
      return res
    } catch(err) {
      this.log.warn(funcname + ': ' + err)
      if (forUi) {
        return { error: new Error(`${err}`) }
      }
      return false
    }
  }
  /* GET - only on statements that return data */
  /* Object of data / undefined / Error */
  async sqliteGet(funcname, query, params=null, forUi=false) {
    try {
      const stmt = this.db.prepare(query)
      if (params) {
        stmt.bind(params)
      }
      const res = stmt.get()
      return res
    } catch(err) {
      this.log.warn(funcname + ': ' + err)
      if (forUi) {
        return { error: new Error(`${err}`) }
      }
      return false
    }
  }
  /* RUN - Insert / Update / Delete */
  /* info={changes:0,lastInsertRowid:0} / Error */
  async sqliteRun(funcname, query, params=null, forUi=false) {
    try {
      const stmt = this.db.prepare(query)
      if (params) {
        stmt.bind(params)
      }
      const res = stmt.run()
      return res
    } catch(err) {
      this.log.warn(funcname + ': ' + err)
      if (forUi) {
        return { error: new Error(`${err}`) }
      }
      return false
    }
  }
  /* CLOSE FUNCTIONS */
  async setAllChargeBoxOffline() {
    try {
      const info = this.db.prepare('UPDATE `charge_box` SET `online`=0 WHERE `online`=1').run()
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
  /* Here is line : 1184 - 931 */
}