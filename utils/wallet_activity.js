import {
  loadArtists, loading, empty, Artists, fetchGraphQL, showError,
  normalizeBidData, urlParams, proper_value, all_wallets, formattedDate,
} from './utils'
import { retrieveGifts } from '../utils/gift'
import * as AppConst from '../utils/constants'
import { connectedWalletAddress } from './wallet';

export var activity_summary = {
  artistic_sales: 0,
  resold: 0,
  total_sales: 0,
  total_buys: 0,
  editions_sold: 0,
  editions_resold: 0,
  total_resold: 0,
  editions_collected: 0,
  total_royalties: 0,
  artists_royalties: {},
  is_artist: false
}
export var creator = empty(urlParams.get("creator")) ? false : urlParams.get("creator");

const token_infos = `
token {
  id
  uuid
  fa2_id
  pk_id
  title
  supply
  royalties
  mime
  display_uri
  artifact_uri
  thumbnail_uri
  creator_id
  creator {
    address
    name
  }
}
`

const query_sales = `
query qryNftBiker($wallets: [String!], $date: timestamptz! ) {
  fulfilled_ask(where: { seller_id: {_in: $wallets}, timestamp: {_gte: $date}}) {
    id
    platform
    objkt_id
    fa2_id
    timestamp
    level
    amount
    price
    seller {
      address
      name
    }
    buyer {
      address
      name
    }
    ${token_infos}
  }
  bid(where: {seller_id: {_in: $wallets}, timestamp: {_gte: $date}, status: {_eq: "concluded"}}) {
    id
    platform
    objkt_id
    fa2_id
    price
    timestamp
    level
    status
    royalties
    buyer:creator {
      address
      name
    }
    seller {
      address
      name
    }
    ${token_infos}
  }
  english_auction(where: { status: {_eq: "concluded"}, creator_id: {_in: $wallets}, timestamp: {_gte: $date}}) {
    id
    platform
    fa2_id
    objkt_id
    price:highest_bid
    timestamp:update_timestamp
    status
    buyer_id:highest_bidder_id
    buyer:highest_bidder {
      name
      address
    }
    seller_id:creator_id
    seller: creator {
      address
      name
    }
    ${token_infos}
  }
}
`

const query_buys = `
query qryNftBiker($wallets: [String!]) {
  fulfilled_ask(where: { buyer_id: {_in: $wallets}}) {
    id
    platform
    objkt_id
    fa2_id
    timestamp
    level
    amount
    price
    seller {
      address
      name
    }
    buyer {
      address
      name
    }
    ${token_infos}
  }
  bid(where: { creator_id: {_in: $wallets}, status: {_eq: "concluded"}}) {
    id
    platform
    objkt_id
    fa2_id
    price
    seller_id
    timestamp
    level
    status
    royalties
    creator {
      address
      name
    }
    seller {
      address
      name
    }
    ${token_infos}
  }
  english_auction(where: { status: {_eq: "concluded"}, highest_bidder_id: {_in: $wallets}}) {
    id
    platform
    fa2_id
    objkt_id
    price:highest_bid
    timestamp:update_timestamp
    status
    buyer_id:highest_bidder_id
    buyer:highest_bidder {
      name
      address
    }
    seller_id:creator_id
    seller: creator {
      address
      name
    }
    ${token_infos}
  }
}
`

async function retrieve_data(wallets, query, params) {
  if (empty(params)) params = {}
  params["wallets"] = wallets
  const { errors, data } = await fetchGraphQL(query, "qryNftBiker", params);
  if (errors) {
    showError(errors);
    return { is_error: true }
  }

  return {
    trades: [],
    filled: data.fulfilled_ask,
    bids: data.bid,
    english: data.english_auction,
  }
}

function initData() {
  activity_summary = {
    artistic_sales: 0,
    resold: 0,
    total_sales: 0,
    total_buys: 0,
    editions_sold: 0,
    editions_resold: 0,
    total_resold: 0,
    editions_collected: 0,
    total_royalties: 0,
    artists_royalties: {},
    is_artist: false
  }
}

