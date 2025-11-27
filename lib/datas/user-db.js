import sqlite from './db.js'

export default new class UserDB {
  constructor () {
  }
  /* WEBUI - USER - Self update */
  async updUserSelf(params) {
    let query = 'UPDATE `users` SET `name`=@uname'
    if (params.upass) {
      query = query + ',`password`=@upass'
    }
    query = query + ' WHERE `user_pk`=@uid'
    return await sqlite.sqliteRun('updUserSelf', query, params, true)
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
}