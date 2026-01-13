import sqlite from './db.js'

export default new class CSMSDB {
  constructor () {
  }
  /* server.auth - Return Value in DB or Undefined */
  async getCBAuth(ocppid) {
    ocppid = ocppid.replace(/[!@#$%^&*]/g, '')
    try {
      let stmt = sqlite.db.prepare('SELECT `cb_pwd` FROM `charge_box` WHERE `cb_id`=?')
      let res = stmt.get(ocppid)
      return res // Values or undefined
    } catch (err) {
      sqlite.WriteLog('getCBAuth: ' + err, 'WARN')
      return undefined
    }
  }
  /* server.auth - AutoAdd or PendingAdd */
  async AutoAddChargeBox(params) {
    /* Pendings & Autoadd params */
    let query = 'INSERT INTO `charge_box` (`cb_id`,`cb_name`,`registration_status`) VALUES (@id,@name,@regstatus)'
    let data = {
      id : params.ocppid,
      name: params.cbname,
      regstatus: params.regstatus
    }
    try {
      let stmt = sqlite.db.prepare(query)
      let res = stmt.run(data)
      return res
    } catch (err) {
      sqlite.WriteLog('AutoAddChargeBox: ' + err, 'WARN')
      return { error: new Error(`${err}`) }
    }
  }
  /* server.on('client') - client.once('close') */
  async setChargeBoxOnOffLine(ocppid, status) {
    try {
      const stmt = sqlite.db.prepare('UPDATE `charge_box` SET `online`=? WHERE `cb_id`=?')
      const info = stmt.run(status, ocppid)
      sqlite.WriteLog('setChargeBoxOnOffLine: ' + info.changes + ' updated', 'DEBUG')
    } catch (err) {
      sqlite.WriteLog('setChargeBoxOnOffLine: ' + err, 'WARN')
    }
  }
  /* client.on('callResult') / client.on('callError') / client.on('strictValidationFailure') */
  addToLog(params) {
    // Query
    let stmt = sqlite.db.prepare('INSERT INTO `charge_box_log` (`cb_pk`,`timestamp`,`direction`,`type`,`method`,`message`) ' +
    'VALUES ((SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@ocppid), @ts, @direction, @type, @methode, @message)')
    let insertMany = sqlite.db.transaction((logs) => {
      for (const log of logs) {
        stmt.run(log)
      }
    })
    try {
      insertMany.immediate(params)
    } catch (err) {
      sqlite.WriteLog('addToLog: ' + err, 'WARN')
    }
  }
  /* client.handle('BootNotification') */
  async getCBRegStatus(ocppid) {
    ocppid = ocppid.replace(/[!@#$%^&*]/g, '')
    try {
      let stmt = sqlite.db.prepare('SELECT `registration_status` FROM `charge_box` WHERE `cb_id`=?')
      let res = stmt.get(ocppid)
      return res // Values or undefined
    } catch (err) {
      sqlite.WriteLog('getCBRegStatus: ' + err, 'WARN')
      return undefined
    }
  }
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
      let stmt = sqlite.db.prepare(query)
      let res = stmt.run(data)
      return res
    } catch (err) {
      sqlite.WriteLog('updBootNotification: ' + err, 'WARN')
      return undefined
    }
  }
  updLastBoot(ocppid) {
    let hb_ts = Math.floor(Date.now() / 1000)
    try {
      let stmt = sqlite.db.prepare('UPDATE `charge_box` SET `last_bootnotif_ts`=? WHERE `cb_id`=?')
      let res = stmt.run(hb_ts, ocppid)
      return res
    } catch (err) {
      sqlite.WriteLog('updLastBoot: ' + err, 'WARN')
      return undefined
    }
  }
  /* client.handle('StatusNotification') */
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
      vec: params.vendorErrorCode || null
    }
    // FIRST : Exists ?
    try {
      let stmt1 = sqlite.db.prepare(queryS)
      let res1 = stmt1.get(data)
      // res1 === undefined => Insert
      if (res1 === undefined) {
        try {
          let stmtI = sqlite.db.prepare(queryI)
          let resI = stmtI.run(data)
          return resI
        } catch (err) {
          //this.log.warn()
          sqlite.WriteLog('updConnectorStatus #Insert: ' + err, 'WARN')
          return undefined
        }
      // res1 !== undefined => Update
      } else {
        try {
          let stmtU = sqlite.db.prepare(queryU)
          let resU = stmtU.run(res1.pk, data)
          return resU
        } catch (err) {
          //this.log.warn()
          sqlite.WriteLog('updConnectorStatus #Update: ' + err, 'WARN')
          return undefined
        }
      }
    } catch (err) {
      //this.log.warn()
      sqlite.WriteLog('updConnectorStatus #1: ' + err, 'WARN')
      return undefined
    }
  }
  async isChargerAutoOCPP(ocppid) {
    let stmt = sqlite.db.prepare('SELECT `cb_mode` FROM `charge_box` WHERE `cb_id`=?')
    try {
      let res = stmt.get(ocppid)
      if (res.cb_mode === 0) {
        return true
      }
      return false
    } catch(err) {
      sqlite.WriteLog('isChargerAutoOCPP: ' + err, 'WARN')
      return false
    }
  }
  /* client.handle('Heartbeat') */
  updHeartBeat(ocppid) {
    let hb_ts = Math.floor(Date.now() / 1000)
    try {
      let stmt = sqlite.db.prepare('UPDATE `charge_box` SET `last_heartbeat_ts`=? WHERE `cb_id`=?')
      let res = stmt.run(hb_ts, ocppid)
      return res
    } catch (err) {
      sqlite.WriteLog('updHeartBeat: ' + err, 'WARN')
      return undefined
    }
  }
  /* client.handle('Authorize') / client.handle('StartTransaction') */
  async getAuthorizeResponse(ocppid, idTag) {
    const expire = new Date(Date.now()).toISOString();
    // Admin TAG => Authorize SITEADMIN & SUPERADMIN
    if (idTag.startsWith("SADM")) {
      const qadmin =
        "SELECT `RT`.`rf_pk` " +
        "FROM `rfid_tags` `RT` " +
        "LEFT JOIN `charge_box` `CB` ON (`RT`.`site`=`CB`.`site`) " +
        "WHERE (`CB`.`cb_id`=? OR `RT`.`site` IS NULL) AND `RT`.`idtag`=?";
      try {
        const stmt = sqlite.db.prepare(qadmin);
        const result = stmt.get(ocppid, idTag);
        if (result === undefined) {
          const ret = {
            ocppresp: { status: "Invalid", expiryDate: expire },
            idtaginfo: { rfpk: null, upk: null },
          };
          return ret;
        }
        const ret = {
          ocppresp: { status: "Accepted", expiryDate: expire },
          idtaginfo: { rfpk: result.rf_pk, upk: 0 },
        };
        return ret;
      } catch (err) {
        sqlite.WriteLog("getAuthorizeResponse SADM: " + err, "WARN");
        const ret = {
          ocppresp: { status: "Invalid", expiryDate: expire },
          idtaginfo: { rfpk: null, upk: null },
        };
        return ret;
      }
    }
    // User TAG => Authorize USER only
    if (idTag.startsWith("WUSR")) {
      const quser =
        "SELECT `U`.`user_pk` " +
        "FROM `sites_users` `SU` " +
        "LEFT JOIN `charge_box` `CB` ON (`SU`.`spk`=`CB`.`site`) " +
        "LEFT JOIN `users` `U` ON (`SU`.`upk`=`U`.`user_pk`) " +
        "WHERE `CB`.`cb_id`=? AND `U`.`idtag`=?";
      try {
        const stmt = sqlite.db.prepare(quser);
        const result = stmt.get(ocppid, idTag);
        if (result === undefined) {
          const ret = {
            ocppresp: { status: "Invalid", expiryDate: expire },
            idtaginfo: { rfpk: null, upk: null },
          };
          return ret;
        }
        const ret = {
          ocppresp: { status: "Accepted", expiryDate: expire },
          idtaginfo: { rfpk: null, upk: result.user_pk },
        };
        return ret;
      } catch (err) {
        sqlite.WriteLog("getAuthorizeResponse WUSR: " + err, "WARN");
        const ret = {
          ocppresp: { status: "Invalid", expiryDate: expire },
          idtaginfo: { rfpk: null, upk: null },
        };
        return ret;
      }
    }
    // Real TAG
    const query =
      "SELECT `RT`.`rf_pk`,`RT`.`user`,`RT`.`blocked`,`RT`.`expire` " +
      "FROM `rfid_tags` AS `RT` " +
      "LEFT JOIN `charge_box` `CB` ON (`RT`.`site`=`CB`.`site`) " +
      "WHERE (`CB`.`cb_id`=? OR `RT`.`site` IS NULL) AND `RT`.`idtag`=?";
    try {
      const stmt = sqlite.db.prepare(query);
      const result = stmt.get(ocppid, idTag);
      // No result
      if (result === undefined) {
        const ret = {
          ocppresp: { status: "Invalid", expiryDate: expire },
          idtaginfo: { rfpk: null, upk: null },
        };
        return ret;
      }
      // Blocked
      if (result.blocked === 1) {
        const ret = {
          ocppresp: { status: "Blocked", expiryDate: expire },
          idtaginfo: { rfpk: result.rf_pk, upk: result.user },
        };
        return ret;
      }
      // Expired / Date now
      const now = Math.floor(Date.now() / 1000);
      if (result.expire !== null && result.expire < now) {
        const ret = {
          ocppresp: { status: "Expired", expiryDate: expire },
          idtaginfo: { rfpk: result.rf_pk, upk: result.user },
        };
        return ret;
      }
      // Expire not null
      if (result.expire !== null) {
        const tagexpdate = new Date(result.expire * 1000).toISOString();
        const ret = {
          ocppresp: { status: "Accepted", expiryDate: tagexpdate },
          idtaginfo: { rfpk: result.rf_pk, upk: result.user },
        };
        return ret;
      }
      // Retour normal
      const ret = {
        ocppresp: { status: "Accepted", expiryDate: expire },
        idtaginfo: { rfpk: result.rf_pk, upk: result.user },
      };
      return ret;
    } catch (err) {
      sqlite.WriteLog("getAuthorizeResponse IDTAG: " + err, "WARN");
      const ret = {
        ocppresp: { status: "Invalid", expiryDate: expire },
        idtaginfo: { rfpk: null, upk: null },
      };
      return ret;
    }
  }
  saveAuthorizeResponse(params) {
    const query = 'INSERT INTO `idtags_logs` (`cb_pk`,`ts`,`idtag`,`resp`,`method`) ' +
      'VALUES ((SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@ocppid),@ts,@idtag,@resp,@when)'
    return sqlite.sqliteRun('saveAuthorizeResponse', query, params)
  }
  /* client.handle('StartTransaction') */
  async generateTransactionId() {
    // Year-Day
    const today = new Date()
    const daynum = ((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(today.getFullYear(), 0, 0)) / 86400000)
    const ydstr = today.getUTCFullYear().toString().slice(-2) + ('000' + daynum).slice(-3)
    // Query
    try {
      let stmt = sqlite.db.prepare('SELECT MAX(`t_pk`) AS `max` FROM `transactions` WHERE `t_pk` LIKE ?')
      let res = stmt.get(ydstr + '%')
      // No Value
      if (res.max === null) {
        return parseInt(ydstr + '0001')
      } else {
        return (parseInt(res.max) + 1)
      }
    } catch(err) {
      sqlite.WriteLog('generateTransactionId: ' + err, 'WARN')
      return false
    }
  }
  async isChargerAutonomous(ocppid) {
    let stmt = sqlite.db.prepare('SELECT `cb_mode` FROM `charge_box` WHERE `cb_id`=?')
    try {
      let res = stmt.get(ocppid)
      if (res.cb_mode === 2) {
        return true
      }
      return false
    } catch(err) {
      sqlite.WriteLog('isChargerAutonomous: ' + err, 'WARN')
      return false
    }
  }
  async addTransaction(params) {
    try {
      /* Select Con_PK */
      const query = 'SELECT `pk` FROM `connector_status` WHERE `connector_id`=@conid AND '+
        '`cb_pk`=(SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@ocppid)'
      const stmtpk = sqlite.db.prepare(query)
      const con_data = stmtpk.get(params)
      if (con_data === undefined) {
        return false
      }
      try {
        const query = 'INSERT INTO `transactions` (`t_pk`,`con_pk`,`rfpk`,`upk`,`IdToken`,`meterStart`,`tsStart`,`tsStatus`) ' +
          'VALUES (@tpk,' + con_data.pk + ',@rfpk,@upk,@idtag,@meter,@start,@status)'
        const stmt = sqlite.db.prepare(query)
        stmt.run(params)
        return true
      } catch(err) {
        sqlite.WriteLog('addTransaction #2: ' + err, 'WARN')
        return false
      }
    } catch(err) {
      sqlite.WriteLog('addTransaction #1: ' + err, 'WARN')
      return false
   }
  }
  async initTransactionData(params) {
    const query = 'INSERT INTO `transactions_data` (`t_pk`,`data_ts`,`energy`) VALUES (@tpk,@ts,0)'
    return await sqlite.sqliteRun('initTransactionData', query, params)
  }
  /* client.handle('StopTransaction') */
  async stopTransaction(params) {
    const query = 'UPDATE `transactions` SET `meterStop`=@meter,`tsStop`=@stop,' +
    '`tsReason`=@reason,`tsEnergy`=@meter-`meterStart`,`tsPower`=@power WHERE `t_pk`=@tpk'
    return await sqlite.sqliteRun('stopTransaction', query, params)
  }
  /* client.handle('StopTransaction') / client.handle('MeterValues') */
  async addTransactionData(params) {
    const query = 'INSERT INTO `transactions_data` (`t_pk`,`data_ts`,`energy`,`power`,`poffer`,`ampl1`,`ampl2`,`ampl3`,`ampoffer`,`context`) ' +
      'VALUES (@tpk,@ts,@energy-(SELECT `meterStart` FROM `transactions` WHERE `t_pk`=@tpk),@power,@poffer,@ampl1,@ampl2,@ampl3,@ampoffer,@ctx)'
    return await sqlite.sqliteRun('addTransactionData', query, params)
  }
  /* client.handle('MeterValues') */
  updMeterValues(params) {
    try {
      let stmt = sqlite.db.prepare('UPDATE `connector_status` SET `energy`=@energy WHERE ' +
        '`cb_pk`=(SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@cbid) AND `connector_id`=@cnid')
      stmt.run(params)
      return true
    } catch(err) {
      sqlite.WriteLog('updMeterValues: ' + err, 'WARN')
      return false
    }
  }
  updTransactionMeterValues(params) {
    try {
      let stmt = sqlite.db.prepare('UPDATE `transactions` SET `tsEnergy`=@energy-`meterStart`, `tsPower`=@power WHERE `t_pk`=@tpk')
      stmt.run(params)
      return true
    } catch(err) {
      sqlite.WriteLog('updTransactionMeterValues: ' + err, 'WARN')
      return false
    }
  }
  /* Webui Action - client.GetConfiguration */
  async saveChargeBoxConfigKeys(ocppid, config) {
    try {
      // Statement
      let stmt = sqlite.db.prepare('INSERT INTO `charge_box_conf` (' +
        '`cb_pk`,`key`,`value`,`readonly`) VALUES '+
        '((SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@id),@key,@value,@readonly) ' +
        'ON CONFLICT(`cb_pk`,`key`) DO UPDATE SET ' +
        '`value`=excluded.value,`readonly`=excluded.readonly'
      )
      // Transaction
      let insertAll = sqlite.db.transaction((keys) => {
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
      sqlite.WriteLog('setChargeBoxConfigKeys: ' + err, 'WARN')
      return { error: new Error(`${err}`)}
    }
    return { status: 'Updated'}
  }
  /* Webui Action - client.SetConfiguration */
  async updChargeBoxConfigKey(params) {
    const query = 'UPDATE `charge_box_conf` SET `value`=@value ' +
      'WHERE `cb_pk`=(SELECT `cb_pk` FROM `charge_box` WHERE `cb_id`=@ocppName) AND `key`=@key'
    return await sqlite.sqliteRun('updChargeBoxConfigKey', query, params)
  }
  /* AUTOCONF TEST */
  /*
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
  */
}