export async function fetchAllActivities() {
  let transactions = []
  let data = []

  initData()
  data = await fetchWalletSales()
  if (data) transactions = transactions.concat(data);
  data = await fetchWalletBuys(true)
  if (data) transactions = transactions.concat(data);
  data = await fetchWalletGifts(true)
  if (data) transactions = transactions.concat(data);
  return transactions
}

function verify_creator(token) {
  if (empty(creator) || !creator) return true
  if (empty(token)) return false
  let is_contract = creator.match(/^KT.+/im)
  if (is_contract) return (creator == token.fa2_id)
  else return (creator == token.creator?.address)
}

export async function fetchWalletSales(wallet, latest) {
  let transactions = []
  if (empty(wallet)) wallet = document.getElementById("wallet").value;
  if (empty(wallet)) return;

  let wallets = await setWalletsList(wallet)

  await loadArtists({ storage_only: true });
  loading(true);
  let dmin
  if (latest) {
    dmin = new Date()
    dmin.setDate(dmin.getDate() - 15)
  }
  else {
    dmin = new Date('2021-01-01')
  }

  let { trades, filled, bids, english, is_error } = await retrieve_data(wallets, query_sales, { date: dmin });
  if (is_error) return false
  let normalized = await normalizeBidData({ filled: filled, bids: bids, english: english }, true)
  if (normalized.filled.length > 0) trades = trades.concat(normalized.filled);
  if (normalized.bids.length > 0) trades = trades.concat(normalized.bids);
  if (normalized.english.length > 0) trades = trades.concat(normalized.english);

  if (!empty(trades)) {
    for (let tx of trades) {
      if (empty(tx.token)) {
        console.error('token not found', tx)
        continue;
      }
      if (empty(tx.token.creator)) continue; // can't process it
      if (!verify_creator(tx.token)) continue;
      // skip internal
      if (wallets.includes(tx.buyer.address) && wallets.includes(tx.seller.address)) continue

      tx.type = 'sale'
      if (empty(tx.platform)) tx.platform = 'hen'
      tx.date = new Date(tx.timestamp)
      let profit = tx.token.creator?.address == tx.seller.address ? (1 - AppConst.HEN_FEE / 1000) : (1 - (tx.token.royalties + AppConst.HEN_FEE) / 1000)

      activity_summary.editions_sold += tx.amount
      let price = parseFloat(tx.price) * profit / 1000000
      if (!isNaN(price)) activity_summary.total_sales += price * tx.amount

      if (tx.token.creator?.address != tx.seller.address) {
        activity_summary.total_royalties += parseFloat(tx.price) * (tx.token.royalties / 1000) / 1000000
        activity_summary.artists_royalties[tx.token.creator.address] = true
        activity_summary.resold += price * tx.amount
        activity_summary.editions_resold += tx.amount
        activity_summary.total_resold += price * tx.amount
      }
      else {
        tx.primary_sale = true
        activity_summary.artistic_sales += price * tx.amount
        activity_summary.is_artist = true
      }

      if (Artists.loaded) {
        if (empty(tx.buyer)) tx.buyer = { name: null, address: null }
        if (empty(tx.buyer.name)) tx.buyer.name = proper_value(Artists.get(tx.buyer.address))
        if (empty(tx.token.creator.name)) tx.token.creator.name = proper_value(Artists.get(tx.token.creator.address))
      }

      if (!isNaN(price)) {
        tx.price = Number(tx.price / AppConst.HEN_DECIMALS)
        tx.total = Number(price * tx.amount).round(2)
      }

      tx.uuid = tx.token.uuid
      tx.dom_key = `sale_${latest ? 'last' : 'all'}_${tx.uuid}_${tx.id}`

      transactions.push(tx);
    }
  }
  return transactions;
}

