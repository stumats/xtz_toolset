import ReactDOM from 'react-dom'
import $ from 'jquery'
import * as AppConst from './constants'
import TimeAgo from 'timeago-react'
import { shorten_wallet } from './links'
import axios from 'axios'
import { getFA2Tokens } from './fa2tokens'

// definitions
export var artistsNotFound = []

export const urlParams = (typeof window !== 'undefined') ? new URLSearchParams(window.location.search) : new URLSearchParams
export const language = (typeof window !== 'undefined') ? (window.navigator.language || window.navigator.userLanguage) : 'en'

const historyDateFormat = new Intl.DateTimeFormat(language, { month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: 'numeric', hour12: false })
const dateFormat = new Intl.DateTimeFormat(language, { month: 'numeric', day: 'numeric', year: '2-digit' })
const shortFormat = new Intl.DateTimeFormat(language, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false })
const extendedFormat = new Intl.DateTimeFormat(language, { month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false })
const numberFormat = new Intl.NumberFormat('en')


const query_subjkts = `
query qryNftBiker($name: String!) {
  holder(where: { name: {_ilike: $name}}) {
    address
    name
    metadata
  }
}
`

const query_names = `
query qryNftBiker($wallets: [String!]) {
  holder(where: { address: {_in: $wallets}}) {
    address
    name
  }
}
`

const query_names_with_purchases = `
query qryNftBiker($wallets: [String!]) {
  holder(where: { address: {_in: $wallets}}) {
    address
    name
    purchases_aggregate {
      aggregate {
        count(columns: token_id, distinct: true)
      }
    }
    sales_aggregate {
      aggregate {
        count(columns: token_id, distinct: true)
      }
    }
  }
}
`

const query_objkts = `
  query qryNftBiker($token: [bigint!]) {
    token(where: {pk_id: { _in: $token }}) {
      id
      uuid
      pk_id
      fa2_id
      balance
      price
      title
      supply
      royalties
      mime
      display_uri
      thumbnail_uri
      artifact_uri
      moderated
      locked_seconds
      timestamp
      creator_id
      creator {
        address
        name
      }
    }
  }
`

const query_objkts_by_id = `
  query qryNftBiker($token: [bigint!]) {
    token(where: {pk_id: { _in: $token }}) {
      id
      uuid
      pk_id
      fa2_id
      balance
      price
      title
      supply
      royalties
      mime
      display_uri
      thumbnail_uri
      artifact_uri
      moderated
      locked_seconds
      timestamp
      creator_id
      creator {
        address
        name
      }
    }
  }
`

const query_single_objkt = `
  query qryNftBiker($id: String!, $fa2: String!) {
    token(where: {id: { _eq: $id }, fa2_id: {_eq: $fa2 }}) {
      id
      pk_id
      fa2_id
      title
      balance
      price
      supply
      royalties
      mime
      display_uri
      thumbnail_uri
      artifact_uri
      moderated
      locked_seconds
      timestamp
      creator_id
      creator {
        address
        name
      }
    }
  }
`

export const Artists = {
  list: {},
  loaded: false,
  add: (key, value) => {
    if (!empty(key)) Artists.list[key] = empty(value) ? null : value
  },
  exists: (key) => {
    return (Artists.list[key] !== undefined)
  },
  get: (key) => {
    return Artists.list[key]
  },
  reset: () => {
    Artists.list = {}
  },
  getWallets: () => {
    return Object.keys(Artists.list)
  }
}

Number.prototype.round = function (places) {
  return +(Math.round(this + "e+" + places) + "e-" + places);
}
TimeAgo.defaultProps.live = false
TimeAgo.defaultProps.className = 'timeago'

export function empty(val) {
  if (typeof (val) == 'undefined') return true;
  else if (val == undefined) return true
  else if (val == null) return true;
  else if (val.constructor == Array && val.length === 0) return true;
  else if (val.constructor == Object && Object.keys(val).length === 0) return true;
  else if (String(val).trim().length == 0) return true;
  else if (val == 'undefined' || val == 'null') return true;
  return false;
}

