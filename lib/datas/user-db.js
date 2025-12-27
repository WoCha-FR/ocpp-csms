import sqlite from './db.js'

export default new class UserDB {
  constructor () {
  }
  /* WEBUI - USER - Update Name & password */
  async updUserSelf(params) {
    let query = 'UPDATE `users` SET `name`=@uname'
    if (params.upass) {
      query = query + ',`password`=@upass'
    }
    query = query + ' WHERE `user_pk`=@uid'
    return await sqlite.sqliteRun('updUserSelf', query, params, true)
  }
  /* WEBUI - USER - Get Notifs Data */
  async getUserNotifsData(uid) {
    const query = 'SELECT * FROM `user_notifs` WHERE `user_pk`=?'
    return await sqlite.sqliteAll('getUserNotifsData', query, uid, true)
  }
  /* WEBUI - USER - Chargebox List */
  async getUserChargeBox(uid) {
    const query = 'SELECT `SI`.`s_name`,`CB`.`online`,`CB`.`cb_id`,`CB`.`cb_name` ' +
      'FROM `charge_box` `CB` ' +
      'LEFT JOIN `sites` `SI` ON (`SI`.`s_pk`=`CB`.`site`) ' +
      'LEFT JOIN `sites_users` `SU` ON (`SU`.`spk`=`CB`.`site`) ' +
      'WHERE `SU`.`upk`=? ORDER BY `s_name`, `cb_name`'
    return await sqlite.sqliteAll('getUserChargeBox', query, uid, true)
  }
  async getChargeBoxInfos(params) {
    const query = 'SELECT `CB`.`online`,`CB`.`cb_name`,`CB`.`cb_id`,`CB`.`cb_mode` ' +
      'FROM `charge_box` `CB` ' +
      'LEFT JOIN `sites_users` `SU` ON (`SU`.`spk`=`CB`.`site`) ' +
      'WHERE `SU`.`upk`=@uid AND `CB`.`cb_id`=@cbid'
    return await sqlite.sqliteGet('getChargeBoxInfos', query, params, true)
  }
  async getChargeBoxConnectors(params) {
    const query = 'SELECT `CB`.`cb_id`,`CS`.`pk`,`CS`.`connector_id`,' +
      '`CS`.`status`,`CS`.`cname`,`CS`.`maxPower`, `CS`.`format`,`CS`.`type` ' +
      'FROM `connector_status` `CS` ' +
      'LEFT JOIN `charge_box` `CB` ON(`CB`.`cb_pk`=`CS`.`cb_pk`) ' +
      'LEFT JOIN `sites_users` `SU` ON (`SU`.`spk`=`CB`.`site`) ' +
      'WHERE `SU`.`upk`=@uid AND `CB`.`cb_id`=@cbid ORDER BY `CS`.`connector_id`'
    return await sqlite.sqliteAll('getChargeBoxConnectors', query, params, true)
  }
  /* Notifications */
  async getAdminToNotify(event, cbid) {
    let query = 'SELECT `U`.`usermail`,`U`.`name`,`UN`.`mailEnabled`,`UN`.`pushEnabled`,`UN`.`pushuser`,`UN`.`pushtokn` ' +
      'FROM `users` `U` ' +
      'LEFT JOIN `user_notifs` `UN` ON (`UN`.`user_pk`=`U`.`user_pk`) ' +
      'WHERE (`U`.`isAdmin`=1 OR `U`.`ownedSite` IN (SELECT `site` FROM `charge_box` WHERE `cb_id`=?)) ' +
      'AND (`UN`.`mailEnabled`=1 OR `UN`.`pushEnabled`=1) '
    /* cbOnline */
    if (event === 'cbOnline') {
      query += 'AND `UN`.`cbOnline`=1 '
    }
    /* cbOffline */
    else if (event === 'cbOffline') {
      query += 'AND `UN`.`cbOffline`=1 '
    }
    return await sqlite.sqliteAll('getAdminToNotify', query, cbid, false)
  }
}