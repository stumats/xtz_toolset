import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom'
import Head from 'next/head'
import * as AppConst from '../utils/constants'
import * as Wallet from '../utils/wallet'

import { Result } from '../components/result';
import { ShowTrade } from '../components/show_trade'
import { WalletConnector } from '../components/wallet_connector'

import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Link from 'next/link'

import {
  empty, loading, done, fetchGraphQL, showError, normalizeBidData, loadArtists, Artists, sql_date,
  formattedDate, getOrFindArtist, urlParams, update_current_href,
} from '../utils/utils'
import { activity_link, is_fxhash } from '../utils/links'
import { Home } from '../components/home'

var wallets = [];

const fragment_token = `
fragment tokenInfo on token {
  id
  uuid
  pk_id
  fa2_id
  balance
  price
  title
  moderated
  locked_seconds
  timestamp
  creator {
    address
    name
    twitter
  }
  royalties
  supply
  mime
  thumbnail_uri
  display_uri
  artifact_uri
}
`

const trade_query = `
${fragment_token}
query qryNftBiker($address: [String!], $date: timestamptz!, $mint: [token_bool_exp!] = []) {
  ask(where: {artist_id: {_in: $address}, status: {_in: ["active", "concluded"]}, creator_id: {_in: $address}, timestamp: {_gte: $date}}) {
    id
    platform
    token_id
    objkt_id
    fa2_id
    price
    royalties
    status
    timestamp
    amount
    amount_left
    seller_id: creator_id
    creator {
      address
      name
      twitter
    }
  }
  fulfilled_ask(where: {buyer_id: {_in: $address}, timestamp: {_gte: $date}}, order_by: {timestamp: desc}) {
    id
    platform
    token_id
    objkt_id
    fa2_id
    timestamp
    amount
    ask {
      id
      amount_left
      price
      status
      seller_id: creator_id
    }
    buyer_id
    buyer {
      address
      name
      twitter
    }
  }
  bid(where: {creator_id: {_in: $address}, status: {_eq: "concluded"}, timestamp: {_gte: $date}}, order_by: {timestamp: desc}) {
    id
    platform
    price
    objkt_id
    fa2_id
    seller_id
    timestamp
    status
    royalties
    token_id
    buyer_id: creator_id
    creator {
      address
      name
      twitter
    }
    seller_id
    seller {
      address
      name
      twitter
    }
  }
  token(order_by: {timestamp: desc}, limit: 100, where: { _or: $mint }) {
    ...tokenInfo
    asks_aggregate(where: {status: {_eq: "active"}}) {
      aggregate {
        count(distinct: true)
      }
    }
  }
}
`

/* UTILS */
function toSortedArray(hsh) {
  let keys = Object.keys(hsh);
  let values = keys.map(function (v) {
    return hsh[v];
  });
  values.sort(function (a, b) {
    return b.date - a.date;
  });
  return values;
}

/* ************** */
/* Follow history */
/* ************** */