export function fa2_to_platform(uuid) {
  if (empty(uuid)) return 'hen'
  let data = uuid.split('_')
  if (data.length > 1) {
    let fa2 = data[0]
    if (fa2 == AppConst.VERSUM_MINTER) return 'versum'
    else if (fa2 == AppConst.FXHASH_OBJKT) return 'fxhash'
    else if (fa2 == AppConst.HEN_OBJKT) return 'hen'
    else return 'bid'
  }
  else return 'hen'
}

export function platform_name(val) {
  if (val == 'versum') return 'Versum'
  else if (val == 'bid') return 'ObjktV1'
  else if (val == 'bid2') return 'ObjktV2'
  else if (val == 'rarible') return 'Rarible'
  else if (val == 'fxhash') return 'FxHash'
  else if (val == 'teia') return 'Teia'
  else return 'HEN'
}

export function shuffleArray(array) {
  var m = array.length,
    t, i;

  // While there remain elements to shuffle…
  while (m) {
    // Pick a remaining element…
    i = Math.floor(Math.random() * m--);
    // And swap it with the current element.
    t = array[m];
    array[m] = array[i];
    array[i] = t;
  }
  return array;
}

export function changeInputWithTrigger(domId, value) {
  const input = document.getElementById(domId);
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  nativeSetter.call(input, value)
  var event = new Event('input', { bubbles: true });
  input.dispatchEvent(event)
}

export function update_by_artist(name, missing, collection = false) {
  let val = empty(name) ? missing : name
  if (!empty(val)) val = collection ? ` from collection ${val}` : `by ${val}`
  document.getElementById("by_artist").innerHTML = val
}

export function update_current_href() {
  let refresh = window.location.protocol + "//" + window.location.host + window.location.pathname + '?' + urlParams.toString();
  window.history.pushState({
    path: refresh
  }, '', refresh);
}

export function proper_value(val) {
  if (empty(val)) return null;
  return val;
}

export function get_wallet(options) {
  if (empty(options)) options = {}
  let input = document.getElementById("wallet")
  let wallet = input ? input.value : null
  if (empty(wallet)) wallet = urlParams.get("wallet")

  if (options.multiple) return wallet.split(/[,\s]+/im).filter(e => !empty(e))
  else return wallet;
}

export function can_mint(token) {
  if (token.moderated) return false
  if (token.locked_seconds && token.locked_seconds > 0) {
    let min_time = new Date(token.timestamp)
    min_time.setSeconds(min_time.getSeconds() + token.locked_seconds);
    if (min_time > new Date()) return false
  }
  return true
}

export function setUid(token) {
  if (empty(token.uuid)) token.uuid = `${token.fa2_id}_${token.id}`
  return token
}

export async function extractTrades(tokens, options) {
  if (empty(options)) options = {}
  let wallet = get_wallet();


  let data = options.per_token ? [] : {
    swaps: [],
    trades: [],
    asks: [],
    filled: [],
    bids: [],
    english: [],
  }

  for (let token of tokens) {
    if (empty(token.uuid)) setUid(token)
    if (options.per_token) token = Object.assign({ swaps: [], trades: [] }, token)

    if (!empty(token.asks)) for (let item of token.asks) {
      item = Object.assign({}, item)
      item.type = 'ask'
      if (empty(item.platform)) item.platform = 'bid'
      else if (item.platform.match(/^hen/i)) item.platform = 'hen'
      item.swap = { id: item.id, price: item.price, amount_left: item.amount_left, seller_id: item.seller_id, timestamp: item.timestamp }
      item.status = item.status == 'concluded' ? 1 : 0
      if (options.per_token) token.swaps.push(item)
      else {
        item.token = token
        if (empty(item.token.royalties)) item.token.royalties = item.royalties;
        data.asks.push(item)
      }
    }
    if (options.per_token) delete (token.asks)

    if (token.fulfilled_asks) for (let item of token.fulfilled_asks) {
      item = Object.assign({}, item)
      item.type = 'filled'
      if (empty(item.platform)) item.platform = 'bid'
      else if (item.platform.match(/^hen/i)) item.platform = 'hen'
      if (item.ask) item.swap = {
        id: item.ask.id,
        price: item.ask.price,
        amount_left: item.ask.amount_left,
        seller_id: item.ask.seller_id,
        timestamp: item.timestamp,
        status: item.ask.status == 'concluded' ? 1 : 0
      }
      item.status = 1
      if (options.per_token) token.trades.push(item)
      else {
        item.token = token
        data.filled.push(item)
      }
    }
    if (options.per_token) delete (token.fulfilled_asks)

    if (token.bids) for (let item of token.bids) {
      item.type = 'offer'
      item = Object.assign({}, item)
      if (empty(item.platform)) item.platform = 'bid'
      else if (item.platform.match(/^hen/i)) item.platform = 'hen'
      item.swap = { price: item.price, amount: 1, amount_left: 0, timestamp: item.timestamp, status: 1 }
      item.status = 1
      item.amount = 1
      if (options.per_token) token.trades.push(item)
      else {
        item.token = token
        data.bids.push(item)
      }
    }
    if (options.per_token) delete (token.bids)

    if (token.english_auctions) for (let item of token.english_auctions) {
      if (item.buyer_id && item.buyer_id == item.seller_id) continue // returned to owner
      item = Object.assign({}, item)
      item.type = 'english'
      if (empty(item.platform)) item.platform = 'bid'
      item.swap = { price: item.price, amount: 1, amount_left: 0, timestamp: item.timestamp, status: 1 }
      item.status = 1
      item.amount = 1
      if (options.per_token) token.trades.push(item)
      else {
        data.english.push(item)
        item.token = token
      }
    }
    if (options.per_token) delete (token.english_auctions)

    // store final result
    if (options.per_token) data.push(token)
  }

  return data
}

