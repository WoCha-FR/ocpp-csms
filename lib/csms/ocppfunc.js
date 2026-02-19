import { JSONFilePreset } from 'lowdb/node'
import CSMSDB from '../datas/csms-db.js'
import utils from '../helpers/utils.js'

// Pendings charge boxes
const pendingsFile = utils.rootdir() + '/datas/pendings.json'
export const ocppPendings = await JSONFilePreset(pendingsFile, { pendings: [] })
// OCPP Clients
export const ocppClients = new Map()
// OCPP Call logging
export function callResult(client, { outbound, method, params, result }) {
  // Vars
  let log_ts1 = Math.floor(Date.now())
  let log_ts2 = log_ts1 + 1
  // Out = false => params = Request in  / result = Response out
  if (outbound === false) {
    let input = {
      ocppid: client.identity,
      ts: log_ts1,
      direction: 'IN',
      type: 'REQUEST',
      methode: method,
      message: JSON.stringify(params),
    }
    let output = {
      ocppid: client.identity,
      ts: log_ts2,
      direction: 'OUT',
      type: 'RESPONSE',
      methode: method,
      message: JSON.stringify(result),
    }
    let data = [input, output]
    CSMSDB.addToLog(data)
    this.log.debug('IN: ' + JSON.stringify(input))
    this.log.debug('OUT: ' + JSON.stringify(output))
  }
  // Out = true  => params = Request out / result = Response in
  if (outbound === true) {
    let output = {
      ocppid: client.identity,
      ts: log_ts1,
      direction: 'OUT',
      type: 'REQUEST',
      methode: method,
      message: JSON.stringify(params),
    }
    let input = {
      ocppid: client.identity,
      ts: log_ts2,
      direction: 'IN',
      type: 'RESPONSE',
      methode: method,
      message: JSON.stringify(result),
    }
    let data = [input, output]
    CSMSDB.addToLog(data)
    this.log.debug('IN: ' + JSON.stringify(input))
    this.log.debug('OUT: ' + JSON.stringify(output))
  }
}
export function callError(client, { error, outbound, method }) {
  if (error.rpcErrorMessage === undefined) {
    let log_ts = Math.floor(Date.now())
    let errorCall = {
      ocppid: client.identity,
      ts: log_ts,
      methode: method,
      direction: outbound ? 'OUT' : 'IN',
      type: 'CALLERROR',
      message: `${error}`,
    }
    CSMSDB.addToLog([errorCall])
    this.log.debug(JSON.stringify(errorCall))
  }
}
export function svFailure(client, { outbound, isCall, method, error }) {
  let log_ts = Math.floor(Date.now())
  let errorCall = {
    ocppid: client.identity,
    ts: log_ts,
    methode: method,
    direction: outbound ? 'OUT' : 'IN',
    type: isCall ? 'REQUEST' : 'RESPONSE',
    message: `${error}`,
  }
  CSMSDB.addToLog([errorCall])
  this.log.debug(JSON.stringify(errorCall))
}
