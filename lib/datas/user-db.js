import sqlite from './db.js'

class UserDB {
  constructor() {}
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
    return await sqlite.sqliteGet('getUserNotifsData', query, uid, true)
  }
  /* WEBUI - USER - Update Notifs Data */
  async updUserNotifs(params) {
    const query =
      'UPDATE `user_notifs` SET `lng`=@lng, `mailEnabled`=@eml, `pushEnabled`=@psh,' +
      '`pushuser`=@pshu, `pushtokn`=@psht, `cbOnline`=@cbon, `cbOffline`=@cboff,' +
      '`conFaulted`=@conf, `conAvailable`=@cona, `conUnavailable`=@conu,' +
      '`cbDiag`=@cbdg, `chgStart`=@chgd, `chgStop`=@chgf, `chgEvent`=@chge ' +
      'WHERE `user_pk`=@uid'
    return await sqlite.sqliteRun('updUserNotifs', query, params, true)
  }
  /* WEBUI - USER - Chargebox List */
  async getUserChargeBox(uid) {
    const query =
      'SELECT `SI`.`s_name`,`CB`.`cb_pk`,`CB`.`online`,`CB`.`cb_id`,`CB`.`cb_name` ' +
      'FROM `charge_box` `CB` ' +
      'LEFT JOIN `sites` `SI` ON (`SI`.`s_pk`=`CB`.`site`) ' +
      'LEFT JOIN `sites_users` `SU` ON (`SU`.`spk`=`CB`.`site`) ' +
      'WHERE `SU`.`upk`=? ORDER BY `s_name`, `cb_name`'
    return await sqlite.sqliteAll('getUserChargeBox', query, uid, true)
  }
  async getChargeBoxInfos(params) {
    const query =
      'SELECT `CB`.`online`,`CB`.`cb_name`,`CB`.`cb_id`,`CB`.`cb_mode` ' +
      'FROM `charge_box` `CB` ' +
      'LEFT JOIN `sites_users` `SU` ON (`SU`.`spk`=`CB`.`site`) ' +
      'WHERE `SU`.`upk`=@uid AND `CB`.`cb_id`=@cbid'
    return await sqlite.sqliteGet('getChargeBoxInfos', query, params, true)
  }
  async getChargeBoxConnectors(params) {
    const query =
      'SELECT `CB`.`cb_id`,`CS`.`pk`,`CS`.`connector_id`,`CB`.`cb_mode`,' +
      '`CS`.`status`,`CS`.`cname`,`CS`.`maxPower`,`CS`.`format`,`CS`.`type`,' +
      '`TR`.`t_pk`,`TR`.`tsEnergy`,`TR`.`tsPower`,`TR`.`tsStart`,' +
      '(CASE WHEN `TR`.`upk`=@uid THEN 1 ELSE 0 END) AS `me` ' +
      'FROM `connector_status` `CS` ' +
      'LEFT JOIN `charge_box` `CB` ON(`CB`.`cb_pk`=`CS`.`cb_pk`) ' +
      'LEFT JOIN `sites_users` `SU` ON (`SU`.`spk`=`CB`.`site`) ' +
      'LEFT JOIN `transactions` `TR` ON (`TR`.`con_pk`=`CS`.`pk` AND tsStop IS NULL) ' +
      'WHERE `SU`.`upk`=@uid AND `CB`.`cb_id`=@cbid ORDER BY `CS`.`connector_id`'
    return await sqlite.sqliteAll('getChargeBoxConnectors', query, params, true)
  }
  /* Notifications */
  async getAdminToNotifyCB(event, cb_id) {
    let query =
      'SELECT `U`.`usermail`,`U`.`name`,`U`.`isAdmin`,`UN`.`lng`,`UN`.`mailEnabled`,`UN`.`pushEnabled`,`UN`.`pushuser`,' +
      '`UN`.`pushtokn`,(SELECT `cb_name` FROM `charge_box` WHERE `cb_id`=@cbid) AS `cb_name`,' +
      '(SELECT `s_name` FROM `sites` `S` LEFT JOIN `charge_box` `CB` ON (`S`.`s_pk`=`CB`.`site`) WHERE `CB`.`cb_id`=@cbid) AS `site_name` ' +
      'FROM `users` `U` ' +
      'LEFT JOIN `user_notifs` `UN` ON (`UN`.`user_pk`=`U`.`user_pk`) ' +
      'WHERE (`U`.`isAdmin`=1 OR `U`.`ownedSite` IN (SELECT `site` FROM `charge_box` WHERE `cb_id`=@cbid)) ' +
      'AND (`UN`.`mailEnabled`=1 OR `UN`.`pushEnabled`=1) '
    /* cbOnline */
    if (event === 'cbOnline') {
      query += 'AND `UN`.`cbOnline`=1 '
    } else if (event === 'cbOffline') {
      /* cbOffline */
      query += 'AND `UN`.`cbOffline`=1 '
    } else if (event === 'cbDiag') {
      /* cbDiag */
      query += 'AND `UN`.`cbDiag`=1 '
    }
    return await sqlite.sqliteAll('getAdminToNotifyCB', query, { cbid: cb_id }, false)
  }
  async getAdminToNotifyConnector(event, cb_id, cn_id) {
    let query =
      'SELECT `U`.`usermail`,`U`.`name`,`U`.`isAdmin`,`UN`.`lng`,`UN`.`mailEnabled`,`UN`.`pushEnabled`,`UN`.`pushuser`,' +
      '`UN`.`pushtokn`,(SELECT `cb_name` FROM `charge_box` WHERE `cb_id`=@cbid) AS `cb_name`,' +
      '(SELECT `s_name` FROM `sites` `S` LEFT JOIN `charge_box` `CB` ON (`S`.`s_pk`=`CB`.`site`) WHERE `CB`.`cb_id`=@cbid) AS `site_name`,' +
      '(SELECT `cname` FROM `connector_status` `CS` LEFT JOIN `charge_box` `CB` ON (`CS`.`cb_pk`=`CB`.`cb_pk`) WHERE `CB`.`cb_id`=@cbid AND `CS`.`connector_id`=@cnid) AS `c_name`,' +
      '(SELECT `status` FROM `connector_status` `CS` LEFT JOIN `charge_box` `CB` ON (`CS`.`cb_pk`=`CB`.`cb_pk`) WHERE `CB`.`cb_id`=@cbid AND `CS`.`connector_id`=@cnid) AS `c_status` ' +
      'FROM `users` `U` ' +
      'LEFT JOIN `user_notifs` `UN` ON (`UN`.`user_pk`=`U`.`user_pk`) ' +
      'WHERE (`U`.`isAdmin`=1 OR `U`.`ownedSite` IN (SELECT `site` FROM `charge_box` WHERE `cb_id`=@cbid)) ' +
      'AND (`UN`.`mailEnabled`=1 OR `UN`.`pushEnabled`=1) '
    // conUnavailable/
    if (event === 'conUnavailable') {
      query += 'AND `UN`.`conUnavailable`=1 '
    }
    // conFaulted
    if (event === 'conFaulted') {
      query += 'AND `UN`.`conFaulted`=1 '
    }
    // conUnavailable/
    if (event === 'conAvailable') {
      query += "AND `UN`.`conAvailable`=1 AND `c_status` IN ('Unavailable', 'Faulted')"
    }
    return await sqlite.sqliteAll('getAdminToNotifyCB', query, { cbid: cb_id, cnid: cn_id }, false)
  }
  async getUserToNotifyChargeEvent(event, cb_id, cn_id) {
    const query =
      'SELECT `U`.`usermail`, `U`.`name`,`UN`.`lng`,`UN`.`mailEnabled`,`UN`.`pushEnabled`,`UN`.`pushuser`,`UN`.`pushtokn`,' +
      '(SELECT `cb_name` FROM `charge_box` WHERE `cb_id`=@cbid) AS `cb_name`,' +
      '(SELECT `cname` FROM `connector_status` `CS` LEFT JOIN `charge_box` `CB` ON (`CS`.`cb_pk`=`CB`.`cb_pk`) WHERE `CB`.`cb_id`=@cbid AND `CS`.`connector_id`=@cnid) AS `c_name` ' +
      'FROM `users` `U` ' +
      'LEFT JOIN `user_notifs` `UN` ON (`UN`.`user_pk`=`U`.`user_pk`) ' +
      'WHERE `U`.`user_pk`=' +
      '(SELECT `upk` FROM `transactions` WHERE `con_pk` IN ' +
      '(SELECT `pk` FROM `connector_status` WHERE `connector_id`=@cnid AND `cb_pk` IN (SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@cbid)) ' +
      'AND tsStop IS NULL) ' +
      'AND (`UN`.`mailEnabled`=1 OR `UN`.`pushEnabled`=1) AND `UN`.`chgEvent`=1'
    return await sqlite.sqliteGet('getUserToNotifyChargeEvent', query, { cbid: cb_id, cnid: cn_id }, false)
  }
}
export default new UserDB()