export function all_wallets(main_wallet) {
  let data = localStorage.getItem("owned_wallets")
  if (empty(data)) {
    if (!empty(main_wallet)) data = [main_wallet]
    else data = []
  }
  else {
    data = [main_wallet].concat(String(data).split(/[\r\n,]+/)).filter(e => e)
    data = [...new Set(data)]
  }
  return data
}

function bid_status(val) {
  if (val == 'cancelled') return 2
  else if (val == 'concluded') return 1
  else return 0
}

function getTokenIds(data, internal, external) {
  if (empty(data)) return
  else if (data.length == 0) return

  for (let s of data) {
    if (!empty(s.token)) continue
    if (s.token_id) internal.push(s.token_id)
    else external.push({ id: s.objkt_id, fa2_id: s.fa2_id })
  }
}

export async function normalizeBidData(data, add_token, options) {
  if (empty(options)) options = { per_token: false, with_holders: false }
  let objkts = []
  if (add_token) {
    if (add_token === true) {
      // we retrieve objkt for asks
      let internal = []
      let external = []
      getTokenIds(data.asks, internal, external)
      getTokenIds(data.filled, internal, external)
      getTokenIds(data.bids, internal, external)
      getTokenIds(data.english, internal, external)
      internal = await getObjkts([...new Set(internal)])
      objkts = objkts.concat(internal)
      external = await getFA2Tokens([...new Set(external)], options.with_holders)
      objkts = objkts.concat(external)
    } else {
      for (let t of add_token) {
        let c = Object.assign({}, t)
        if (typeof c.token_holders !== 'undefined') delete (c.token_holders)
        if (typeof c.trades !== 'undefined') delete (c.trades)
        if (options.per_token) {
          if (empty(c.swaps)) c.swaps = []
          if (empty(c.trades)) c.trades = []
        }
        objkts.push(c)
      }
    }
  }

  let asks = empty(data.asks) ? [] : data.asks
  for (let item of asks) {
    if (empty(item.platform)) item.platform = 'bid'
    if (empty(item.uuid)) item.uuid = `${item.fa2_id}_${item.objkt_id}`
    let token = item.token
    if (empty(token)) token = objkts.find(t => t.uuid == item.uuid)
    if (!empty(token) && empty(token.royalties)) token.royalties = item.royalties;
    if (empty(item.seller)) item.seller = item.creator
    item.swap = { id: item.id, price: item.price, amount_left: item.amount_left, seller_id: (item.seller_id || item.creator_id), timestamp: item.timestamp }
    item.status = bid_status(item.status)
    if (options.per_token) {
      if (empty(token.swaps)) token.swaps = []
      token.swaps.push(item)
    }
    else item.token = token
  }

  let filled = empty(data.filled) ? [] : data.filled
  for (let item of filled) {
    if (empty(item.platform)) item.platform = 'bid'
    item.uuid = `${item.fa2_id}_${item.objkt_id}`
    let token = item.token
    if (empty(token)) token = objkts.find(t => t.uuid == item.uuid)
    if (empty(item.seller)) item.seller = item.creator
    if (item.ask) item.swap = {
      id: item.ask.id,
      price: item.ask.price,
      amount_left: item.ask.amount_left,
      seller_id: (item.ask.seller_id || item.ask.creator_id),
      timestamp: item.timestamp,
      status: item.ask.status == 'concluded' ? 1 : 0
    }
    item.status = 1
    if (options.per_token) {
      if (empty(token.trades)) token.trades = []
      token.trades.push(item)
    }
    else item.token = token
  }

  let bids = empty(data.bids) ? [] : data.bids
  for (let item of bids) {
    item.type = 'offer'
    if (empty(item.platform)) item.platform = 'bid'
    item.uuid = `${item.fa2_id}_${item.objkt_id}`
    let token = item.token
    if (empty(token)) token = objkts.find(t => t.uuid == item.uuid)
    item.buyer = Object.assign({}, item.buyer || item.creator)
    if (empty(item.buyer_id)) item.buyer_id = item.creator_id
    delete (item.creator)
    item.swap = { price: item.price, amount_left: 0, timestamp: item.timestamp, status: bid_status(item.status) }
    item.status = bid_status(item.status)
    item.amount = 1
    if (options.per_token) {
      if (empty(token.trades)) token.trades = []
      token.trades.push(item)
    }
    else item.token = token
  }

  let english = []
  if (!empty(data.english)) for (let item of data.english) {
    if (item.seller_id && item.seller_id == item.buyer_id) continue
    if (empty(item.platform)) item.platform = 'bid'
    item.uuid = `${item.fa2_id}_${item.objkt_id}`
    let token = item.token
    if (empty(token)) token = objkts.find(t => t.uuid == item.uuid)
    item.swap = { price: item.price, amount: 1, amount_left: 0, timestamp: item.timestamp, status: 1 }
    item.status = 1
    item.amount = 1
    if (options.per_token) {
      if (empty(token.trades)) token.trades = []
      token.trades.push(item)
    }
    else item.token = token
    english.push(item)
  }

  if (options.per_token) return objkts
  else return { asks: asks, filled: filled, bids: bids, english: english }
}

