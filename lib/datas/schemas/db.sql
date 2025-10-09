/* Users */
CREATE TABLE IF NOT EXISTS `users` (
`user_pk` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
`username` TEXT(50) UNIQUE NOT NULL COLLATE NOCASE,
`password` TEXT(60) NOT NULL,
`name` TEXT(50) DEFAULT NULL COLLATE NOCASE,
`email` TEXT UNIQUE NOT NULL,
`level` INTEGER(1) DEFAULT(3) CHECK (`level` IN (1, 2, 3))
);
/* Sites */
CREATE TABLE IF NOT EXISTS `sites` (
`s_pk` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
`s_name` TEXT(50) UNIQUE NOT NULL COLLATE NOCASE,
`s_address` TEXT(255),
`s_codp`    INTEGER(5),
`s_ville`   TEXT(150)
);
/* Charge_Box */
CREATE TABLE IF NOT EXISTS `charge_box` (
`cb_pk` INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
`cb_id` TEXT(75) NOT NULL CONSTRAINT `cbid_UNIQUE` UNIQUE COLLATE NOCASE,
`cb_name` TEXT(75) NOT NULL CONSTRAINT `cbname_UNIQUE` UNIQUE COLLATE NOCASE,
`cb_pwd` TEXT(75) DEFAULT NULL,
`registration_status` TEXT(20) NOT NULL DEFAULT 'Accepted',
`last_heartbeat_ts` TIMESTAMP(11) NULL DEFAULT NULL,
`last_bootnotif_ts` TIMESTAMP(11) NULL DEFAULT NULL,
`online` INTEGER(1) DEFAULT(2) NOT NULL CHECK (`online` IN (0, 1, 2)),
`site` INTEGER DEFAULT(1) CONSTRAINT `FK_Site_ChargeBox` REFERENCES `sites` (`s_pk`) ON DELETE SET DEFAULT ON UPDATE NO ACTION,
`cb_mode` INTEGER(1) DEFAULT(1) NOT NULL CHECK (`cb_mode` IN (0, 1))
);
/* Charge_Box_Infos */
CREATE TABLE IF NOT EXISTS `charge_box_infos` (
`cb_id` TEXT(75) NOT NULL CONSTRAINT `FK_conf_charge_box_cbid` REFERENCES `charge_box` (`cb_id`) ON DELETE CASCADE ON UPDATE NO ACTION COLLATE NOCASE,
`cp_vendor` TEXT(20) DEFAULT NULL COLLATE NOCASE,
`cp_model` TEXT(20) DEFAULT NULL COLLATE NOCASE,
`cp_serial_number` TEXT(25) DEFAULT NULL COLLATE NOCASE,
`cb_serial_number` TEXT(25) DEFAULT NULL COLLATE NOCASE,
`fw_version` TEXT(50) DEFAULT NULL COLLATE NOCASE,
`iccid` TEXT(20) DEFAULT NULL COLLATE NOCASE,
`imsi` TEXT(20) DEFAULT NULL COLLATE NOCASE,
`meter_type` TEXT(25) DEFAULT NULL COLLATE NOCASE,
`meter_serial_number` TEXT(25) DEFAULT NULL COLLATE NOCASE,
`endpoint_address` TEXT(75) DEFAULT NULL,
`ocpp_protocol` TEXT(20) DEFAULT NULL,
PRIMARY KEY (`cb_id`)
);
/* Charge_Box_Conf */
CREATE TABLE IF NOT EXISTS `charge_box_conf` (
`cb_id` TEXT(75) NOT NULL CONSTRAINT `FK_conf_charge_box_cbid` REFERENCES `charge_box` (`cb_id`) ON DELETE CASCADE ON UPDATE NO ACTION COLLATE NOCASE,
`key` TEXT(50) NOT NULL,
`value` TEXT(255) DEFAULT NULL,
`readonly` INTEGER(1) DEFAULT(1) CHECK (`readonly` IN (0, 1)),
PRIMARY KEY (`cb_id`,`key`)
);
/* OCPP_Default_Conf */
CREATE TABLE IF NOT EXISTS `ocpp_default_conf` (
`cfg_pk` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
`key` TEXT(50) UNIQUE NOT NULL,
`value` TEXT(255) DEFAULT NULL,
`enabled` INTEGER(1) DEFAULT(0) CHECK (`enabled` IN (0, 1)),
`type` TEXT(1) DEFAULT ('s') CHECK (`type` IN ('s', 'i', 'b')),
`unit` TEXT(5) DEFAULT NULL
);
CREATE INDEX `defconf_enabled` ON `ocpp_default_conf` (`enabled` ASC);
/* Charge_Box_Log */
CREATE TABLE IF NOT EXISTS `charge_box_log` (
`log_pk` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
`cb_id` TEXT(75) NOT NULL CONSTRAINT `FK_logs_charge_box_cbid` REFERENCES `charge_box` (`cb_id`) ON DELETE CASCADE ON UPDATE NO ACTION COLLATE NOCASE,
`timestamp` TIMESTAMP(14) NOT NULL,
`direction` TEXT(3) NOT NULL CHECK (`direction` IN ('IN', 'OUT')),
`type` TEXT(10) DEFAULT NULL CHECK (`type` IN ('REQUEST', 'RESPONSE','CALLERROR')),
`method` TEXT(50) DEFAULT NULL COLLATE NOCASE,
`message` TEXT NOT NULL
);
CREATE INDEX `logs_cb_id` ON `charge_box_log` (`cb_id`);
/* Schema_Version */
CREATE TABLE IF NOT EXISTS `schema_version` (
`schema_pk` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
`version` TEXT(10)
);
/* Connector_Status */
CREATE TABLE IF NOT EXISTS `connector_status` (
`cb_id` TEXT(75) NOT NULL CONSTRAINT `FK_connector_charge_box_cbid` REFERENCES `charge_box` (`cb_id`) ON DELETE CASCADE ON UPDATE NO ACTION COLLATE NOCASE,
`connector_id` INTEGER(1) NOT NULL CHECK (`connector_id` < 10),
`status_ts` TIMESTAMP(11) NULL DEFAULT NULL,
`status` TEXT(25) DEFAULT NULL,
`error_code` TEXT(25) DEFAULT NULL,
`error_info` TEXT(50) DEFAULT NULL COLLATE NOCASE,
`vendor_id` TEXT(25) DEFAULT NULL COLLATE NOCASE,
`vendor_error_code` TEXT(50) DEFAULT NULL COLLATE NOCASE,
`energy` INTEGER DEFAULT NULL,
PRIMARY KEY (`cb_id`,`connector_id`)
);
CREATE INDEX `connector_status_cpk_st_idx` ON `connector_status` (`cb_id`,`connector_id`,`status_ts`);
/* RFID Tags */
CREATE TABLE IF NOT EXISTS `rfid_tags` (
`rf_pk` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
`owner` INTEGER NOT NULL CONSTRAINT `FK_rfid_Owner` REFERENCES `users` (`user_pk`) ON DELETE CASCADE ON UPDATE NO ACTION,
`idtag` TEXT(20) DEFAULT NULL COLLATE NOCASE,
`infos` TEXT(50) DEFAULT NULL,
`user` INTEGER DEFAULT NULL CONSTRAINT `FK_rfid_User` REFERENCES `users` (`user_pk`) ON DELETE SET NULL ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX `owner_rfid_tags_UNIQUE` ON `rfid_tags` (`owner`,`idtag`);
/* Charge Box RFIDS Status */
CREATE TABLE IF NOT EXISTS `charge_box_rfids` (
`cr_pk` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
`cb_id` TEXT(75) NOT NULL CONSTRAINT `FK_connector_charge_box_cbid` REFERENCES `charge_box` (`cb_id`) ON DELETE CASCADE ON UPDATE NO ACTION COLLATE NOCASE,
`rf_pk` INTEGER NOT NULL CONSTRAINT `FK_charge_box_rfid` REFERENCES `rfid_tags` (`rf_pk`) ON DELETE CASCADE ON UPDATE NO ACTION,
`expire` TIMESTAMP(11) NULL DEFAULT NULL,
`blocked` INTEGER(1) DEFAULT(0) CHECK (`blocked` IN (0, 1))
);
CREATE UNIQUE INDEX `chargebox_rfid_tags_UNIQUE` ON `charge_box_rfids` (`cb_id`,`rf_pk`);
/* TRANSACTIONS */
CREATE TABLE IF NOT EXISTS `transactions` (
`t_pk` INTEGER PRIMARY KEY NOT NULL,
`cb_id` TEXT(75) NOT NULL CONSTRAINT `FK_transaction_charge_box_id` REFERENCES `charge_box` (`cb_id`) ON DELETE CASCADE ON UPDATE NO ACTION COLLATE NOCASE,
`con_id` INTEGER(1) NOT NULL CHECK (`con_id` > 0 AND `con_id` < 10),
`IdToken` TEXT(20) NOT NULL COLLATE NOCASE,
`meterStart` INTEGER NOT NULL,
`tsStart` TIMESTAMP(11) NOT NULL,
`status` TEXT(10) NOT NULL COLLATE NOCASE,
`meterStop` INTEGER DEFAULT NULL,
`tsStop` TIMESTAMP(11) DEFAULT NULL,
`reason` TEXT(20) DEFAULT NULL,
`energy` INTEGER DEFAULT NULL,
`power` INTEGER DEFAULT NULL
);
CREATE INDEX `charge_box_connector_idx` ON `transactions` (`cb_id`,`con_id`);
/* Initial Values */
BEGIN TRANSACTION;
INSERT INTO `schema_version` (`version`) VALUES ('0.1.0');
INSERT INTO `users` (`username`,`password`,`name`,`level`,`email`) VALUES ('admin','$2b$10$FTdLTiTsGV81/PcjArPmB.izN7RPXT3t93O0LoIGXZDovyOf178cy','Admin',1,'admin@admin.eu');
INSERT INTO `sites` (`s_pk`,`s_name`) VALUES (1,`Parking`);
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('AllowOfflineTxForUnknownId', NULL, 0, 'b', NULL);
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('AuthorizeRemoteTxRequests', '', 0, 'b', NULL);
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('ClockAlignedDataInterval', NULL, 0, 'i', 'SEC');
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('ConnectionTimeOut', NULL, 0, 'i', 'SEC');
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('HeartbeatInterval', '21600', 1, 'i', 'SEC');
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('LocalAuthorizeOffline', NULL, 0, 'b', NULL);
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('LocalPreAuthorize', NULL, 0, 'b', NULL);
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('MeterValueSampleInterval', NULL, 0, 'i', 'SEC');
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('MeterValuesAlignedData', NULL, 0, 's', NULL);
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('MeterValuesSampledData', 'Energy.Active.Import.Register', 0, 's', NULL);
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('ResetRetries', NULL, 0, 'i', 'TIM');
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('StopTransactionOnEVSideDisconnect', NULL, 0, 'b', NULL);
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('StopTxnAlignedData', NULL, 0, 's', NULL);
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('StopTxnSampledData', 'Energy.Active.Import.Register', 0, 's', NULL);
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('TransactionMessageAttempts', NULL, 0, 'i', 'TIM');
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('TransactionMessageRetryInterval', NULL, 0, 'i', 'SEC');
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('UnlockConnectorOnEVSideDisconnect', NULL, 0, 'b', NULL);
COMMIT TRANSACTION;