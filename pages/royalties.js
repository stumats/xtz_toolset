import React from 'react';
import ReactDOM from 'react-dom'
import $ from 'jquery'
import Head from 'next/head'
import * as AppConst from '../utils/constants'
import { AbsoluteDate } from '../components/absolute_date'
import { CopyTable } from '../components/copy_table'

import Button from 'react-bootstrap/Button'
import ButtonGroup from 'react-bootstrap/ButtonGroup'

import { WalletField } from '../components/wallet_field';
import {
  empty, loading, done, fetchGraphQL, showError, extractTrades, loadArtists, Artists,
  formattedDate, getWalletName, add_timeago, proper_value, platform_name, get_wallet,
} from '../utils/utils'
import { shorten_wallet, nft_link, flex_link, gallery_link, history_link, twitter_link } from '../utils/links'

var transactions = [];
var tokens = [];
var total_artist, total_sales, total_royalties, total_collectors, total_fees, total_primary, total_secondary
var royalties_first, royalties_second
var wallet, artistInfos
var wallets = []

const query_objkts = `
query qryNftBiker($wallets: [String!]) {
  token(where: {creator_id: { _in: $wallets }, supply: {_gt: 0}}) {
    id
    uuid
    title
    supply
    royalties
    mime
    display_uri
    artifact_uri
    thumbnail_uri
    creator {
      address
      name
      twitter
    }
    fulfilled_asks(where: {buyer: {address: {_nin: $wallets}}}, order_by: {timestamp: desc}) {
      id
      platform
      objkt_id
      timestamp
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
    }
    bids(where: {status: {_eq: "concluded"}, creator: {address: {_nin: $wallets}}}, order_by: {timestamp: desc}) {
      id
      platform
      price
      timestamp:update_timestamp
      status
      royalties
      objkt_id
      buyer:creator {
        address
        name
      }
      seller {
        address
        name
      }
    }
    english_auctions(where: { status: {_eq: "concluded"}, highest_bid: {_gt:0}, highest_bidder_id: {_nin: $wallets}}) {
      id
      platform
      price:highest_bid
      timestamp:update_timestamp
      status
      buyer_id:highest_bidder_id
      buyer:highest_bidder {
        name
        address
        twitter
      }
      seller_id:creator_id
      seller:creator {
        address
        name
        twitter
      }
    }
  }
}
`


function filterByMarket(type) {
  if (empty(type)) $('tr').show();
  else {
    $('#royalties tbody tr').each(function () {
      if ($(this).hasClass(type)) $(this).show();
      else $(this).hide()
    });
  }
}

function initData() {
  transactions = [];
  tokens = [];
  total_artist = 0;
  total_sales = 0;
  total_royalties = 0
  total_collectors = 0
  total_fees = 0
  total_primary = 0
  total_secondary = 0
  royalties_first = 0
  royalties_second = 0
}


async function getObjktsFromWallet(wallets) {
  const { errors, data } = await fetchGraphQL(query_objkts, "qryNftBiker", { "wallets": wallets });
  if (errors) return showError(errors);
  return data.token
}

async function fetchWalletRoyalties() {
  wallets = get_wallet({ multiple: true })
  if (empty(wallets)) return;

  loading(true);
  await loadArtists({ storage_only: true })
  initData();
  tokens = await getObjktsFromWallet(wallets);

  let normalized = await extractTrades(tokens)
  let trades = normalized.trades
  if (normalized.filled.length > 0) trades = trades.concat(normalized.filled);
  if (normalized.bids.length > 0) trades = trades.concat(normalized.bids);
  if (normalized.english.length > 0) trades = trades.concat(normalized.english);

  if (!empty(trades)) {
    for (let tx of trades) {
      let token = tx.token
      if (empty(token)) token = { royalties: 0, creator: { name: '', address: '' } }

      if (empty(tx.platform)) tx.platform = 'hen'
      tx.date = new Date(tx.timestamp)

      let price = parseFloat(tx.price) * tx.amount / AppConst.HEN_DECIMALS
      tx.royalties = price * token.royalties / 1000

      if (wallets.includes(tx.seller.address)) {
        tx.sale = 'primary'
        tx.collected = price * (1 - AppConst.HEN_FEE / 1000)
        total_primary += price
        total_artist += price * (1 - (token.royalties + AppConst.HEN_FEE) / 1000)
      } else {
        tx.sale = 'secondary'
        tx.collected = price * token.royalties / 1000
        total_secondary += price
        total_collectors += price * (1 - (token.royalties + AppConst.HEN_FEE) / 1000)
      }

      total_sales += price
      total_fees += price * AppConst.HEN_FEE / 1000

      let val = price * token.royalties / 1000
      if (tx.sale == 'primary') royalties_first += val
      else royalties_second += val
      total_royalties += val

      tx.total = Number(price).round(2)
      tx.collected_royalties = Number(price * token.royalties / 1000).round(2)
      if (Artists.loaded) {
        if (empty(tx.buyer.name)) tx.buyer.name = proper_value(Artists.get(tx.buyer.address))
        if (empty(token.creator.name)) token.creator.name = proper_value(Artists.get(token.creator.address));
      }
      transactions.push(tx);
    }
  }
  return true
}