export function loading(keep_result) {
  let div = null

  div = document.getElementById('loading')
  if (div) div.classList.remove('hidden')
  div = document.getElementById('error')
  if (div) div.style.display = 'none'

  div = document.getElementById('result')
  if (div) {
    div.style.display = 'none'
    if (!keep_result) {
      try { ReactDOM.unmountComponentAtNode(document.getElementById('result')) } catch (e) { console.debug(e) }
      div.innerHTML = ''
    }
  }
}

export function done() {
  let div = document.getElementById("error")
  if (div && empty(div.innerHTML)) div.style.display = 'none'
  div = document.getElementById('loading')
  if (div) div.classList.add("hidden")
  div = document.getElementById('result')
  if (div) div.style.display = 'block'
}

export function showError(errors, options) {
  if (empty(options)) options = {}
  let error = Array.isArray(errors) ? errors[0] : errors
  let txt = typeof (error) == 'string' ? error : error.message
  if (console) console.error(txt)
  if (!empty(options.show_time) && options.show_time) txt = `${formattedTime(Date.now())} : ${txt}`
  if (!options.keep_loading) {
    let div = document.getElementById('loading')
    if (div) div.classList.add("hidden")
  }
  div = document.getElementById('error')
  if (options.raw) div.innerHTML = `ERROR : ${txt}`
  else div.innerHTML = `ERROR : Unable to load data from API - ${txt}`
  div.style.display = 'block'
  return false
}

export function format_number(val, max_digit = 6) {
  if (empty(val)) return null;
  return Intl.NumberFormat('en-US', { minimumFractionDigits: max_digit < 2 ? max_digit : 2, maximumFractionDigits: max_digit }).format(val)
}

