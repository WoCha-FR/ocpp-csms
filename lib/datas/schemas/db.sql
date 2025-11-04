/* Sites */
CREATE TABLE IF NOT EXISTS `sites` (
`s_pk` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
`s_name` TEXT(50) UNIQUE NOT NULL COLLATE NOCASE,
`s_address` TEXT(255),
`s_codp` INTEGER(5),
`s_ville` TEXT(150)
);
/* Users */
CREATE TABLE IF NOT EXISTS `users` (
`user_pk` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
`usermail` TEXT(320) UNIQUE NOT NULL COLLATE NOCASE,
`password` TEXT(60) NOT NULL,
`name` TEXT(50) DEFAULT NULL COLLATE NOCASE,
`isAdmin` INTEGER(1) DEFAULT(0) CHECK (`isAdmin` IN (0, 1)),
`ownedSite` INTEGER DEFAULT NULL REFERENCES `sites` (`s_pk`) ON DELETE SET NULL
);
/* Users of Sites */
CREATE TABLE IF NOT EXISTS `sites_users` (
`pk` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
`spk` INTEGER NOT NULL REFERENCES `sites` (`s_pk`) ON DELETE CASCADE,
`upk` INTEGER NOT NULL REFERENCES `users` (`user_pk`) ON DELETE CASCADE,
`uname` TEXT (50) NOT NULL
);
CREATE UNIQUE INDEX `site_user_UNIQUE` ON `sites_users` (`spk`,`upk`);
/* RFID Tags */
CREATE TABLE IF NOT EXISTS `rfid_tags` (
`rf_pk` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
`site` INTEGER DEFAULT NULL REFERENCES `sites` (`s_pk`) ON DELETE CASCADE,
`idtag` TEXT(20) NOT NULL COLLATE NOCASE,
`rf_name` TEXT(50) NOT NULL,
`user` INTEGER DEFAULT NULL REFERENCES `users` (`user_pk`) ON DELETE SET NULL,
`blocked` INTEGER(1) DEFAULT(0) CHECK (`blocked` IN (0, 1)),
`expire` TIMESTAMP(11) NULL DEFAULT NULL
);
CREATE UNIQUE INDEX `site_rfid_tags_UNIQUE` ON `rfid_tags` (`site`,`idtag` COLLATE NOCASE);
/* Charge_Box */
CREATE TABLE IF NOT EXISTS `charge_box` (
`cb_pk` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
`cb_id` TEXT(75) NOT NULL CONSTRAINT `cbid_UNIQUE` UNIQUE,
`cb_name` TEXT(75) NOT NULL CONSTRAINT `cbname_UNIQUE` UNIQUE COLLATE NOCASE,
`cb_pwd` TEXT(75) DEFAULT NULL,
`registration_status` TEXT(20) NOT NULL DEFAULT 'Accepted',
`last_heartbeat_ts` TIMESTAMP(11) NULL DEFAULT NULL,
`last_bootnotif_ts` TIMESTAMP(11) NULL DEFAULT NULL,
`online` INTEGER(1) DEFAULT(2) NOT NULL CHECK (`online` IN (0, 1, 2)),
`site` INTEGER DEFAULT NULL REFERENCES `sites` (`s_pk`) ON DELETE SET NULL,
`cb_mode` INTEGER(1) DEFAULT(1) NOT NULL CHECK (`cb_mode` IN (0, 1, 2))
);
/* Charge_Box_Infos */
CREATE TABLE IF NOT EXISTS `charge_box_infos` (
`pk` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
`cb_pk` INTEGER REFERENCES `charge_box` (`cb_pk`) ON DELETE CASCADE ON UPDATE CASCADE UNIQUE,
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
`ocpp_protocol` TEXT(20) DEFAULT NULL
);
/* Charge_Box_Conf */
CREATE TABLE IF NOT EXISTS `charge_box_conf` (
`pk` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
`cb_pk` INTEGER REFERENCES `charge_box` (`cb_pk`) ON DELETE CASCADE ON UPDATE CASCADE,
`key` TEXT(50) NOT NULL,
`value` TEXT(255) DEFAULT NULL,
`readonly` INTEGER(1) DEFAULT(1) CHECK (`readonly` IN (0, 1))
);
CREATE UNIQUE INDEX `OneKeyPerCB` ON `charge_box_conf` (`cb_pk`,`key`);
/* Charge_Box_Log */
CREATE TABLE IF NOT EXISTS `charge_box_log` (
`pk` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
`cb_pk` INTEGER REFERENCES `charge_box` (`cb_pk`) ON DELETE CASCADE ON UPDATE CASCADE,
`timestamp` TIMESTAMP(14) NOT NULL,
`direction` TEXT(3) NOT NULL CHECK (`direction` IN ('IN', 'OUT')),
`type` TEXT(10) DEFAULT NULL CHECK (`type` IN ('REQUEST', 'RESPONSE','CALLERROR')),
`method` TEXT(50) DEFAULT NULL COLLATE NOCASE,
`message` TEXT NOT NULL
);
CREATE INDEX `logs_cb_pk` ON `charge_box_log` (`cb_pk`);
/* Connector_Status */
CREATE TABLE IF NOT EXISTS `connector_status` (
`pk` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
`cb_pk` INTEGER REFERENCES `charge_box` (`cb_pk`) ON DELETE CASCADE ON UPDATE CASCADE,
`connector_id` INTEGER(1) NOT NULL CHECK (`connector_id` BETWEEN 1 AND 9),
`status_ts` TIMESTAMP(11) NULL DEFAULT NULL,
`status` TEXT(25) DEFAULT NULL,
`error_code` TEXT(25) DEFAULT NULL,
`error_info` TEXT(50) DEFAULT NULL COLLATE NOCASE,
`vendor_id` TEXT(25) DEFAULT NULL COLLATE NOCASE,
`vendor_error_code` TEXT(50) DEFAULT NULL COLLATE NOCASE,
`energy` INTEGER DEFAULT NULL,
`cname` TEXT(50) DEFAULT NULL,
`maxPower` INTEGER(3) DEFAULT NULL,
`format` INTEGER(1) DEFAULT(1) CHECK(`format` IN (1, 2)),
`type` INTEGER(1) DEFAULT(1)
);
CREATE UNIQUE INDEX `OneConnXperCB` ON `connector_status` (`cb_pk`,`connector_id`);
/* TRANSACTIONS */
CREATE TABLE IF NOT EXISTS `transactions` (
`t_pk` INTEGER PRIMARY KEY NOT NULL,
`con_pk` INTEGER REFERENCES `connector_status` (`pk`) ON DELETE CASCADE ON UPDATE CASCADE,
`IdToken` TEXT(20) NOT NULL COLLATE NOCASE,
`meterStart` INTEGER NOT NULL,
`tsStart` TIMESTAMP(11) NOT NULL,
`tsStatus` TEXT(10) NOT NULL COLLATE NOCASE,
`meterStop` INTEGER DEFAULT NULL,
`tsStop` TIMESTAMP(11) DEFAULT NULL,
`tsReason` TEXT(20) DEFAULT NULL,
`tsEnergy` INTEGER(10) DEFAULT NULL,
`tsPower` INTEGER(10) DEFAULT NULL
);
/* TRANSACTION DATA */
CREATE TABLE IF NOT EXISTS `transactions_data` (
`pk` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
`t_pk` REFERENCES `transactions` (`t_pk`) ON DELETE CASCADE ON UPDATE CASCADE,
`data_ts` TIMESTAMP (11) NOT NULL,
`power` INTEGER (10),
`energy` INTEGER (10)
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
/* Schema_Version in last => prevent failure */
CREATE TABLE IF NOT EXISTS `schema_version` (
`schema_pk` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
`version` TEXT(10)
);
/* Initial Values */
BEGIN TRANSACTION;
INSERT INTO `schema_version` (`version`) VALUES ('0.1.0');
INSERT INTO `users` (`usermail`,`password`,`name`,`isAdmin`) VALUES ('admin@admin.eu','$2b$10$FTdLTiTsGV81/PcjArPmB.izN7RPXT3t93O0LoIGXZDovyOf178cy','Admin',1);
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('AllowOfflineTxForUnknownId', NULL, 0, 'b', NULL);
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('AuthorizeRemoteTxRequests', '', 0, 'b', NULL);
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('ClockAlignedDataInterval', NULL, 0, 'i', 'SEC');
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('ConnectionTimeOut', NULL, 0, 'i', 'SEC');
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('HeartbeatInterval', '3600', 1, 'i', 'SEC');
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('LocalAuthorizeOffline', NULL, 0, 'b', NULL);
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('LocalPreAuthorize', NULL, 0, 'b', NULL);
INSERT INTO `ocpp_default_conf` (`key`, `value`, `enabled`, `type`, `unit`) VALUES ('MeterValueSampleInterval', '300', 0, 'i', 'SEC');
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