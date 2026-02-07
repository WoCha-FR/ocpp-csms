import sqlite from './db.js'

class ReportsDB {
  constructor() {}
  /* Report List Owner & Admin */
  async getTransacList(params) {
    let query = ''
    if (params.sid) {
      // Owner
      query =
        'SELECT `CB`.`cb_name`,`CS`.`cname`,`CS`.`connector_id`,`RF`.`rf_name`,`SU`.`uname`,`U`.`usermail`,' +
        '`T`.`t_pk`,`T`.`upk`,`T`.`rfpk`,`T`.`IdToken`,`T`.`tsStart`,`T`.`tsStop`,`T`.`tsStatus`,`T`.`tsEnergy`,`T`.`tsReason` ' +
        'FROM `transactions` `T` ' +
        'LEFT JOIN `connector_status` `CS` ON (`T`.`con_pk`=`CS`.`pk`) ' +
        'LEFT JOIN `charge_box` `CB` ON (`CS`.`cb_pk`=`CB`.`cb_pk`) ' +
        'LEFT JOIN `rfid_tags` `RF` ON (`T`.`rfpk`=`RF`.`rf_pk`) ' +
        'LEFT JOIN `sites_users` `SU` ON (`T`.`upk`=`SU`.`upk` AND `SU`.`spk`=@sid) ' +
        'LEFT JOIN `users` `U` ON (`T`.`upk`=`U`.`user_pk`) ' +
        'WHERE `CB`.`site`=@sid AND `T`.`tsStart` BETWEEN @start AND @stop ' +
        'ORDER BY `T`.`tsStart` DESC'
    } else {
      // Admin
      query =
        'SELECT `S`.`s_name`,`CB`.`cb_name`,`CS`.`cname`,`CS`.`connector_id`,`RF`.`rf_name`,`U`.`name` AS `uname`,`U`.`usermail`,' +
        '`T`.`t_pk`,`T`.`upk`,`T`.`rfpk`,`T`.`IdToken`,`T`.`tsStart`,`T`.`tsStop`,`T`.`tsStatus`,`T`.`tsEnergy`,`T`.`tsReason` ' +
        'FROM `transactions` `T` ' +
        'LEFT JOIN `connector_status` `CS` ON (`T`.`con_pk`=`CS`.`pk`) ' +
        'LEFT JOIN `charge_box` `CB` ON (`CS`.`cb_pk`=`CB`.`cb_pk`) ' +
        'LEFT JOIN `sites` `S` ON (`CB`.`site`=`S`.`s_pk`) ' +
        'LEFT JOIN `rfid_tags` `RF` ON (`T`.`rfpk`=`RF`.`rf_pk`) ' +
        'LEFT JOIN `users` `U` ON (`T`.`upk`=`U`.`user_pk`) ' +
        'WHERE `T`.`tsStart` BETWEEN @start AND @stop ORDER BY `T`.`tsStart` DESC'
    }
    return await sqlite.sqliteAll('getTransacList', query, params, true)
  }
  /* Auth Report List */
  async getTransacAuthList(params) {
    let query = ''
    if (params.sid) {
      // Owner
      query =
        'SELECT `CB`.`cb_name`,`A`.`idtag`,`A`.`ts`,`A`.`resp`,`A`.`method` ' +
        'FROM `idtags_logs` `A` ' +
        'LEFT JOIN `charge_box` `CB` ON (`A`.`cb_pk`=`CB`.`cb_pk`) ' +
        'WHERE `CB`.`site`=@sid AND `A`.`ts` BETWEEN @start AND @stop ' +
        'ORDER BY `A`.`ts` DESC'
    } else {
      // Admin
      query =
        'SELECT `S`.`s_name`,`CB`.`cb_name`,`A`.`idtag`,`A`.`ts`,`A`.`resp`,`A`.`method` ' +
        'FROM `idtags_logs` `A` ' +
        'LEFT JOIN `charge_box` `CB` ON (`A`.`cb_pk`=`CB`.`cb_pk`) ' +
        'LEFT JOIN `sites` `S` ON (`CB`.`site`=`S`.`s_pk`) ' +
        'WHERE `A`.`ts` BETWEEN @start AND @stop ORDER BY `A`.`ts` DESC'
    }
    return await sqlite.sqliteAll('getTransacAuthList', query, params, true)
  }
  /* Report List User */
  async getUserTransacList(params) {
    const query =
      'SELECT `S`.`s_name`, `CB`.`cb_name`,`CS`.`cname`,`CS`.`connector_id`,`RF`.`rf_name`,' +
      '`T`.`t_pk`,`T`.`upk`,`T`.`rfpk`,`T`.`IdToken`,`T`.`tsStart`,`T`.`tsStop`,`T`.`tsStatus`,`T`.`tsEnergy`,`T`.`tsReason` ' +
      'FROM `transactions` `T` ' +
      'LEFT JOIN `connector_status` `CS` ON (`T`.`con_pk`=`CS`.`pk`) ' +
      'LEFT JOIN `charge_box` `CB` ON (`CS`.`cb_pk`=`CB`.`cb_pk`) ' +
      'LEFT JOIN `sites` `S` ON (`CB`.`site`=`S`.`s_pk`) ' +
      'LEFT JOIN `rfid_tags` `RF` ON (`T`.`rfpk`=`RF`.`rf_pk`) ' +
      'WHERE `T`.`upk`=@upk AND `T`.`tsStart` BETWEEN @start AND @stop ' +
      'ORDER BY `T`.`tsStart` DESC'
    return await sqlite.sqliteAll('getUserTransacList', query, params, true)
  }
  /* User authirized to view this report */
  async isUserAuthorizedForThisReport(params) {
    const query =
      'SELECT `T`.`upk`,`CB`.`site` ' +
      'FROM `transactions` `T` ' +
      'LEFT JOIN `connector_status` `CS` ON (`T`.`con_pk`=`CS`.`pk`) ' +
      'LEFT JOIN `charge_box` `CB` ON (`CS`.`cb_pk`=`CB`.`cb_pk`) ' +
      'WHERE `T`.`t_pk`=@tpk'
    return await sqlite.sqliteGet('isUserAuthorizedForThisReport', query, params, true)
  }
  /* Charge data */
  async getTransacData(params) {
    const query =
      'SELECT `S`.`s_name`,`CB`.`cb_name`,`CS`.`cname`,`CS`.`connector_id`,`RF`.`rf_name`,`U`.`name` AS `uname`,' +
      '`T`.`t_pk`,`T`.`upk`,`T`.`rfpk`,`T`.`IdToken`,`T`.`tsStart`,`T`.`tsStop`,`T`.`tsStatus`,`T`.`tsEnergy`,`T`.`tsReason` ' +
      'FROM `transactions` `T` ' +
      'LEFT JOIN `connector_status` `CS` ON (`T`.`con_pk`=`CS`.`pk`) ' +
      'LEFT JOIN `charge_box` `CB` ON (`CS`.`cb_pk`=`CB`.`cb_pk`) ' +
      'LEFT JOIN `sites` `S` ON (`CB`.`site`=`S`.`s_pk`) ' +
      'LEFT JOIN `rfid_tags` `RF` ON (`T`.`rfpk`=`RF`.`rf_pk`) ' +
      'LEFT JOIN `users` `U` ON (`T`.`upk`=`U`.`user_pk`) ' +
      'WHERE `T`.`t_pk`=@tpk'
    return await sqlite.sqliteGet('getTransacData', query, params, true)
  }
  /* Charge graph data */
  async getTransacGraphData(params) {
    const query =
      "SELECT TIME(`data_ts`, 'unixepoch') AS `x`,ROUND(CAST(`energy` AS real)/1000, 3) AS `energy`," +
      'ROUND(CAST(`power` AS real)/1000, 1) AS `power`,ROUND(CAST(`poffer` AS real)/1000, 1) AS `poffer`,' +
      'ROUND(`ampl1`, 1) AS `ampl1`,ROUND(`ampl2`, 1) AS `ampl2`,ROUND(`ampl3`, 1) AS `ampl3`,ROUND(`ampoffer`, 1) AS `ampoffer` ' +
      'FROM `transactions_data` WHERE `t_pk`=@tpk'
    return await sqlite.sqliteAll('getTransacGraphData', query, params, true)
  }
}
export default new ReportsDB()
