import { fetchGraphQL, empty } from "./utils"
import * as AppConst from './constants'

// query contracts
const queryContracts = `
query MyQuery($list: [String!]) {
  fa2(where: {path: {_in: $list}}) {
    path
    contract
  }
}
`

var mappings = {}
async function getContracts(list) {
  let list_fa2 = list.filter(e => !mappings[e])
  if (empty(list_fa2)) return mappings
  const { errors, data } = await fetchGraphQL(queryContracts, 'MyQuery', { list: list })
  for (let fa2 of data.fa2) {
    mappings[fa2.path] = fa2.contract
  }
  return mappings
}

export async function urlToToken(url) {
  let data = await urlsToTokens(url)
  if (empty(data)) return
  else return data[0]
}

export function tokenIdParam(token_id) {
  token_id = String(token_id)
  if (empty(token_id)) return null
  let k = token_id.replace(/(\?.+)$/, '').split(/[:\/_]+/)
  if (k.length > 1) {
    let result = { fa2_id: k[k.length - 2], id: k[k.length - 1] }
    if (result.fa2_id == 'versum') result.fa2_id = AppConst.VERSUM_MINTER
    else if (result.fa2_id.match(/^(o|objkt|asset|hicetnunc)$/im)) result.fa2_id = AppConst.HEN_OBJKT
    return result
  }
  else return { fa2_id: AppConst.HEN_OBJKT, id: String(token_id) }
}

export function rewriteTokenId(token_id) {
  if (empty(token_id)) return null
  let k = tokenIdParam(token_id)
  if (k.fa2_id == AppConst.HEN_OBJKT) return k.id
  return `${k.fa2_id}_${k.id}`
}


export async function urlsToTokens(content) {
  let list = content.split(/[\s+]/ig).filter(e => !empty(e))
  let tokens = {}

  for (let url of list) {
    let item = { fa2_id: null, id: null, amount: 1 }
    if (url.match(/^https?:/)) {
      let m = url.match(/objkt\.com\/asset\/([^\/]+)\/([^\/\?&]+)/i)
      if (m && m.length > 0) {
        item.id = m[2]
        if (m[1] == 'hicetnunc') item.fa2_id = AppConst.HEN_OBJKT
        else item.fa2_id = m[1]
      }
      else {
        m = url.match(/rarible\.com\/.+\/(KT[^:\/]+)[:\/]+([^\/\?&]+)/i)
        if (m && m.length > 0) {
          item.fa2_id = m[1]
          item.id = m[2]
        }
        else {
          item.id = url.split('/').pop()
          if (item.id.match(/^[0-9]+$/)) {
            if (url.match(/fxhash\.xyz/)) item.fa2_id = AppConst.FXHASH_OBJKT
            else if (url.match(/versum\.xyz/)) item.fa2_id = AppConst.VERSUM_MINTER
            else item.fa2_id = AppConst.HEN_OBJKT
          }
          else continue // invalid HEN token
        }
      }
    }
    else item = tokenIdParam(url)
    item.uuid = `${item.fa2_id}_${item.id}`
    if (empty(tokens[item.uuid])) tokens[item.uuid] = item
    else tokens[item.uuid].amount += 1
  }

  // retrieve collections contracts
  let results = Object.values(tokens)
  let collections = results.map(e => e.fa2_id).filter(e => !e.match(/^KT.{34}$/))
  await getContracts(collections)
  for (let entry of results) {
    if (mappings[entry.fa2_id]) {
      entry.fa2_id = mappings[entry.fa2_id]
      entry.uuid = `${entry.fa2_id}_${entry.id}`
    }
  }
  return results
}