export function formattedTime(ts) {
  return new Date(ts).toLocaleTimeString();
}

export function formattedDate(date, type) {
  if (empty(date)) return null;
  try {
    if (!empty(type)) {
      if (type == 'date') return dateFormat.format(date)
      else if (type == 'short') return shortFormat.format(date)
      else if (type == 'extended') return extendedFormat.format(date)
    }

    let txt = historyDateFormat.format(date)
    if (!empty(type) && type == 'absolute') return txt
    else return (<TimeAgo datetime={date.toISOString()} title={txt}>{txt}</TimeAgo>)
  }
  catch (e) {
    console.error(`Invalid date ${date}`, e)
    return null
  }
}

export async function add_timeago() {
  if ($("time.timeago").length == 0) return;
  $("tr").hover(
    function () {
      let timeago = $(this).find("time.timeago");
      if (timeago.length > 0) {
        let txt = timeago.attr("title");
        let ago = timeago.html();
        timeago.html(`<span title="${ago}">${txt}</span>`);
      }
    },
    function () {
      let timeago = $(this).find("time.timeago");
      let txt = timeago.find("span").last().attr('title')
      timeago.find("span").last().remove();
      timeago.html(txt);
    }
  )
}


export function holders_info(data, include_burn) {
  let holders = {};
  if (empty(data)) return holders
  for (let h of data) {
    let adr = empty(h.holder) ? h.holder_id : h.holder.address
    if ((adr == AppConst.BURN_ADDRESS) && !include_burn) continue;
    if (h.quantity == 0) continue;

    let name = h.holder?.name
    if (adr == AppConst.MINT_PROTOCOL) name = 'HEN V1'
    else if (adr == AppConst.HEN_MARKETPLACE) name = 'HEN V2'
    else if (adr == AppConst.TEIA_MARKETPLACE) name = 'TEIA'
    else if (adr == AppConst.BID_MARKETPLACE) name = 'Objkt V1'
    else if (adr == AppConst.BID_MARKETPLACE2) name = 'Objkt V2'
    else if (adr == AppConst.VERSUM_MARKETPLACE) name = 'Versum'
    holders[adr] = {
      quantity: h.quantity,
      address: adr,
      name: name,
      twitter: h.holder?.twitter,
    };
  }
  return holders;
}

export async function getSubjkt(name) {
  const { errors, data } = await fetchGraphQL(query_subjkts, "qryNftBiker", { "name": name });
  if (errors) {
    console.error(errors)
    return null;
  }
  let result = data.holder[0];
  if (empty(result)) return null;
  if (!empty(result.address)) return result.address;
  else return name;
}

export async function getWalletsInfos(wallets, options) {
  if (empty(options)) options = {}
  let query = query_names
  if (options.with_purchases) query = query_names_with_purchases
  const { errors, data } = await fetchGraphQL(query, "qryNftBiker", { "wallets": wallets });
  if (errors) {
    console.error(errors)
    return null;
  }
  return data.holder.reduce((data, item) => {
    data[item.address] = { address: item.address, name: item.name }
    if (options.with_purchases) {
      data[item.address].purchases = item.purchases_aggregate.aggregate.count + item.sales_aggregate.aggregate.count
    }
    return data
  }, {})
}

export async function getObjkt(id) {
  let m = String(id).split(/[\/_]/im)
  let params = null
  if (m.length > 1) params = { id: m[m.length - 1], fa2: m[m.length - 2] }
  else params = { id: id, fa2: AppConst.HEN_OBJKT }
  const { errors, data } = await fetchGraphQL(query_single_objkt, "qryNftBiker", params);
  if (empty(data.token)) return {}
  else return data.token[0]
}

export async function getObjktsById(list, options) {
  if (empty(list)) return []
  if (typeof (options) == 'undefined') options = {}
  list = [...new Set(list.filter(e => e))]
  const { errors, data } = await fetchGraphQL(query_objkts_by_id, "qryNftBiker", { "token": list }, options);
  if (errors) {
    if (options.errors) return { errors: errors }
    else return []
  }
  let result = data.token;
  if (empty(result)) return [];
  else return result;
}

