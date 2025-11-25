/* eslint-disable no-unused-vars */
// Profiles from SupportedFeatureProfiles
// Core
// Firmware Management          => GetDiag && UpdateFirmware
// Local Auth List Management   => GetList
// Reservation
// RemoteTrigger                => Trigger Message
// Smart Charging
const coreProfile = {
  AuthorizeRemoteTxRequests: 'bool', // R or RW. Choice is up to Charge Point implementation.
  ClockAlignedDataInterval: 'int', // seconds
  ConnectionTimeOut: 'int', // seconds
  HeartbeatInterval: 'int', // seconds
  LocalAuthorizeOffline: 'bool',
  LocalPreAuthorize: 'bool',
  MeterValuesAlignedData: 'CSL',
  MeterValuesSampledData: 'CSL',
  MeterValueSampleInterval: 'int', // seconds
  ResetRetries: 'int', // times
  ConnectorPhaseRotation: 'CSL', // 0.RST, 1.RST, 2.RTS
  StopTransactionOnEVSideDisconnect: 'bool',
  StopTransactionOnInvalidId: 'bool',
  StopTxnAlignedData: 'CSL',
  StopTxnSampledData: 'CSL',
  TransactionMessageAttempts: 'int', // times
  TransactionMessageRetryInterval: 'int', // seconds
  UnlockConnectorOnEVSideDisconnect: 'bool'
}

const LocalAuth = {
  LocalAuthListEnabled: 'bool'
}

/*
Allowable values of the optional "measurand" field of a Value element, as used in MeterValues.req and
StopTransaction.req messages.
Default value of "measurand" is always "Energy.Active.Import.Register"
Value                             Description
Current.Export                    Instantaneous current flow from EV
Current.Import                    Instantaneous current flow to EV
Current.Offered                   Maximum current offered to EV
Energy.Active.Export.Register     Energy exported by EV (Wh or kWh)
Energy.Active.Import.Register     Energy imported by EV (Wh or kWh)
Energy.Reactive.Export.Register   Reactive energy exported by EV (varh or kvarh)
Energy.Reactive.Import.Register   Reactive energy imported by EV (varh or kvarh)
Energy.Active.Export.Interval     Energy exported by EV (Wh or kWh)
Energy.Active.Import.Interval     Energy imported by EV (Wh or kWh)
Energy.Reactive.Export.Interval   Reactive energy exported by EV. (varh or kvarh)
Energy.Reactive.Import.Interval   Reactive energy imported by EV. (varh or kvarh)
Frequency                         Instantaneous reading of powerline frequency
Power.Active.Export               Instantaneous active power exported by EV. (W or kW)
Power.Active.Import               Instantaneous active power imported by EV. (W or kW)
Power.Factor                      Instantaneous power factor of total energy flow
Power.Offered                     Maximum power offered to EV
Power.Reactive.Export             Instantaneous reactive power exported by EV. (var or kvar)
Power.Reactive.Import             Instantaneous reactive power imported by EV. (var or kvar)
RPM                               Fan speed in RPM
SoC                               State of charge of charging vehicle in percentage
Temperature                       Temperature reading inside Charge Point.
Voltage                           Instantaneous AC RMS supply voltage.
*/