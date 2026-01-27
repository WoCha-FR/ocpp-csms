import Database from 'better-sqlite3'
import { map } from 'extra-promise'
import { findMigrationFilenames, readMigrationFile } from 'migration-files'
import { migrate } from '@blackglory/better-sqlite3-migrations'
import fs from 'fs'
import { Log } from 'debug-level'
import utils from '../helpers/utils.js'

export default new (class sqlite {
  constructor() {
    this.db
    this.log
  }

  async initDB() {
    // Logger
    this.log = new Log('sqlite', { level: utils.config().sqlite.loglvl })
    // Path of DB
    const dbFile = utils.rootdir() + '/datas/ocpp-csms.db'
    const sqlPath = utils.rootdir() + '/lib/datas/schemas/'
    // Create DB if needed
    fs.stat(dbFile, async function (err) {
      // Fichier inconnu
      if (err && err.code === 'ENOENT') {
        // Create DB
        const tempDB = new Database(dbFile)
        // Create structure
        const struct = fs.readFileSync(sqlPath + 'initial.sql', { encoding: 'utf8', flag: 'r' })
        try {
          tempDB.exec(struct)
          tempDB.close()
          // eslint-disable-next-line no-unused-vars
        } catch (err) {
          // eslint-disable-next-line no-undef
          console.log('PLEASE DELETE /datas/ocpp-csms.db BEFORE RETRY')
          // eslint-disable-next-line no-undef
          process.exit(1)
        }
      }
    })
    // Ouverture DB
    await utils.sleep(1)
    this.db = new Database(dbFile, { fileMustExist: true })
    // Migration needed ?
    try {
      const migrationFilenames = await findMigrationFilenames(sqlPath)
      const migrations = await map(migrationFilenames, readMigrationFile)
      migrate(this.db, migrations)
    } catch (err) {
      this.log.fatal(err.code + ': ' + err.message)
      // eslint-disable-next-line no-undef
      process.exit(1)
    }
    // Initialisation ok
    this.log.log('Database ready')
  }
  /* WEBUI - USERS LOGIN */
  getUserCredentials(usermail) {
    // Passport login
    const query =
      'SELECT `user_pk`,`usermail`,`password`,`name`,`isAdmin`,`ownedSite` ' +
      'FROM `users` WHERE `usermail`=?'
    try {
      const stmt = this.db.prepare(query)
      const res = stmt.get(usermail)
      return res
    } catch (err) {
      this.log.warn(err.message)
      return undefined
    }
  }
  getUserGoogleCredentials(gglid) {
    const query =
      'SELECT `user_pk`,`usermail`,`password`,`name`,`isAdmin`,`ownedSite` ' +
      'FROM `users` WHERE `gglid`=?'
    try {
      const stmt = this.db.prepare(query)
      const res = stmt.get(gglid)
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
  setGoogleId(uid, google_id) {
    const query = 'UPDATE `users` SET `gglid`=? WHERE `user_pk`=?'
    try {
      const stmt = this.db.prepare(query)
      const res = stmt.run(google_id, uid)
      return res
    } catch (err) {
      this.log.warn(err.message)
      return { error: new Error(`${err}`) }
    }
  }
  /* WEBUI - SITES - Admin Only */
  async getAllSites() {
    const query =
      'SELECT `s_pk`,`s_name`,`s_address`,`s_codp`,`s_ville` FROM `sites` ORDER BY `s_name`'
    return await this.sqliteAll('getAllSites', query, null, true)
  }
  async addSite(params) {
    const query =
      'INSERT INTO `sites` (`s_name`,`s_address`,`s_codp`,`s_ville`) VALUES ' +
      '(@name,@address,@codp,@ville)'
    return await this.sqliteRun('addSite', query, params, true)
  }
  async addSiteIdToken(sid) {
    const query =
      "INSERT INTO `rfid_tags` (`idtag`,`site`,`rf_name`,`isparent`) VALUES (CONCAT('SADM',HEX(RANDOMBLOB(6))),?,'SITEADMIN',1)"
    return await this.sqliteRun('addSiteIdToken', query, sid, true)
  }
  async getSiteInfosById(sid) {
    const query = 'SELECT * FROM `sites` WHERE `s_pk`=?'
    return await this.sqliteGet('getSiteInfosById', query, sid, true)
  }
  async updSite(params) {
    const query =
      'UPDATE `sites` SET `s_name`=@name,`s_address`=@address,`s_codp`=@codp,' +
      '`s_ville`=@ville WHERE `s_pk`=@sid'
    return await this.sqliteRun('updSite', query, params, true)
  }
  async delSite(params) {
    const query = 'DELETE FROM `sites` WHERE `s_pk`=@sid'
    return await this.sqliteRun('delSite', query, params, true)
  }
  /* WEBUI - USERS - Admin Only */
  async getAllUsers() {
    const query =
      'SELECT `U`.`user_pk`,`U`.`name`,`U`.`usermail`,`U`.`isAdmin`,`U`.`ownedSite`,`S`.`s_name`,' +
      '(SELECT COUNT(`pk`) FROM `sites_users` WHERE `upk`=`U`.`user_pk`) AS `nbSites` ' +
      'FROM `users` `U` LEFT JOIN `sites` `S` ON (`U`.`ownedSite`=`S`.`s_pk`)'
    return await this.sqliteAll('getAllUsers', query, null, true)
  }
  async getAllSiteUsers(sid) {
    const query =
      'SELECT NULL AS `pk`, `U`.`user_pk`,`U`.`name`,`U`.`usermail` FROM `users` `U` ' +
      'WHERE `U`.`ownedSite`=@siteid ' +
      'UNION ' +
      'SELECT `S`.`pk`,`S`.`upk`,`S`.`uname`,`U`.`usermail` FROM `sites_users` `S` ' +
      'LEFT JOIN `users` `U` ON (`S`.`upk`=`U`.`user_pk`) WHERE `S`.`spk`=@siteid ' +
      'ORDER BY `name` ASC'
    const params = { siteid: sid }
    return await this.sqliteAll('getSiteUsers', query, params, true)
  }
  async getSitesOfUserById(uid) {
    const query =
      'SELECT `SU`.`pk`,`SI`.`s_name` FROM `sites_users` `SU` ' +
      'LEFT JOIN `sites` `SI` ON(`SU`.`spk`=`SI`.`s_pk`) ' +
      'WHERE `SU`.`upk`=? ORDER BY `SI`.`s_name`'
    return await this.sqliteAll('getSitesOfUserById', query, uid, true)
  }
  async updUser(params) {
    let query =
      'UPDATE `users` SET `usermail`=@umail,`name`=@uname,`isAdmin`=@admin,`ownedSite`=@owner'
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
  async delUserInSitesTable(uid) {
    const query = 'DELETE FROM `sites_users` WHERE `upk`=?'
    return await this.sqliteRun('delUserInSitesTable', query, uid, true)
  }
  async delSiteUserAdmin(params) {
    const query = 'DELETE FROM `sites_users` WHERE `pk`=@elemId'
    return await this.sqliteRun('delSiteUserAdmin', query, params, true)
  }
  // Special
  async getNbAdmins() {
    try {
      let stmt = this.db.prepare(
        'SELECT COUNT(`user_pk`) AS `nbadmin` FROM `users` WHERE `isAdmin`=1'
      )
      let res = stmt.get()
      return res.nbadmin
    } catch (err) {
      this.log.warn('getNbAdmins: ' + err)
      return { error: new Error(`${err}`) }
    }
  } /* WEBUI - USERS - Owner Only */
  async getSiteUsers(sid) {
    const query =
      'SELECT `S`.`pk`,`S`.`upk`,`S`.`uname`,`U`.`usermail` FROM `sites_users` `S` ' +
      'LEFT JOIN `users` `U` ON (`S`.`upk`=`U`.`user_pk`) WHERE `S`.`spk`=?'
    return await this.sqliteAll('getSiteUsers', query, sid, true)
  }
  async getUserSiteUserById(params) {
    const query =
      'SELECT `SU`.`pk`,`SU`.`uname`,`U`.`usermail` FROM `sites_users` `SU` ' +
      'LEFT JOIN `users` `U` ON (`SU`.`upk`=`U`.`user_pk`) ' +
      'WHERE `SU`.`pk`=@pk AND `SU`.`spk`=@spk'
    return await this.sqliteGet('getUserSiteUserById', query, params, true)
  }
  async updSiteUser(params) {
    const query = 'UPDATE `sites_users` SET `uname`=@uname WHERE `pk`=@pk AND `spk`=@spk'
    return await this.sqliteRun('updSiteUser', query, params, true)
  }
  async getUserIdByMail(params) {
    const query = 'SELECT `user_pk` FROM `users` WHERE `usermail`=@usermail'
    return await this.sqliteGet('getUserIdByMail', query, params, true)
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
    const query =
      'INSERT INTO `users` (`usermail`,`password`,`name`,`isAdmin`,`ownedSite`,`idtag`) VALUES ' +
      "(@umail,@upass,@uname,@admin,@owner,CONCAT('WUSR',HEX(RANDOMBLOB(6))))"
    const result = await this.sqliteRun('addUser', query, params, true)
    if (!result.error) {
      const newUserId = result.lastInsertRowid
      const query2 = 'INSERT INTO `user_notifs` (`user_pk`) VALUES (@uid)'
      return await this.sqliteRun('addUser-Notifs', query2, { uid: newUserId }, true)
    } else {
      return result
    }
  }
  /* WEBUI - RFIDS Tags - Admin Only */
  async getAllRfidTags() {
    const query =
      'SELECT `RF`.`rf_pk`,`RF`.`idtag`,`RF`.`rf_name`,`RF`.`expire`,`RF`.`blocked`,`SI`.`s_name` ' +
      'FROM `rfid_tags` `RF` LEFT JOIN `sites` `SI` on `SI`.`s_pk` = `RF`.`site` ' +
      'WHERE `RF`.`isparent`=0 ORDER BY `SI`.`s_name`, `RF`.`idtag`'
    return await this.sqliteAll('getAllRfidTags', query, null, true)
  }
  /* WEBUI - RFIDS Tags - Owner Only */
  async getSiteRfidTags(sid) {
    const query =
      'SELECT `RF`.`rf_pk`,`RF`.`idtag`,`RF`.`rf_name`,`RF`.`user`,`RF`.`expire`,`RF`.`blocked`,`SU`.`uname` ' +
      'FROM `rfid_tags` `RF` LEFT JOIN `sites_users` `SU` ON (`RF`.`user`=`SU`.`upk`) ' +
      'WHERE `RF`.`site`=? AND `RF`.`isparent`=0 ORDER BY `RF`.`idtag`'
    return await this.sqliteAll('getSiteRfidTags', query, sid, true)
  }
  /* WEBUI - RFIDS - Admin & Owner Only */
  async getRfidTagInfosById(params) {
    let query =
      'SELECT `rf_pk`,`idtag`,`rf_name`,`user`,`expire`,`blocked`,`site` ' +
      'FROM `rfid_tags` WHERE `rf_pk`=@rf_pk AND `isparent`=0'
    // Requête depuis Owner
    if (params.sid) {
      query = query + ' AND `site`=@sid'
    }
    return await this.sqliteGet('getRfidTagInfosById', query, params, true)
  }
  async addRfidTag(params) {
    const query =
      'INSERT INTO `rfid_tags` (`site`,`idtag`,`rf_name`,`user`,`expire`,`blocked`) ' +
      'VALUES (@site,@idtag,@rf_name,@user,@expire,@blocked)'
    return await this.sqliteRun('addRfidTag', query, params, true)
  }
  async updRfidTag(params) {
    let query = ''
    if (params.isAdmin) {
      query =
        'UPDATE `rfid_tags` SET `site`=@site,`idtag`=@idtag,`rf_name`=@rf_name,`user`=@user,`expire`=@expire,' +
        '`blocked`=@blocked WHERE `rf_pk`=@rf_pk'
    } else {
      query =
        'UPDATE `rfid_tags` SET `idtag`=@idtag,`rf_name`=@rf_name,`user`=@user,`expire`=@expire,`blocked`=@blocked' +
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
    const query =
      'UPDATE `ocpp_default_conf` SET `value`=@value, `enabled`=@enabled WHERE `cfg_pk`=@cfg_pk'
    return await this.sqliteRun('updOcppDefaultConf', query, params, true)
  }
  /* WEBUI - STATIONS List - Admin & Owner Only */
  async getAllStations(sid = null) {
    let query = ''
    if (sid) {
      query =
        'SELECT `cb`.`cb_pk`,`cb`.`cb_id`,`cb`.`cb_name`,`cb`.`registration_status`,`cb`.`online`,' +
        '`cb`.`cb_mode`,(SELECT COUNT(`pk`) FROM `connector_status` WHERE `cb_pk`= `cb`.`cb_pk`) AS `nbcon` ' +
        'FROM `charge_box` `cb` WHERE `cb`.`site`=' +
        sid +
        ' ORDER BY `cb`.`cb_name`'
    } else {
      query =
        'SELECT `cb`.`cb_pk`, `cb`.`cb_id`, `cb`.`cb_name`, `cb`.`registration_status`, `cb`.`online`, `si`.`s_name`,' +
        '`cb`.`cb_mode`,(SELECT COUNT(`pk`) FROM `connector_status` WHERE `cb_pk`= `cb`.`cb_pk`) AS `nbcon` ' +
        'FROM `charge_box` `cb` LEFT JOIN `sites` `si` ON(`si`.`s_pk`=`cb`.`site`) ' +
        'ORDER BY `si`.`s_name`, `cb`.`cb_name`'
    }
    return await this.sqliteAll('getAllStations', query, null, true)
  }
  /* WEBUI - STATIONS - Admin Only */
  async addStation(params) {
    /* By Admin form */
    const query =
      'INSERT INTO `charge_box` (`cb_id`,`cb_name`,`cb_pwd`,`registration_status`,`site`) VALUES (@id,@name,@pwd,@regstatus,@site)'
    const data = {
      id: params.ocppid,
      name: params.cbname,
      pwd: params.cbpwd || null,
      regstatus: params.regstatus,
      site: params.cbsite,
    }
    return await this.sqliteRun('addStation', query, data, true)
  }
  async getStationInfosById(cbpk) {
    const query =
      'SELECT `cb_pk`,`cb_id`,`cb_name`,`cb_pwd`,`registration_status`,`site` ' +
      'FROM `charge_box` WHERE `cb_pk`=?'
    return await this.sqliteGet('getStationInfosById', query, cbpk, true)
  }
  async updStation(params) {
    const query =
      'UPDATE `charge_box` SET `cb_id`=@id,`cb_name`=@name,`cb_pwd`=@pwd,`registration_status`=@regstatus,`site`=@site WHERE `cb_pk`=@cbpk'
    const data = {
      cbpk: params.cbpk,
      id: params.ocppid,
      name: params.cbname,
      pwd: params.cbpwd || null,
      regstatus: params.regstatus,
      site: params.cbsite,
    }
    return await this.sqliteRun('updStation', query, data, true)
  }
  async delStation(params) {
    const query = 'DELETE FROM `charge_box` WHERE `cb_pk`=@cbpk'
    return await this.sqliteRun('delStation', query, params, true)
  }
  async getChargeBoxConfigKeys(ocppid) {
    const query =
      'SELECT `cc`.`key`,`cc`.`value`,`cc`.`readonly` FROM `charge_box_conf` `cc` ' +
      'LEFT JOIN `charge_box` `cb` ON(`cb`.`cb_pk`=`cc`.`cb_pk`) WHERE `cb`.`cb_id` = ?'
    return await this.sqliteAll('getChargeBoxConfigKeys', query, ocppid, true)
  }
  /* WEBUI - CHARGER - Admin & Owner Only */
  async getChargeBoxByName(ocppid, sid = null) {
    let query = ''
    if (sid === null) {
      query = 'SELECT * FROM `charge_box` WHERE `cb_id`=?'
    } else {
      query = 'SELECT * FROM `charge_box` WHERE `site`=' + sid + ' AND `cb_id`=?'
    }
    return await this.sqliteGet('getChargeBoxByName', query, ocppid, true)
  }
  async getChargeBoxBootInfo(ocppid, sid = null) {
    let query = ''
    if (sid === null) {
      query =
        'SELECT `ci`.* FROM `charge_box_infos` `ci` LEFT JOIN `charge_box` `cb` ON(`cb`.`cb_pk`=`ci`.`cb_pk`) WHERE `cb`.`cb_id`=?'
    } else {
      query =
        'SELECT `ci`.* FROM `charge_box_infos` `ci` LEFT JOIN `charge_box` `cb` ON(`cb`.`cb_pk`=`ci`.`cb_pk`) WHERE `cb`.`site`=' +
        sid +
        ' AND `cb`.`cb_id`=?'
    }
    return await this.sqliteGet('getChargeBoxBootInfo', query, ocppid, true)
  }
  async updChargeBoxNameMode(params, sid = null) {
    let query = ''
    if (sid === null) {
      query = 'UPDATE `charge_box` SET `cb_name`=@name, `cb_mode`=@mode WHERE `cb_id`=@id'
    } else {
      query =
        'UPDATE `charge_box` SET `cb_name`=@name, `cb_mode`=@mode WHERE `site`=' +
        sid +
        ' AND cb_id=@id'
    }
    return await this.sqliteRun('updChargeBoxNameMode', query, params, true)
  }
  // Get SuperAdmin or SiteAdmin IDTAG for web remote start
  async getOwnerOrAdminIdTag(sid) {
    let query = ''
    if (sid === null) {
      query = 'SELECT `idtag` FROM `rfid_tags` WHERE `site` IS NULL AND `isparent`=1'
    } else {
      query = 'SELECT `idtag` FROM `rfid_tags` WHERE `site`=' + sid + ' AND `isparent`=1'
    }
    return await this.sqliteGet('getOwnerOrAdminIdTag', query, null, true)
  }
  // Get User IdTag for for web remote start
  async getUserIdTag(params) {
    const query =
      'SELECT `U`.`idtag` ' +
      'FROM `sites_users` `SU` ' +
      'LEFT JOIN `users` `U` ON (`U`.`user_pk`=`SU`.`upk`) ' +
      'LEFT JOIN `charge_box` `CB` ON(`CB`.`site`=`SU`.`spk`) ' +
      'WHERE `CB`.`cb_id`=@cbid AND `SU`.`upk`=@uid'
    return await this.sqliteGet('getUserIdTag', query, params, true)
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
  // Special
  async isUserOfChargeBox(ocppid, uid) {
    const query =
      'SELECT `SU`.`uname` FROM `sites_users` `SU` ' +
      'LEFT JOIN `charge_box` `CB` ON(`CB`.`site`=`SU`.`spk`)' +
      'WHERE `CB`.`cb_id`=? AND `SU`.`upk`=?'
    try {
      const stmt = this.db.prepare(query)
      const res = stmt.get(ocppid, uid)
      if (res) {
        return true
      }
      return false
    } catch (err) {
      this.log.warn('isUserOfChargeBox: ' + err)
      return false
    }
  }

  async getChargeBoxConnectors(ocppid, sid = null) {
    let query = ''
    if (sid === null) {
      query =
        'SELECT `cs`.* FROM `connector_status` `cs` LEFT JOIN `charge_box` `cb` ON(`cs`.`cb_pk`=`cb`.`cb_pk`) WHERE `cb`.`cb_id`=?'
    } else {
      query =
        'SELECT `cs`.* FROM `connector_status` `cs` LEFT JOIN `charge_box` `cb` ON(`cs`.`cb_pk`=`cb`.`cb_pk`) ' +
        'WHERE `cb`.`site`=' +
        sid +
        ' AND `cb`.`cb_id`=?'
    }
    return await this.sqliteAll('getChargeBoxConnectors', query, ocppid, true)
  }
  async getChargeBoxConsLastTransac(ocppid, sid = null) {
    let query = ''
    if (sid === null) {
      query =
        'WITH tempt AS (SELECT `t`.*,`cb`.`online`,`rf`.`rf_name`,`u`.`name` AS `uname`,`u`.`usermail`,' +
        "ROW_NUMBER() OVER(PARTITION BY COALESCE(`t`.`con_pk`,CONCAT(COALESCE(`CB`.`cb_pk`,0),'-',COALESCE(`CS`.`connector_id`,0))) ORDER BY `t`.`t_pk` DESC) AS `nc` " +
        'FROM `transactions` `t` ' +
        'LEFT JOIN `connector_status` `cs` ON (`t`.`con_pk`=`cs`.`pk`) ' +
        'LEFT JOIN `charge_box` `cb` ON (`cs`.`cb_pk`=`cb`.`cb_pk`) ' +
        'LEFT JOIN `rfid_tags` `rf` ON (`t`.`IdToken`=`rf`.`idtag`) ' +
        'LEFT JOIN `users` `u` ON (`rf`.`user`=`u`.`user_pk`) ' +
        'WHERE `cb`.`cb_id`=?) ' +
        'SELECT * FROM `tempt` WHERE `nc`=1'
    } else {
      query =
        'WITH tempt AS (SELECT `t`.*,`cb`.`online`,`rf`.`rf_name`,`su`.`uname`,`u`.`usermail`,' +
        "ROW_NUMBER() OVER(PARTITION BY COALESCE(`t`.`con_pk`,CONCAT(COALESCE(`CB`.`cb_pk`,0),'-',COALESCE(`CS`.`connector_id`,0))) ORDER BY `t`.`t_pk` DESC) AS `nc` " +
        'FROM `transactions` `t` ' +
        'LEFT JOIN `connector_status` `cs` ON (`t`.`con_pk`=`cs`.`pk`) ' +
        'LEFT JOIN `charge_box` `cb` ON (`cs`.`cb_pk`=`cb`.`cb_pk`) ' +
        'LEFT JOIN `rfid_tags` `rf` ON (`t`.`IdToken`=`rf`.`idtag`) ' +
        'LEFT JOIN `sites_users` `su` ON (`rf`.`user`=`su`.`upk` AND `su`.`spk`=' +
        sid +
        ') ' +
        'LEFT JOIN `users` `u` ON (`rf`.`user`=`u`.`user_pk`) ' +
        'WHERE `cb`.`site`=' +
        sid +
        ' AND `cb`.`cb_id`=?) ' +
        'SELECT * FROM `tempt` WHERE `nc`=1'
    }
    return await this.sqliteAll('getChargeBoxConsLastTransac', query, ocppid, true)
  }
  async getChargeBoxConsAndLastTransac(ocppid, sid = null) {
    let query = ''
    if (sid === null) {
      query =
        'WITH tempt AS (SELECT `cs`.*,`rf`.`rf_name`,`u`.`name` AS `uname`,`u`.`usermail`,' +
        '`t`.`t_pk`,`t`.`tsStart`,`t`.`tsStop`,`t`.`tsEnergy`,`t`.`tsPower`,`t`.`tsReason`,' +
        "ROW_NUMBER() OVER(PARTITION BY COALESCE(`T`.`con_pk`,CONCAT(COALESCE(`CB`.`cb_pk`,0),'-',COALESCE(`CS`.`connector_id`,0))) ORDER BY `T`.`t_pk` DESC) AS `nc` " +
        'FROM `charge_box` `cb` ' +
        'LEFT JOIN `connector_status` `cs` ON (`cs`.`cb_pk`=`cb`.`cb_pk`) ' +
        'LEFT JOIN `transactions` `t` ON(`t`.`con_pk`=`cs`.`pk`) ' +
        'LEFT JOIN `rfid_tags` `rf` ON (`t`.`IdToken`=`rf`.`idtag`) ' +
        'LEFT JOIN `users` `u` ON (`rf`.`user`=`u`.`user_pk`) ' +
        'WHERE `cb`.`cb_id`=?) ' +
        'SELECT * FROM `tempt` WHERE `nc`=1  ORDER BY `connector_id`'
    } else {
      query =
        'WITH tempt AS (SELECT `cs`.*,`rf`.`rf_name`,`su`.`uname`,`u`.`usermail`,' +
        '`t`.`t_pk`,`t`.`tsStart`,`t`.`tsStop`,`t`.`tsEnergy`,`t`.`tsPower`,`t`.`tsReason`,' +
        "ROW_NUMBER() OVER(PARTITION BY COALESCE(`T`.`con_pk`,CONCAT(COALESCE(`CB`.`cb_pk`,0),'-',COALESCE(`CS`.`connector_id`,0))) ORDER BY `T`.`t_pk` DESC) AS `nc` " +
        'FROM `charge_box` `cb` ' +
        'LEFT JOIN `connector_status` `cs` ON (`cs`.`cb_pk`=`cb`.`cb_pk`) ' +
        'LEFT JOIN `transactions` `t` ON(`t`.`con_pk`=`cs`.`pk`) ' +
        'LEFT JOIN `rfid_tags` `rf` ON (`t`.`IdToken`=`rf`.`idtag`) ' +
        'LEFT JOIN `sites_users` `su` ON (`rf`.`user`=`su`.`upk` AND `su`.`spk`=' +
        sid +
        ') ' +
        'LEFT JOIN `users` `u` ON (`rf`.`user`=`u`.`user_pk`) ' +
        'WHERE `cb`.`site`=' +
        sid +
        ' AND `cb`.`cb_id`=?) ' +
        'SELECT * FROM `tempt` WHERE `nc`=1  ORDER BY `connector_id`'
    }
    return await this.sqliteAll('getChargeBoxConsAndLastTransac', query, ocppid, true)
  }
  async updConnectorPerso(params) {
    let query = ''
    if (params.sid === null) {
      query =
        'UPDATE `connector_status` SET `cname`=@cname,`maxPower`=@cmax,`format`=@cfor,`type`=@ctyp ' +
        'WHERE `cb_pk`=(SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@cbid) AND `connector_id`=@cid'
    } else {
      query =
        'UPDATE `connector_status` SET `cname`=@cname,`maxPower`=@cmax,`format`=@cfor,`type`=@ctyp ' +
        'WHERE (SELECT `site` FROM `charge_box` WHERE `cb_id`=@cbid)=@sid ' +
        'AND `cb_pk`=(SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@cbid) AND `connector_id`=@cid'
    }
    return await this.sqliteRun('updConnectorPerso', query, params, true)
  }
  /* WEBUI - AJAX */
  async ajaxGetStationsStatus(sid = null) {
    let query = ''
    if (sid) {
      query =
        'SELECT `cb`.`cb_pk`,`cb`.`registration_status`,`cb`.`online`,' +
        '(SELECT COUNT(`pk`) FROM `connector_status` WHERE `cb_pk`=`cb`.`cb_pk`) AS `nbcon` ' +
        'FROM `charge_box` `cb` WHERE `site`=' +
        sid
    } else {
      query =
        'SELECT `cb`.`cb_pk`,`cb`.`registration_status`,`cb`.`online`,' +
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
  async ajaxGetChargeurStatus(ocppid, sid = null) {
    let query = ''
    if (sid === null) {
      query =
        'SELECT `online`,`last_heartbeat_ts`,`last_bootnotif_ts` FROM `charge_box` WHERE `cb_id`=?'
    } else {
      query =
        'SELECT `online`,`last_heartbeat_ts`,`last_bootnotif_ts` FROM `charge_box` WHERE `site`=' +
        sid +
        ' AND `cb_id`=?'
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
  async ajaxGetChargeurConnsStatus(ocppid, sid = null) {
    let query = ''
    if (sid === null) {
      query =
        'SELECT `cs`.`pk`,`cs`.`connector_id`,`cs`.`status`,`cs`.`status_ts`,`cs`.`energy`,`cb`.`online` FROM `connector_status` `cs` ' +
        'LEFT JOIN `charge_box` `cb` ON(`cb`.`cb_pk`=`cs`.`cb_pk`) WHERE `cb`.`cb_id`=?'
    } else {
      query =
        'SELECT `cs`.`pk`,`cs`.`connector_id`,`cs`.`status`,`cs`.`status_ts`,`cs`.`energy`,`cb`.`online` FROM `connector_status` `cs` ' +
        'LEFT JOIN `charge_box` `cb` ON(`cb`.`cb_pk`=`cs`.`cb_pk`) ' +
        'WHERE `cb`.`site`=' +
        sid +
        ' AND `cb`.`cb_id`=?'
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
  async ajaxGetChargeBoxConsLastTransac(ocppid, sid = null) {
    let query = ''
    if (sid === null) {
      query =
        'WITH tempt AS (SELECT `t`.*,`cs`.`pk`,`rf`.`rf_name`,`u`.`name` AS `uname`,`u`.`usermail`,' +
        "ROW_NUMBER() OVER(PARTITION BY COALESCE(`t`.`con_pk`,CONCAT(COALESCE(`CB`.`cb_pk`,0),'-',COALESCE(`CS`.`connector_id`,0))) ORDER BY `t`.`t_pk` DESC) AS `nc` " +
        'FROM `transactions` `t` ' +
        'LEFT JOIN `connector_status` `cs` ON (`t`.`con_pk`=`cs`.`pk`) ' +
        'LEFT JOIN `charge_box` `cb` ON (`cs`.`cb_pk`=`cb`.`cb_pk`) ' +
        'LEFT JOIN `rfid_tags` `rf` ON (`t`.`IdToken`=`rf`.`idtag`) ' +
        'LEFT JOIN `users` `u` ON (`rf`.`user`=`u`.`user_pk`) ' +
        'WHERE `cb`.`cb_id`=?) ' +
        'SELECT * FROM `tempt` WHERE `nc`=1'
    } else {
      query =
        'WITH tempt AS (SELECT `t`.*,`cs`.`pk`,`rf`.`rf_name`,`su`.`uname`,`u`.`usermail`,' +
        "ROW_NUMBER() OVER(PARTITION BY COALESCE(`t`.`con_pk`,CONCAT(COALESCE(`CB`.`cb_pk`,0),'-',COALESCE(`CS`.`connector_id`,0))) ORDER BY `t`.`t_pk` DESC) AS `nc` " +
        'FROM `transactions` `t` ' +
        'LEFT JOIN `connector_status` `cs` ON (`t`.`con_pk`=`cs`.`pk`) ' +
        'LEFT JOIN `charge_box` `cb` ON (`cs`.`cb_pk`=`cb`.`cb_pk`) ' +
        'LEFT JOIN `rfid_tags` `rf` ON (`t`.`IdToken`=`rf`.`idtag`) ' +
        'LEFT JOIN `sites_users` `su` ON (`rf`.`user`=`su`.`upk` AND `su`.`spk`=' +
        sid +
        ') ' +
        'LEFT JOIN `users` `u` ON (`rf`.`user`=`u`.`user_pk`) ' +
        'WHERE `cb`.`site`=' +
        sid +
        ' AND `cb`.`cb_id`=?) ' +
        'SELECT * FROM `tempt` WHERE `nc`=1'
    }
    return await this.sqliteAll('ajaxGetChargeBoxConsLastTransac', query, ocppid, true)
  }

  async ajaxgetChargeBoxLogs(params) {
    let query =
      'SELECT `cl`.* FROM `charge_box_log` `cl` ' +
      'LEFT JOIN `charge_box` `cb` ON(`cl`.`cb_pk`=`cb`.`cb_pk`)' +
      'WHERE `cb`.`cb_id`=? AND `cl`.`timestamp` BETWEEN ? AND ? ORDER BY `cl`.`timestamp` DESC'
    try {
      let stmt = this.db.prepare(query)
      let res = stmt.all(params.ocppName, params.start, params.stop)
      return res
    } catch (err) {
      this.log.warn('ajaxgetChargeBoxLogs: ' + err)
      return { error: `${err}` }
    }
  }
  /* WEBUI - Report */
  async getTransacGraphData(params) {
    const query =
      "SELECT TIME(data_ts, 'unixepoch') AS x, ROUND(CAST(energy AS real)/1000, 3) AS energy, " +
      'ROUND(CAST(power AS real)/1000, 1) AS power ' +
      'FROM transactions_data WHERE t_pk=@tpk'
    return await this.sqliteAll('getTransacGraphData', query, params, true)
  }
  /* WEBUI - DASHBOARD ADMIN & Owners */
  async getDashboardCBStatus(sid = null) {
    let query =
      'SELECT TOTAL(CASE WHEN `online`=1 THEN 1 ELSE 0 END) as `online`,' +
      'TOTAL(CASE WHEN `online`=0 THEN 1 ELSE 0 END) as `offline` ' +
      'FROM `charge_box`'
    if (sid) {
      query = query + ' WHERE `site`=' + sid
    }
    return await this.sqliteGet('getDashboardCBStatus', query, null, true)
  }
  async getDashboardConnStatus(sid = null) {
    let query = ''
    if (sid) {
      query =
        "SELECT TOTAL(CASE WHEN `CS`.`status`='Available' THEN 1 ELSE 0 END) as `available`," +
        "TOTAL(CASE WHEN `CS`.`status`='Unavailable' THEN 1 ELSE 0 END) as `unavailable`, " +
        "TOTAL(CASE WHEN `CS`.`status`='Charging' THEN 1 ELSE 0 END) as `charging`, " +
        "TOTAL(CASE WHEN `CS`.`status`='Faulted' THEN 1 ELSE 0 END) as `faulted`, " +
        "TOTAL(CASE WHEN `CS`.`status` NOT IN ('Available','Unavailable','Charging','Faulted') THEN 1 ELSE 0 END) as `occupied` " +
        'FROM `connector_status` `CS` LEFT JOIN `charge_box` `CB` ON (`CS`.`cb_pk`=`CB`.`cb_pk`) ' +
        'WHERE `CB`.`site`=' +
        sid +
        ' AND `CB`.`online`=1'
    } else {
      query =
        "SELECT TOTAL(CASE WHEN `CS`.`status`='Available' THEN 1 ELSE 0 END) as `available`," +
        "TOTAL(CASE WHEN `CS`.`status`='Unavailable' THEN 1 ELSE 0 END) as `unavailable`, " +
        "TOTAL(CASE WHEN `CS`.`status`='Charging' THEN 1 ELSE 0 END) as `charging`, " +
        "TOTAL(CASE WHEN `CS`.`status`='Faulted' THEN 1 ELSE 0 END) as `faulted`, " +
        "TOTAL(CASE WHEN `CS`.`status` NOT IN ('Available','Unavailable','Charging','Faulted') THEN 1 ELSE 0 END) as `occupied` " +
        'FROM `connector_status` `CS` LEFT JOIN `charge_box` `CB` ON (`CS`.`cb_pk`=`CB`.`cb_pk`) ' +
        'WHERE `CB`.`online`=1'
    }
    return await this.sqliteGet('getDashboardConnStatus', query, null, true)
  }
  async getDashboardSiteCbConnTransac(sid = null) {
    let query = ''
    if (sid) {
      query =
        'WITH tempt AS (' +
        "SELECT ROW_NUMBER() OVER(PARTITION BY COALESCE(`T`.`con_pk`,CONCAT(COALESCE(`CB`.`cb_pk`,0),'-',COALESCE(`CS`.`connector_id`,0))) ORDER BY `T`.`t_pk` DESC) AS `nc`," +
        '`CB`.`site`,`CB`.`cb_pk`,`CB`.`cb_name`,`CB`.`online`,`CB`.`cb_id`,' +
        '`CS`.`pk`,`CS`.`status`,`CS`.`connector_id`,`CS`.`cname`,' +
        '`T`.`t_pk`,`T`.`tsStart`,`T`.`tsStop`,`T`.`tsEnergy`,`T`.`tsPower`,`T`.`tsReason` ' +
        'FROM `charge_box` `CB` ' +
        'LEFT JOIN `connector_status` `CS` ON(`CS`.`cb_pk`=`CB`.`cb_pk`) ' +
        'LEFT JOIN `transactions` `T` ON(`T`.`con_pk`=`CS`.`pk`) ' +
        ') ' +
        'SELECT * FROM `tempt` WHERE `site`=' +
        sid +
        ' AND `nc`=1 ORDER BY `cb_name`, `connector_id`'
    } else {
      query =
        'WITH tempt AS (' +
        "SELECT ROW_NUMBER() OVER(PARTITION BY COALESCE(`T`.`con_pk`,CONCAT(`SI`.`s_pk`,'-',COALESCE(`CB`.`cb_pk`,0),'-',COALESCE(`CS`.`connector_id`,0))) ORDER BY `T`.`t_pk` DESC) AS `nc`," +
        '`SI`.`s_pk`,`SI`.`s_name`,`CB`.`cb_pk`,`CB`.`cb_name`,`CB`.`online`,`CB`.`cb_id`,' +
        '`CS`.`pk`,`CS`.`status`,`CS`.`connector_id`,`CS`.`cname`,' +
        '`T`.`t_pk`,`T`.`tsStart`,`T`.`tsStop`,`T`.`tsEnergy`,`T`.`tsPower`,`T`.`tsReason` ' +
        'FROM `sites` `SI` ' +
        'LEFT JOIN `charge_box` `CB` ON(`CB`.`site`=`SI`.`s_pk`) ' +
        'LEFT JOIN `connector_status` `CS` ON(`CS`.`cb_pk`=`CB`.`cb_pk`) ' +
        'LEFT JOIN `transactions` `T` ON(`T`.`con_pk`=`CS`.`pk`) ' +
        ') ' +
        'SELECT * FROM `tempt` WHERE `nc`=1 ORDER BY `s_name`, `cb_name`, `connector_id`'
    }
    return await this.sqliteAll('getDashboardSiteCbConnTransac', query, null, true)
  }
  /* DOUBLONS */
  async AutoAddChargeBox(params) {
    /* Pendings & Autoadd params */
    let query =
      'INSERT INTO `charge_box` (`cb_id`,`cb_name`,`registration_status`) VALUES (@id,@name,@regstatus)'
    let data = { id: params.ocppid, name: params.cbname, regstatus: params.regstatus }
    try {
      let stmt = this.db.prepare(query)
      let res = stmt.run(data)
      return res
    } catch (err) {
      this.log.warn('AutoAddChargeBox: ' + err)
      return { error: new Error(`${err}`) }
    }
  }

  /* GLOBAL FUNCTIONS */
  /* ALL - only on statements that return data */
  /* Array of data / empty array / Error */
  async sqliteAll(funcname, query, params = null, forUi = false) {
    try {
      const stmt = this.db.prepare(query)
      if (params) {
        stmt.bind(params)
      }
      const res = stmt.all()
      return res
    } catch (err) {
      this.log.warn(funcname + ': ' + err)
      if (forUi) {
        return { error: new Error(`${err}`) }
      }
      return false
    }
  }
  /* GET - only on statements that return data */
  /* Object of data / undefined / Error */
  async sqliteGet(funcname, query, params = null, forUi = false) {
    try {
      const stmt = this.db.prepare(query)
      if (params) {
        stmt.bind(params)
      }
      const res = stmt.get()
      return res
    } catch (err) {
      this.log.warn(funcname + ': ' + err)
      if (forUi) {
        return { error: new Error(`${err}`) }
      }
      return false
    }
  }
  /* RUN - Insert / Update / Delete */
  /* info={changes:0,lastInsertRowid:0} / Error */
  async sqliteRun(funcname, query, params = null, forUi = false) {
    try {
      const stmt = this.db.prepare(query)
      if (params) {
        stmt.bind(params)
      }
      const res = stmt.run()
      return res
    } catch (err) {
      this.log.warn(funcname + ': ' + err)
      if (forUi) {
        return { error: new Error(`${err}`) }
      }
      return false
    }
  }
  /* Log */
  WriteLog(msg, lvl = 'INFO') {
    const level = lvl.toUpperCase()
    switch (level) {
      case 'TRACE':
        this.log.trace(msg)
        break
      case 'DEBUG':
        this.log.debug(msg)
        break
      case 'WARN':
        this.log.warn(msg)
        break
      case 'ERROR':
        this.log.error(msg)
        break
      case 'FATAL':
        this.log.fatal(msg)
        break
      default:
        this.log.info(msg)
        break
    }
  }
  /* CLOSE FUNCTIONS */
  async setAllChargeBoxOffline() {
    try {
      const info = this.db.prepare('UPDATE `charge_box` SET `online`=0 WHERE `online`=1').run()
      this.log.debug('setAllChargeBoxOffline: ' + info.changes + ' set offline')
    } catch (err) {
      this.log.warn('setAllChargeBoxOffline: ' + err)
    }
  }
  async closeDB() {
    await this.setAllChargeBoxOffline()
    this.db.close()
    this.log.log('Database closed')
  }
  /* Here is line : 1184 - 931 */
})()