// Get and analyse the last transactions to find the ones
// linked to artists we want to follow
async function fetchTransactions(memoDrops, memoCollected) {
  let d = new Date();
  d.setHours(d.getHours() - 25);

  let d_mint = new Date();
  d_mint.setHours(d.getHours() - 24);

  let conditions = []
  conditions.push({
    timestamp: { _gte: sql_date(d_mint) },
    creator_id: { _in: wallets }
  })

  if (wallets.includes(AppConst.FXHASH_MINTER)) {
    conditions.push({ fa2_id: { _eq: AppConst.FXHASH_MINTER } })
  }

  const { errors, data } = await fetchGraphQL(trade_query, "qryNftBiker", {
    "date": sql_date(d),
    "mint": conditions,
    "address": wallets
  });
  if (errors) return showError(errors);

  let mints = data.token;

  // we inject asks/fills
  let normalized = await normalizeBidData({
    asks: data.ask,
    filled: data.fulfilled_ask,
    bids: data.bid
  }, true)

  let swaps = normalized.asks;
  let trades = [];
  if (normalized.filled.length > 0) trades = trades.concat(normalized.filled);
  if (normalized.bids.length > 0) trades = trades.concat(normalized.bids);

  // we inject mint without any swaps
  for (let t of mints) {
    if (t.asks_aggregate.aggregate.count > 0) continue;
    if (swaps.find(s => s.token?.pk_id == t.pk_id)) continue;
    t.fxhash = is_fxhash(t.uuid) ? true : false
    if (t.fxhash && wallets.includes(t.creator?.address)) t.style = 'primary'
    let tx = {
      token: t,
      id: `noswap_${Math.random() * 100000000}`,
      creator: { address: t.creator.address, name: t.creator.name },
      price: 'pending',
      timestamp: t.timestamp,
      platform: t.fxhash ? 'fxhash' : null
    }
    if (t.fxhash) {
      tx.price = t.price
      tx.amount = t.supply
    }
    swaps.unshift(tx);
  }

  console.log('preprocess tx');
  let sales = {};
  let collected = {};

  // preprocess data to retrieve missing names
  for (let tx of swaps) {
    if (empty(tx.platform) || tx.platform.match(/^hen/)) tx.platform = 'hen'
  }

  for (let tx of trades) {
    if (empty(tx.platform) || tx.platform.match(/^hen/)) tx.platform = 'hen'
  }

  // artist sales
  for (let tx of swaps) {
    if (empty(tx.token)) {
      console.error('missing token', tx)
      continue
    }
    else if (empty(tx.token.creator)) {
      console.error('invalid token data', tx.token)
      continue
    }

    if (tx.token.creator.address != tx.creator.address) continue; // 2nd market sale by artist
    tx.type = 'swap';
    tx.swap_id = tx.id;
    if (empty(tx.token.creator.name)) tx.token.creator.name = getOrFindArtist(tx.token.creator, false);
    if (tx.price != 'pending') {
      tx.extended_price = parseInt(tx.price)
      tx.price = Number(parseFloat(tx.extended_price) / AppConst.HEN_DECIMALS).round(2)
    }
    let date = new Date(tx.timestamp);
    if (empty(sales[tx.token.uuid])) sales[tx.token.uuid] = {
      dom_id: 'swap_' + tx.token.uuid,
      tx: tx,
      swaps: [],
      date: date.getTime()
    }

    let span = document.createElement("span")
    if (tx.price == 'pending') {
      ReactDOM.render(<>
        Minted - {formattedDate(date, 'absolute')}<br />
      </>, span)
      sales[tx.token.uuid].tx.pending = true;
    } else {
      ReactDOM.render(<>
        {tx.amount}x{tx.price}tz - {formattedDate(date, 'absolute')}<br />
      </>, span)
      sales[tx.token.uuid].tx.pending = false;
      if (tx.amount_left > 0) {
        tx.style = 'primary'
        if (empty(sales[tx.token.uuid].buy)) sales[tx.token.uuid].buy = tx
        else if (sales[tx.token.uuid].buy.price > tx.price) sales[tx.token.uuid].buy = tx
      }
    }
    if (sales[tx.token.uuid].swaps.length < 5) sales[tx.token.uuid].swaps.push(span.innerHTML);
  }

  // collected by artists
  for (let tx of trades) {
    if (empty(tx.token)) {
      console.error('missing token', tx)
      continue
    }
    else if (empty(tx.token.creator)) {
      console.error('invalid token data', tx.token)
      continue
    }

    tx.type = 'collect';
    tx.swap_id = tx.swap.id;
    tx.extended_price = parseInt(tx.swap.price)
    tx.price = Number(parseFloat(tx.extended_price) / AppConst.HEN_DECIMALS).round(2)

    if (empty(tx.token.creator.name)) tx.token.creator.name = getOrFindArtist(tx.token.creator, false);
    if (empty(tx.buyer.name)) tx.buyer.name = getOrFindArtist(tx.buyer, false);
    let date = new Date(tx.timestamp);
    if (empty(collected[tx.token.uuid])) {
      collected[tx.token.uuid] = {
        dom_id: 'collect_' + tx.token.uuid,
        tx: tx,
        swaps: {},
        date: date.getTime()
      }
    }
    if (empty(collected[tx.token.uuid].swaps[tx.buyer.address])) {
      collected[tx.token.uuid].swaps[tx.buyer.address] = { buyer: tx.buyer, amount: 0, price: tx.price }
    }
    collected[tx.token.uuid].swaps[tx.buyer.address].amount += 1
    collected[tx.token.uuid].price = tx.price

    if (tx.swap.amount_left > 0 && tx.swap.status != 'cancelled') {
      tx.amount_left = tx.swap.amount_left
      tx.style = tx.swap.seller_id == tx.token.creator.address ? 'primary' : 'secondary'
      if (empty(collected[tx.token.uuid].buy)) collected[tx.token.uuid].buy = tx
      else if (collected[tx.token.uuid].buy.price > tx.price) collected[tx.token.uuid].buy = tx
    }

  }

  let list = []
  sales = toSortedArray(sales)
  for (let tx of sales) {
    if (tx.swaps.length > 1) tx.swaps = tx.swaps.filter(e => !e.match(/minted/i))
    list.push(tx.tx.token.pk_id)
  }
  memoDrops(sales)

  collected = toSortedArray(collected)
  for (let tx of collected) list.push(tx.tx.token.pk_id)
  memoCollected(collected)
  done()
};