async function fetchRoyalties() {
  loading();
  await fetchWalletRoyalties();
  transactions = transactions.sort(function (a, b) {
    return b.date - a.date;
  });

  if (wallets.length > 1) {
    artistInfos = { multiple: true }
  }
  else {
    artistInfos = { address: wallet }
    let meta = tokens[0]
    if (!empty(meta)) {
      artistInfos.name = meta.creator.name;
      artistInfos.twitter = meta.creator.twitter;
    }
    if (empty(artistInfos.name)) artistInfos.name = await getWalletName(wallet, false);
  }

  ReactDOM.render(RoyaltiesTrades(transactions), document.getElementById('result'));
  done();

  $('#filter_all').on("click", () => {
    filterByMarket()
  })
  $('#filter_primary').on("click", () => {
    filterByMarket('primary')
  })
  $('#filter_secondary').on("click", () => {
    filterByMarket('secondary')
  })
  add_timeago()
}

const RoyaltiesTrades = (transactions) => {
  return (
    <>
      <p style={{ margin: '0', padding: '0em 0em 1em 2px' }}>
        <b>
          {artistInfos.multiple ? (
            <>Summary for multiple wallets</>
          ) : (
            <>Summary for {gallery_link(artistInfos)} {twitter_link(artistInfos.twitter, true)}</>
          )}
        </b>
        <br />
        <b>Total sales (incl. fee & royalties): </b> {Number(total_sales).round(2)}tz
        - Primary sales : {Number(total_primary).round(2)}tz
        - Secondary sales : {Number(total_secondary).round(2)}tz
        <br />
        <b>Total for artist : </b> {Number(total_artist + total_royalties).round(2)}tz
        - Sales: {Number(total_artist).round(2)}tz
        - Royalties : {Number(total_royalties).round(2)}tz
        (1st market: {Number(royalties_first).round(2)}tz - 2nd market: {Number(royalties_second).round(2)}tz)
        <br />
        <b>Total for collectors : </b> {Number(total_collectors).round(2)}tz &bull;
        <b>Fees : </b> {Number(total_fees).round(2)}tz
      </p>
      <div id="filters" className='block'>
        <ButtonGroup>
          <Button variant="secondary" id="filter_all">All</Button>
          <Button variant="secondary" id="filter_primary">Primary</Button>
          <Button variant="secondary" id="filter_secondary">Secondary</Button>
        </ButtonGroup>
        <AbsoluteDate />
      </div>

      <CopyTable id='royalties'>
        <table>
          <thead>
            <tr>
              <th className='right'>Date</th>
              <th>Token</th>
              {artistInfos.multiple && (
                <th>Artist</th>
              )}
              <th>Title</th>
              <th>Type</th>
              <th>Platform</th>
              <th>Seller</th>
              <th>Buyer</th>
              <th className='right'>Price</th>
              <th className='right'>% Royalties</th>
              <th className='right'>Royalties</th>
              <th className='right'>Tot. artist</th>
              <th>History</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, index) => {
              let token = tx.token
              let buyer_name = token.creator.address == tx.buyer.address ? 'creator' : (empty(tx.buyer.name) ? shorten_wallet(tx.buyer.address) : tx.buyer.name);
              let seller_name = token.creator.address == tx.seller.address ? 'creator' : (empty(tx.seller.name) ? shorten_wallet(tx.seller.address) : tx.seller.name);
              return (
                <tr key={index} className={tx.sale}>
                  <td className='right'>{formattedDate(new Date(tx.timestamp))}</td>
                  <td>{nft_link(token.uuid)}</td>
                  {artistInfos.multiple && (
                    <td>{gallery_link(token.creator)}</td>
                  )}
                  <td>{tx.token.title.slice(0, 50)}</td>
                  <td>{tx.sale}</td>
                  <td>{platform_name(tx.platform)}</td>
                  <td>{gallery_link({ address: tx.seller.address, name: seller_name })}</td>
                  <td>{flex_link({ address: tx.buyer.address, name: buyer_name })}</td>
                  <td className='right currency'>{tx.total}tz</td>
                  <td className='right'>{Number(tx.token.royalties / 10).round(2)}&nbsp;%</td>
                  <td className='right currency'>{Number(tx.royalties).round(2)}tz</td>
                  <td className='right currency op_sale'>{Number(tx.collected).round(2)}tz</td>
                  <td>{history_link(token.uuid || token.id)}</td>
                </tr >
              )
            })}
          </tbody>
        </table>
      </CopyTable>
      <br clear="all" />
      <p><b>Help</b></p>
      <ul>
        <li>Total : total price (including fees and royalties)</li>
        <li>Collected : total royalties collected</li>
      </ul>
      <p>No guarantee of any kind provided by this tool. Use it at your own risk.</p>
    </>
  )
}

export default function Royalties() {
  return (
    <div id="input" className="block">
      <Head>
        <title>Royalties - TEZOS NFTs</title>
      </Head>

      <h2>All royalties (1st & 2nd market) for a wallet (or a group of wallets)</h2>
      <WalletField
        monitoring={{
          bookmarklet: { title: 'Royalties', path: 'royalties' },
          method: fetchRoyalties,
          multiple: true
        }} />
    </div>
  )
}