export async function getObjkts(list, options) {
  if (empty(list)) return []
  if (typeof (options) == 'undefined') options = {}

  try {
    const { errors, data } = await fetchGraphQL(query_objkts, "qryNftBiker", { "token": list }, options);
    if (errors) {
      if (options.errors) return { errors: errors }
      else return []
    }
    let result = data.token;
    if (empty(result)) return [];
    else return result;
  } catch (e) {
    console.log('Graphql objkts fetch error')
    console.log(e)
    return []
  }
}

export async function getAddress(addressOrDomain) {
  let result = await getAddresses(addressOrDomain)
  return (empty(result) ? addressOrDomain : result[0])
}

export async function getAddresses(addressesOrDomain) {
  if (empty(addressesOrDomain)) return [];
  let tzDomains = []
  let results = []
  let list = addressesOrDomain.split(/[,;\s]+/im).filter(e => !empty(e))
  for (let entry of list) {
    if (isTezosDomain(entry)) tzDomains.push(entry)
    else {
      let m = entry.match(/((tz|kt)[^\.\/\'\"]{30,})/im);
      if (m) results.push(m[1])
      else {
        let val = entry.split('/').pop()
        let address = await getSubjkt(val);
        results.push(address)
      }
    }
  }

  if (!empty(tzDomains)) {
    let data = await resolveTezosDomains(tzDomains);
    for (let entry of data) results.push(entry.address)
  }
  return results
}

/* Wallet meta infos */
export async function getWalletName(wallet, raw) {
  if (AppConst.MARKETPLACE_CONTRACTS.includes(wallet)) return 'unknown';
  else wallet = await getAddress(wallet)
  let data = await apiAsyncRequest(`https://api.tzkt.io/v1/accounts/${wallet}/metadata`);
  if (empty(data)) data = { address: wallet, twitter: null };
  else data.address = wallet;

  let name = wallet;
  if (!empty(data['alias'])) name = data['alias']
  else if (!empty(data['twitter'])) name = data['twitter']
  if (raw) {
    data.name_or_wallet = shorten_wallet(name);
    return data
  } else return shorten_wallet(name);
}

export function getOrFindArtist(artist, skip_shorten) {
  if (empty(artist)) return
  if (!Artists.loaded) console.error('artists list not loaded !')
  let wallet = artist.address

  let val = Artists.get(wallet)
  if (!empty(val)) return val;
  else if (!empty(artist.name)) return artist.name;
  else if (!empty(skip_shorten) && skip_shorten) return null;
  else return shorten_wallet(wallet);
}

/* API */
var last_error = null
export function get_last_error() {
  return last_error
}

export async function apiAsyncRequest(url) {
  let result;
  last_error = null
  result = await axios.get(url)
    .then(response => {
      return response.data
    })
    .catch(err => {
      console.log(`Api request error for ${url}`, err);
      last_error = err
      return {}
    })
  return result;
}

export function sql_date(date) {
  return date.toISOString().split('.')[0];
}

function new_query(url) {
  if (url.match(/localhost|nftbiker\.xyz/i)) return true
  else return false
}

export async function fetchObjQL(operationsDoc, operationName, variables, options) {
  if (empty(options)) options = {}
  options.external_url = AppConst.OBJKT_API_URL
  return fetchGraphQL(operationsDoc, operationName, variables, options)
}

export async function fetchGraphQL(operationsDoc, operationName, variables, options) {
  if (empty(options)) options = {}
  let url = AppConst.HICDEX_MAIN
  if (options.external_url) url = options.external_url

  if (new_query(url)) {
    operationsDoc = operationsDoc.replaceAll(/(:hic_et_nunc_([^\\(\\)]+))/ig, ':$2')
    operationsDoc = operationsDoc.replaceAll(/(hic_et_nunc_([^\\(\\)]+))/ig, '$1:$2')
  }

  const timeout = (options.timeout ? options.timeout : 60) * 1000 // timeout in second converted to microsec
  const json = JSON.stringify({
    query: operationsDoc,
    variables: variables,
    operationName: operationName
  })
  const response = await axios.post(url, json, {
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: timeout
  })
    .then(res => res.data)
    .catch(err => {
      let retry_allowed = !options.objkt_request && !options.external_url
      if (!options.retried && err.message.match(/Network Error/i) && retry_allowed) {
        options.alternative_api = true
        options.retried = true
        return fetchGraphQL(operationsDoc, operationName, variables, options)
      }
      else return { errors: err }
    });
  return response
}

/* ****************** */
/* artists management */
/* ****************** */
function uniqueArrayByKey(data, key) {
  var result = data.reduce((current, next) => {
    if (!current.some(a => a[key] === next[key])) {
      current.push(next);
    }
    return current;
  }, []);
  return result;
}

export async function loadArtists(options) {
  if (empty(options)) options = {}
  if (empty(options.storage_only)) options.storage_only = false
  if (empty(options.update)) options.update = false
  if (empty(options.external)) options.external = false // force external loading when we ask to storage loading

  let is_client = typeof (window) != 'undefined'
  let external = urlParams.get("load") || document.getElementById("load")?.value || localStorage.getItem("load")

  if (Artists.loaded && options.storage_only) {
    if (!options.external) return true;
    else if (empty(external)) return true;
  }

  Artists.reset()

  let content = null
  if (!empty(external)) {
    console.log(`Load external wallet list from : ${external}`)
    let d = new Date(); d.setMinutes(0, 0, 0)
    let url = `https://nftbiker.herokuapp.com/?timestamp=${d.getTime()}&url=${external}`
    let response = await axios.get(url)
    content = response.data
  }
  if (empty(content) && !options.storage_only) content = document.getElementById('wallets')?.value

  if (is_client) {
    if (empty(content) && options.storage_only) content = localStorage.getItem("wallets");
    if (empty(content) && options.update) localStorage.removeItem("wallets");
  }
  if (empty(content)) return true;

  let list = []
  let wallets = []

  for (let line of [...new Set(content.replace(/^\s+/g, '').replace(/\s+$/g, '').split(/\r?\n/))]) {
    line = line.replace(/\s+/g, ' ').replace(/^\s+/g, '').replace(/\s+$/g, '');
    let adr = line.split(" ").shift().split('/').pop();
    if (!empty(adr) && adr.match(/^tz.{32}/im)) wallets.push(adr);

    let name = '';
    let data = line.split("#");
    if (data.length > 1) {
      name = data.pop().replace(/^\s+/g, '').replace(/\s+$/g, '');
      Artists.add(adr, name)
    } else if (Artists.get(adr) && adr != Artists.get(adr)) {
      name = Artists.get(adr);
    } else {
      Artists.add(adr, null)
    }

    list.push({
      address: adr,
      name: name
    });
  }

  updateArtistStorage(list, external)
  Artists.loaded = true
  return wallets;
}

export function updateArtistStorage(list, external) {
  list = list.sort(function (a, b) {
    return a['name'].localeCompare(b['name']);
  });
  list = uniqueArrayByKey(list, 'address');
  if (!empty(external)) console.log(`External list : ${list.length} wallets`)
  else console.log(`Monitored list : ${list.length} wallets`)

  let content = list.map(v => (v.address + " # " + v.name).trim()).join("\n")
  localStorage.setItem("wallets", content);
  let blk = document.getElementById("wallets")
  if (blk) blk.value = content
  return { list: list, content: content }
}

/* ****************** */
/* tezos domains */
/* ****************** */

const query_tezos_domains = `
query resolveDomain($domains: [String!]) {
  domains(
    where: {
      name: {
        in: $domains
      }
    }
  ) {
    items {
      address
      name
    }
  }
}
`

export function isTezosDomain(address) {
  return /\.tez$/i.test(address);
}

export async function resolveTezosDomains(domains) {
  if (domains.constructor != Array) domains = [domains]
  try {
    const result = await fetch('https://api.tezos.domains/graphql', {
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      body: JSON.stringify({
        query: query_tezos_domains,
        variables: { domains: domains },
        operationName: 'resolveDomain',
      }),
    });

    const response = await result.json();
    return response.data?.domains?.items || []
  } catch (err) {
    return '';
  }
}

async function resolveTezosDomain(domain) {
  let result = await resolveTezosDomains([domain])
  if (empty(result)) return null
  else return result[0].address
}