export async function fetchWalletGifts(skip_internal = false) {
  let results = []
  await loadArtists({ storage_only: true });

  let wallet = document.getElementById("wallet").value;
  if (wallet == null || wallet == '') return;

  let wallets = await setWalletsList(wallet)

  loading(true);
  let transactions = await retrieveGifts(wallet);
  for (let item of transactions) {
    let token = item.token
    if (!verify_creator(token)) continue;
    if (skip_internal && wallets.includes(item.buyer.address) && wallets.includes(item.seller.address)) continue;

    let tx = {
      id: `otc_${item.date.getTime()}`,
      type: 'buy',
      uuid: item.uuid,
      token_id: token?.pk_id,
      token: token,
      seller: item.seller,
      buyer: item.buyer,
      timestamp: item.timestamp,
      date: item.date,
      otc_trade: true,
      price: 'otc',
      total: 'otc',
      amount: 1,
    }
    activity_summary.editions_collected += 1
    tx.dom_key = `gift_${item.uuid}`
    results.push(tx);
  }
  return results;
}

export async function fetchWalletBuys(any_token) {
  let transactions = []
  await loadArtists({ storage_only: true });

  let wallet = document.getElementById("wallet").value;
  if (wallet == null || wallet == '') return;

  let wallets = await setWalletsList(wallet)
  loading(true);

  let query = query_buys
  if (any_token) query = query.replace(/(fa2_id\s*:[^,]+,)/g, '')
  let { trades, filled, bids, english, is_error } = await retrieve_data(wallets, query);
  if (is_error) return false

  let normalized = await normalizeBidData({ filled: filled, bids: bids, english: english }, true)
  if (normalized.filled.length > 0) trades = trades.concat(normalized.filled);
  if (normalized.bids.length > 0) trades = trades.concat(normalized.bids);
  if (normalized.english.length > 0) trades = trades.concat(normalized.english);

  if (!empty(trades)) {
    for (let tx of trades) {
      if (!verify_creator(tx.token)) continue;
      if (empty(tx.token)) continue
      tx.type = 'buy'
      if (empty(tx.platform)) tx.platform = 'hen'
      tx.date = new Date(tx.timestamp)
      let profit = tx.token.creator.address == tx.buyer.address ? (1 - (tx.token.royalties / 1000)) : 1
      let price = parseFloat(tx.price) * profit / 1000000
      activity_summary.total_buys += price * tx.amount
      activity_summary.editions_collected += tx.amount
      tx.price = Number(tx.price / AppConst.HEN_DECIMALS)
      tx.total = Number(price * tx.amount).round(2)
      tx.uuid = tx.token.uuid
      tx.dom_key = `trade_${tx.uuid}`
      transactions.push(tx);
    }
  }
  return transactions;
}

export async function collectorFlexStats(transactions) {
  if (empty(transactions)) return null

  let wallet = document.getElementById("wallet").value;
  if (wallet == null || wallet == '') return;
  let wallets = await setWalletsList(wallet)

  let last_collected = null;
  let total_days = 0;
  let uniqueArtists = {}
  let uniqueTokens = {}
  let current_date = null
  let today = new Date(Date.now()).toDateString();

  for (let tx of transactions) {
    let token = tx.token;
    if (!token) continue;
    // skip sale
    if (tx.type == 'sale') continue
    // skip internal
    if (tx.seller?.address && wallets.includes(tx.seller.address)) continue

    if (token.pk_id && !uniqueTokens[token.pk_id]) {
      if (token.pk_id) uniqueTokens[token.pk_id] = true
      if (token.creator) uniqueArtists[token.creator.address] = true;
      let title_date = formattedDate(tx.date, 'date');
      if (empty(last_collected)) last_collected = title_date;
      //only switch date if it's not a sale
      if (title_date != current_date) {
        if (tx.date.toDateString() != today) total_days += 1;
        current_date = title_date;
      }
    }
  }

  let total_collected = Object.keys(uniqueTokens).length
  const data = {
    first_collected: current_date,
    last_collected: last_collected,
    total_collected: total_collected,
    distinct_artists: Object.keys(uniqueArtists).length,
    average: Number(total_collected / total_days).round(2),
    active_days: total_days
  }
  return data
}


async function setWalletsList(wallet) {
  let wallets = null
  if (wallet == await connectedWalletAddress()) wallets = all_wallets(wallet)
  // else {
  //   let others = all_wallets()
  //   if (others.includes(wallet)) wallets = [wallet].concat(others)
  //   else wallets = [wallet]
  // }
  else wallets = [wallet]
  return wallets
}