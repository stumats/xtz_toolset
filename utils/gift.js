import * as AppConst from './constants'
import { apiAsyncRequest, empty } from './utils'
import { getAllTokens } from '../utils/fa2tokens'

async function fetchMints(wallets) {
  let list = wallets.join(',')
  let url = "https://api.tzkt.io/v1/accounts/KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton/operations?"
  url += 'type=transaction&status=applied&entrypoint=mint&limit=1000&sort.desc=id'
  if (wallets.length > 1) url += `&parameter.address.in=${list}&initiator.ni=${list}`
  else url += `&parameter.address=${list}&initiator.ne=${list}`

  const mints = await apiAsyncRequest(url);

  var transactions = []
  for (let item of mints) {
    if (empty(item.parameter)) continue; //not a gift

    let infos = item.parameter.value
    if (empty(infos)) continue
    if (!wallets.includes(infos['address'])) continue

    let tx = {
      type: 'received',
      timestamp: item.timestamp,
      seller: { address: item.initiator.address, name: item.initiator.alias },
      buyer: { address: infos.address, name: '' },
      objkt_id: infos.token_id,
      quantity: infos.amount
    }
    tx.date = new Date(tx.timestamp)
    transactions.push(tx);
  }
  return transactions
}

export async function fetchRaribleGifts(wallets) {
  let list = wallets.join(',')

  let url = "https://api.tzkt.io/v1/operations/transactions?entrypoint=transfer&status=applied&limit=10000&sort.desc=id"
  if (wallets.length > 1) {
    url += `&sender.ni=${list}&target.ni=${list}&initiator.ni=${list}`
    url += `&parameter.[*].list.[*].to.in=${list}&initiator.ni=${list}`
  }
  else {
    url += `&sender.ne=${list}&target.ne=${list}&initiator.ni=${list}`
    url += `&parameter.[*].list.[*].to=${list}`
  }
  const gifts = await apiAsyncRequest(url);

  var transactions = []
  for (let item of gifts) {
    if (AppConst.MARKETPLACE_CONTRACTS.includes(item.sender.address)) continue;
    if (empty(item.parameter)) continue; //not a gift

    let txs = item.parameter.value[0].list;
    if (empty(txs)) continue; // missing sender
    for (let info of txs) {
      if (!wallets.includes(info['to'])) continue;
      else if (wallets.includes(item.sender.address)) continue; // internal move
      let tx = {
        type: 'received',
        timestamp: item.timestamp,
        seller: { address: item.sender.address, name: item.sender.alias },
        buyer: { address: info.to, name: '' },
        objkt_id: info.token_id,
        fa2_id: item.target.address,
        quantity: info.amount,
      }
      tx.uuid = `${tx.fa2_id}_${tx.objkt_id}`
      tx.date = new Date(tx.timestamp)
      transactions.push(tx);
    }
  }
  return transactions
}


export async function fetchGifts(wallets) {
  let list = wallets.join(',')

  let url = "https://api.tzkt.io/v1/operations/transactions?entrypoint=transfer&status=applied&limit=10000&sort.desc=id"
  url += "&hasInternals=false"
  if (wallets.length > 1) {
    url += `&sender.ni=${list}&target.ni=${list}&initiator.ni=${list}`
    url += `&parameter.[*].txs.[*].to_.in=${list}`
  }
  else {
    url += `&sender.ne=${list}&target.ne=${list}&initiator.ne=${list}`
    url += `&parameter.[*].txs.[*].to_=${list}`
  }
  const gifts = await apiAsyncRequest(url);

  var transactions = []
  for (let item of gifts) {
    if (AppConst.MARKETPLACE_CONTRACTS.includes(item.sender.address)) continue;
    if (empty(item.parameter)) continue; //not a gift

    let txs = item.parameter.value[0].txs;
    if (empty(txs)) continue; // missing sender
    for (let info of txs) {
      if (!wallets.includes(info['to_'])) continue;
      else if (wallets.includes(item.sender.address)) continue; // internal move
      let tx = {
        type: 'received',
        timestamp: item.timestamp,
        seller: { address: item.sender.address, name: item.sender.alias },
        buyer: { address: info.to_, name: '' },
        objkt_id: info.token_id,
        fa2_id: item.target.address,
        quantity: info.amount,
      }
      tx.uuid = `${tx.fa2_id}_${tx.objkt_id}`
      tx.date = new Date(tx.timestamp)
      transactions.push(tx);
    }
  }
  return transactions
}

export async function fetchSent(wallets) {
  let list = wallets.join(',')
  let url = "https://api.tzkt.io/v1/accounts/KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton/operations?type=transaction"
  if (wallets.length > 1) url += `&parameter.[*].from_.in=${list}`
  else url += `&parameter.[*].from_=${list}`
  url += `&status=applied&limit=1000&sort.desc=id`
  url += `&parameter.[*].txs.[*].to_.ni=${AppConst.MINT_PROTOCOL},${AppConst.BURN_ADDRESS},${AppConst.MARKETPLACE_CONTRACTS.join(',')}`
  const sent = await apiAsyncRequest(url);

  var transactions = []
  for (let item of sent) {
    if (!wallets.includes(item.sender.address)) continue;
    if (empty(item.parameter)) continue; //not an otc
    if (!wallets.includes(item.parameter.value[0]['from_'])) continue;

    let txs = item.parameter.value[0].txs;
    if (empty(txs)) continue; // missing sender
    for (let info of txs) {
      if (wallets.includes(info.to_)) continue // internal send
      let tx = {
        type: 'sent',
        timestamp: item.timestamp,
        seller: { address: item.sender.address, name: item.sender.alias },
        buyer: { address: info.to_, name: '' },
        objkt_id: info.token_id,
        fa2_id: item.target.address,
        quantity: info.amount
      }
      tx.uuid = `${tx.fa2_id}_${tx.objkt_id}`
      tx.date = new Date(tx.timestamp)
      transactions.push(tx);
    }
  }
  return transactions
}

export async function retrieveTokens(transactions) {
  // retrieve objkt info
  let data = await getAllTokens(transactions.map(e => { return { uuid: e.uuid, id: e.objkt_id, fa2_id: e.fa2_id } }))
  let tokens = {}
  for (let item of data) {
    tokens[item.uuid] = item
  }

  return transactions.map(tx => {
    let token = tokens[tx.uuid]
    if (!empty(token)) {
      tx.token_id = token.pk_id
      tx.token = token
    }
    return tx
  })
}

export async function retrieveSent(wallet) {
  const transactions = await fetchSent([wallet])
  return retrieveTokens(transactions)
}

export async function retrieveGifts(wallet) {
  let transactions = []
  transactions = transactions.concat(await fetchGifts([wallet]))
  transactions = transactions.concat(await fetchRaribleGifts([wallet]))
  transactions = transactions.concat(await fetchMints([wallet]))
  return retrieveTokens(transactions.sort((a, b) => { return b.date - a.date }))
}

export async function retrieveOTC(wallets) {
  let transactions = []
  transactions = transactions.concat(await fetchGifts(wallets))
  transactions = transactions.concat(await fetchRaribleGifts(wallets))
  transactions = transactions.concat(await fetchMints(wallets))
  transactions = transactions.concat(await fetchSent(wallets))
  transactions.forEach(t => t.otc_trade = true)
  return retrieveTokens(transactions.sort((a, b) => { return b.date - a.date }))
}
