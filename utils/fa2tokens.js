import { empty, fetchGraphQL, fetchObjQL, showError } from '../utils/utils'
import { is_hen } from '../utils/links'

import * as AppConst from '../utils/constants'

var last_network_error = null
var network_errors_count = 0

const query_live_objkt = `
  query qryNftBiker($list: [String!]) {
    token(where: {uuid: { _in: $list }}) {
      id
      pk_id
      uuid
      fa2_id
      title
      supply
      mime
      royalties
      display_uri
      thumbnail_uri
      artifact_uri
      timestamp
      creator_id
      creator {
        address
        name
        twitter
      }
    }
  }
`

const query_fa2 = `
query qryNftBiker($conditions: [token_bool_exp!] = [], $with_holders: Boolean = false) {
  token(where: {_or: $conditions}) {
    id: token_id
    fa2_id: fa_contract
    title: name
    supply
    mime
    display_uri
    thumbnail_uri
    artifact_uri
    timestamp
    royalties {
      amount
      decimals
    }
    creators {
      holder {
        address
        name: alias
        twitter
      }
    }
    token_holders:holders @include(if: $with_holders) {
      holder_id:holder_address
      quantity
    }
  }
}
`

const query_creators = `
query qryNftBiker($conditions: [token_bool_exp!] = []) {
  token(where: { _or: $conditions }) {
    uuid
    creator_id
  }
}
`

export function buildFA2Conditions(tokens, all) {
  let conditions = {}
  if (empty(all)) all = false
  if (empty(tokens)) return []

  tokens.forEach(t => {
    if (t.fa2_id && (all || !AppConst.LOCAL_OBJKT.includes(t.fa2_id))) {
      let uuid = `${t.fa2_id}_${t.id}`
      if (empty(conditions[uuid])) conditions[uuid] = {
        id: { _eq: String(t.id) },
        fa2_id: { _eq: String(t.fa2_id) }
      }
    }
  })
  return Object.values(conditions)
}

function buildFA2ObjktConditions(tokens, all) {
  let conditions = {}
  if (empty(all)) all = false
  if (empty(tokens)) return []

  tokens.forEach(t => {
    if (t.fa2_id && (all || !AppConst.LOCAL_OBJKT.includes(t.fa2_id))) {
      let uuid = `${t.fa2_id}_${t.id}`
      if (empty(conditions[uuid])) conditions[uuid] = {
        token_id: { _eq: String(t.id) },
        fa_contract: { _eq: String(t.fa2_id) }
      }
    }
  })
  return Object.values(conditions)
}

export async function getAllTokens(tokens, options) {
  if (empty(options)) options = {}
  let hen = await getLiveObjkts(tokens, options)
  if (hen.constructor != Array) {
    try { showError(hen.errors) } catch (e) { }
    hen = []
  }
  // we retrieve data from objkt api only for tokens not found in our api
  let list = tokens.filter(t => {
    return !hen.find(e => e.uuid == t.uuid)
  })
  if (empty(list)) return hen

  let bid = await getFA2Tokens(list)
  if (hen.constructor == Array) {
    if (bid.constructor == Array) return hen.concat(bid)
    else return hen
  }
  else if (bid.constructor == Array) return bid
  else return []
}

export async function getFA2Tokens(tokens, with_holders = false) {
  let conditions = buildFA2ObjktConditions(tokens, false)
  if (empty(conditions)) return []
  const { errors, data } = await fetchObjQL(query_fa2, "qryNftBiker", { "conditions": conditions, "with_holders": with_holders }, {
    objkt_request: true
  })
  if (errors) {
    console.error('Unable to get FA2token from objkt.com API', errors[0])
    return []
  }
  let results = data.token;
  if (empty(results)) return [];
  return results.map(t => {
    t.collection = t.fa2_id != AppConst.HEN_OBJKT
    let creator = t.creators[0]?.holder
    if (!empty(creator)) {
      t.creator_id = creator.address
      t.creator = creator
    }
    else {
      t.creator_id = t.fa2_id
      t.creator = { address: t.fa2_id }
    }

    let royalties = t.royalties.map(e => { return (e.amount * Math.pow(10, -e.decimals).round(e.decimals)) * 1000 })
    t.royalties = royalties.reduce((a, b) => a + b, 0)

    t.uuid = `${t.fa2_id}_${t.id}`
    return t
  });
}

export async function getLiveObjkt(objkt, options) {
  let result = null
  if (AppConst.LOCAL_OBJKT.includes(objkt.fa2_id)) {
    result = await getLiveObjkts([objkt], options);
  }
  else {
    result = await getFA2Tokens([objkt])
  }

  if (empty(result)) return {};
  else if (Array.isArray(result)) return result[0]
  else if (options?.errors) return result
  else return {};
}

export async function getLiveObjkts(tokens, options) {
  if (empty(tokens)) return []
  if (typeof (options) == 'undefined') options = {}
  options.objkt_request = true
  // when there is a network error, we recheck regularly
  let alternative = empty(options.alternative) ? false : options.alternative
  if (alternative) {
    // we recheck every 5 minutes
    options.alternative_api = (last_network_error && last_network_error >= (Math.floor(Date.now() / 1000) - 360))
    if (!options.alternative_api) last_network_error = null
  }

  try {
    let list = []
    list = tokens.filter(e => is_hen(e)).map(e => e.uuid).filter(e => e)

    const { errors, data } = await fetchGraphQL(query_live_objkt, "qryNftBiker", { "list": list }, options);
    if (errors) {
      if (empty(options.retried) || !options.retried) {
        network_errors_count += 1
        if (network_errors_count >= 5 && !last_network_error) last_network_error = Math.floor(Date.now() / 1000)
        if (alternative && !options.alternative_api) {
          options.alternative_api = true
          options.alternative = false
          options.retried = true
          return getLiveObjkts(tokens, options)
        }
      }
      if (options.errors) return { errors: errors }
      else return []
    }
    else if (!options.alternative_api) {
      last_network_error = null
      network_errors_count = 0
    }
    let result = data.token;
    if (empty(result)) return [];
    result.map(t => t.collection = t.fa2_id != AppConst.HEN_OBJKT)
    return result;
  } catch (e) {
    console.log('Graphql objkts fetch error')
    console.log(e)
    return []
  }
}