function ShowTransaction({ item }) {
  let tx = item.tx
  let buy = item.buy
  let swaps = item.swaps
  let token = tx.token
  if (empty(token.supply) || (token.supply <= 0)) return null

  if (buy) buy.full = 'short'

  tx.token.show_platform = true
  if (tx.type == 'swap') {
    return (
      <div id={item.dom_id} className={`nft ${tx.type}`} data-token={token.pk_id}>
        <ShowTrade token={token} transaction={buy} type={tx.type} swaps={swaps} />
      </div>
    )
  }
  else {
    return (
      <div className='collected'>
        <div id={item.dom_id} className={`nft ${tx.type}`} data-token={token.pk_id}>
          <ShowTrade token={token} transaction={buy} type={tx.type} swaps={swaps} />
        </div>
        <div className='collectors'>
          <b>Collected by</b>
          <div className='transactions'>
            {Object.values(swaps).slice(0, 20).map((swap, idx) => {
              return (
                <span className='trx' key={idx}>
                  {activity_link(swap.buyer)} :
                  {swap.amount > 1 ? (<b>{swap.amount}x{swap.price}tz</b>) : (<>{swap.amount}x{swap.price}tz</>)}<br />
                </span>
              )
            })}
          </div>
        </div>
        <br clear="all" />
      </div>
    )
  }
}

function updateInterface() {
  let val = urlParams.get("load") || document.getElementById("load").value
  if (!empty(val)) {
    localStorage.setItem("load", val)
    document.getElementById("wallets").readOnly = true
    document.getElementById("btn_save").style.display = 'none'
  }
  else {
    localStorage.removeItem("load")
    document.getElementById("wallets").readOnly = false
    document.getElementById("btn_save").style.display = 'inline-block'
  }

}

async function copyText(evt) {
  if (evt) evt.preventDefault()
  let txt = document.getElementById("wallets");
  txt.select();
  txt.setSelectionRange(0, 99999); /* For mobile devices */
  await navigator.clipboard.writeText(txt.value);
}

