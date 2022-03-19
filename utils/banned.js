
import { empty, apiAsyncRequest } from '../utils/utils'
import * as AppConst from '../utils/constants'

var bannedWallets = []
var bannedObjkts = []

export async function getBannedWallets() {
  if (empty(bannedWallets)) {
    let list = await apiAsyncRequest('https://raw.githubusercontent.com/hicetnunc2000/hicetnunc-reports/main/filters/w.json')
    if (!empty(list)) bannedWallets = list
  }
  return bannedWallets
}

export async function getBannedObjkts() {
  if (empty(bannedObjkts)) {
    let list = await apiAsyncRequest('https://raw.githubusercontent.com/hicetnunc2000/hicetnunc-reports/main/filters/o.json')
    if (!empty(list)) bannedObjkts = list.map(e => String(e))
  }
  return bannedObjkts
}

export async function getBanned() {
  await getBannedWallets()
  await getBannedObjkts()
  return { objkts: bannedObjkts, wallets: bannedWallets }
}

export function is_banned_objkt(token) {
  if (token.fa2_id && token.fa2_id != AppConst.HEN_OBJKT) return false
  if (bannedObjkts.includes(token.id)) return true
  else return false
}
