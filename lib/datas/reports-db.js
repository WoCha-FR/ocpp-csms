import sqlite from './db.js'

export default new class ReportsDB {
  constructor () {
  }
  /* Report List */
  async getTransacList() {
    let query = ''
    // Admin
    query = 'SELECT `S`.`s_name`,`CB`.cb_name,`CS`.`cname`,`CS`.`connector_id`,`RF`.`rf_name`,`U`.`name` AS `uname`,' +
      '`U`.`usermail`,`T`.`t_pk`,`T`.`IdToken`,`T`.`tsStart`,`T`.`tsStop`,`T`.`tsStatus`,`T`.`tsEnergy` ' +
      'FROM `transactions` `T` ' +
      'LEFT JOIN `connector_status` `CS` ON (`T`.`con_pk`=`CS`.`pk`) ' +
      'LEFT JOIN `charge_box` `CB` ON (`CS`.`cb_pk`=`CB`.`cb_pk`) ' +
      'LEFT JOIN `sites` `S` ON (`CB`.`site`=`S`.`s_pk`)' +
      'LEFT JOIN `rfid_tags` `RF` ON (`T`.`IdToken`=`RF`.`idtag`) ' +
      'LEFT JOIN `users` `U` ON (`RF`.`user`=`U`.`user_pk`) ' +
      'ORDER BY `T`.`tsStart` DESC'
    return await sqlite.sqliteAll('getTransacGraphData', query, null, true)
  }
  /* Charge graph data */
  async getTransacGraphData(params) {
    const query = 'SELECT TIME(data_ts, \'unixepoch\') AS x, ROUND(CAST(energy AS real)/1000, 3) AS energy, ' +
      'ROUND(CAST(power AS real)/1000, 1) AS power,  ' +
      'FROM transactions_data WHERE t_pk=@tpk'
    return await sqlite.sqliteAll('getTransacGraphData', query, params, true)
  }
}