export default function Follow() {
  const [drops, setDrops] = useState([])
  const [collected, setCollected] = useState([])
  const [error, setError] = useState(false)
  const [showForm, setShowForm] = useState(true)

  useEffect(() => {
    // always reload artist on first page load
    Artists.loaded = false
    let val = urlParams.get("load")
    if (empty(val)) val = localStorage.getItem("load")

    if (!empty(val)) {
      let div = document.getElementById("load")
      if (div) div.value = val;
      urlParams.set("load", val)
      update_current_href()
    }
    refreshList(empty(val));
    ReactDOM.render(<WalletConnector />, document.getElementById("wallet_connector_container"))
  }, []);

  const changeLoad = (evt) => {
    if (!evt || evt.key === 'Enter' || evt._reactName == 'onBlur') {
      let val = document.getElementById("load").value;
      if (empty(val)) urlParams.delete("load")
      else urlParams.set("load", val)
      update_current_href();
      refreshList(empty(val));
    }
  }

  async function refreshList(artist_from_storage, evt) {
    if (evt) evt.preventDefault()
    let adr = await Wallet.connectedWalletAddress()
    if (!adr) {
      setError('You must connect your wallet to use this tool. Once connected, reload the page.')
      setShowForm(false)
      return null
    }

    loading(true)
    setError(false)

    if (!artist_from_storage) Artists.loaded = false
    await loadArtists({ storage_only: artist_from_storage, update: !artist_from_storage });
    wallets = Artists.getWallets()

    if (!empty(wallets)) {
      fetchTransactions(setDrops, setCollected);
      updateInterface()
    }
    else {
      setError('You must add some wallets to follow to start.')
      done()
    }
  }

  return (
    <>
      <div id="input" className="block">
        <Head>
          <title>Follow wallets - TEZOS NFTs</title>
        </Head>
        <Home title="Monitored wallets" />

        {error && (
          <b>{error}</b>
        )}

        {showForm && (
          <>
            <label htmlFor="load" style={{ display: 'block', fontWeight: 'bold' }}>Paste the URL of a text file (hosted elsewhere) to load wallets from (same format than below)</label>
            <input id="load" name="load"
              onBlur={e => changeLoad(e)}
              onKeyPress={e => changeLoad(e)}
              style={{ display: 'block', width: '100%', margin: '10px 0px' }}>
            </input>
            <label htmlFor="wallets" style={{ display: 'block', fontWeight: 'bold' }}>or enter tezos wallets to watch <br />
              (1 wallet per line, and you can add artist name by preceding it with a # symbol).
            </label>
            <textarea id="wallets" style={{ display: 'block', width: '100%', height: '50px', margin: '10px 0px' }}></textarea>
            <div className='block multi-btn'>
              <Button variant="secondary" id="btn_save" onClick={e => refreshList(false, e)}>Save</Button>
              <Button variant="secondary" id="btn_reload" onClick={e => refreshList(true, e)}>Reload</Button>
              <Button variant="secondary" id="btn_copy" onClick={e => copyText(e)}>Copy</Button>
              <Link href="/artist/follow">
                <a className='btn btn-secondary'>Manage</a>
              </Link>
              <span className="d-none d-md-inline-block">Data are stored in your browser, keep a backup.</span>

              <Link href="/feed">
                <a className='btn btn-secondary right'>Mints</a>
              </Link>
            </div>
          </>
        )}
      </div>

      <Result>
        {!error && (
          <Row style={{ height: '100%', overflow: 'auto' }}>
            <Col xs="12" lg="8">
              <h4>
                Sales
                <span className='subtitle'>Direct sales from followed artists</span>
              </h4>
              <div id="swap" className="collections">
                {drops.map((item, index) => (
                  <ShowTransaction item={item} key={item.dom_id} />)
                )}
              </div>
            </Col>
            <Col xs="12" lg="4">
              <h4>
                Collected
                <span className='subtitle'>NFTs collected by followed artists or collectors</span>
              </h4>
              <div id="collect" className="collections">
                {collected.map((item, index) => (
                  <ShowTransaction item={item} key={item.dom_id} />
                )
                )}
              </div>
            </Col>
          </Row>
        )}
      </Result>
    </>
  )
}

Follow.layout = 'skip_result'