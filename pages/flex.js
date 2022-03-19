import React, { useEffect, useState } from 'react';
import Head from 'next/head'
import InfiniteScroll from 'react-infinite-scroll-component'
import Form from 'react-bootstrap/Form'

import { ShowTrade } from '../components/show_trade'
import { WalletField } from '../components/wallet_field';

import * as AppConst from '../utils/constants'
import { Result } from '../components/result';
import { connectedWalletAddress } from '../utils/wallet'
import {
  fetchWalletBuys, fetchWalletGifts, collectorFlexStats
} from '../utils/wallet_activity'

import {
  empty, loading, done, urlParams, update_current_href, update_by_artist,
  formattedDate, loadArtists, get_wallet, fetchGraphQL, showError,
} from '../utils/utils'

const trade_query = `
query qryNftBiker($list: [bigint!]) {
  ask(where: {token_id: {_in: $list}, status: {_eq: "active"}, platform: {_neq: "hen1"}, amount_left: {_gt: 0}}) {
    id
    platform
    token_id
    price
    timestamp
    amount
    amount_left
    status
    seller_id:creator_id
    creator {
      address
      name
    }
  }
}
`

var current_date = '';
var show_gift = false;
var transactions = []
var wallet = null
var connected_wallet = null
var swaps = {}

async function retrieveSwapInfos() {
  swaps = {}
  connected_wallet = await connectedWalletAddress()
  if (empty(wallet)) return
  else if (wallet == connected_wallet) return

  let creators = transactions.reduce(function (acc, obj) {
    if (obj.token?.creator) acc[obj.token.pk_id] = obj.token.creator.address
    return acc
  }, {})
  let list_id = transactions.filter(t => t.token).map(t => t.token.pk_id).filter(e => e)

  const { errors, data } = await fetchGraphQL(trade_query, "qryNftBiker", { "list": [...new Set(list_id)] });
  if (errors) return showError(errors);

  swaps = data.ask.reduce(function (result, swap) {
    if (swap.amount_left <= 0) return result
    if (swap.platform.match(/^hen/)) swap.platform = 'hen'
    swap.swap_id = swap.id
    swap.extended_price = swap.price
    swap.price = (swap.price / AppConst.HEN_DECIMALS).round(2)
    let key = swap.token_id
    if (empty(result[key])) result[key] = swap
    else if (swap.extended_price < result[key].extended_price) result[key] = swap
    else if (swap.extended_price == result[key].extended_price) {
      if (swap.creator_id == creators[swap.token_id]) result[key] = swap
      else if (swap.timestamp < result[key].timestamp) result[key] = swap
    }
    return result
  }, {})
}

const ViewTrade = (props) => {
  let tx = props.tx
  let new_day = props.new_day
  let token = tx.token
  if (!token) {
    console.debug('token not found', tx)
    return null
  }
  let date = formattedDate(tx.date, 'date')

  let infos = {}
  if (new_day) {
    infos.flex_id = `d_${String(date).replace(/[^0-9a-z]+/gm, '')}`
    infos.date = date
  }

  token.swap = swaps[token.pk_id]
  token.show_platform = true
  return (
    <>
      {new_day && (
        <h3 className='clearfix' id={infos.flex_id}>
          {infos.date}
        </h3>
      )}
      <div id={tx.dom_id} className='nft'>
        <ShowTrade token={token} transaction={tx} type='flex' />
      </div>
    </>
  )
}

export default function Flex() {
  const [items, setItems] = useState([])
  const [stats, setStats] = useState({})
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (urlParams.get("gifts") == '1') {
      show_gift = true
      document.getElementById("gifts").checked = true
    }
  }, []);

  const screenshotMode = () => {
    let val = document.getElementById("screenshot_mode").checked
    if (val) flex.classList.add("screenshot")
    else flex.classList.remove("screenshot")
  }

  const changeGift = () => {
    let val = document.getElementById("gifts").checked
    if (val) {
      urlParams.set("gifts", '1')
      show_gift = true
    }
    else {
      urlParams.delete('gifts')
      show_gift = false
    }
    update_current_href()
    showCollected(0);
  }

  async function showCollected(force_offset) {
    let current_offset = !empty(force_offset) ? force_offset : offset
    if (current_offset == 0) current_date = null

    let new_offset = current_offset + 100
    let list = transactions.slice(offset, new_offset)

    setItems(items.concat(list))
    setOffset(new_offset)
  }

  async function flexCollected() {
    wallet = get_wallet()
    loading(true)
    await loadArtists({ storage_only: true })

    transactions = []
    let data = null
    data = await fetchWalletBuys(true)
    if (data) transactions = transactions.concat(data);
    data = await fetchWalletGifts(true)
    if (data) transactions = transactions.concat(data);
    let trades = {}
    transactions.forEach(tx => {
      tx.dom_id = `token_${tx.uuid}`
      if (trades[tx.dom_id]) {
        trades[tx.dom_id].amount += tx.amount
      } else {
        trades[tx.dom_id] = tx
      }
    })
    transactions = Object.values(trades)

    await retrieveSwapInfos()
    transactions = transactions.sort(function (a, b) {
      return b.date - a.date;
    });
    await buildStats()
    await showCollected(0);
    done()
  }

  async function buildStats() {
    if (empty(transactions)) return null
    let collector = transactions.find(e => !empty(e.buyer?.name));
    update_by_artist(collector?.buyer?.name, "someone")
    let data = await collectorFlexStats(transactions)
    setStats(data)
  }

  return (
    <>
      <div id="input" className='block'>
        <Head>
          <title>Flex - TEZOS NFTs</title>
        </Head>
        <h2>View latest artworks collected <span id='by_artist'>&nbsp;</span></h2>
        <WalletField monitoring={{
          bookmarklet: { title: 'Flex collection', path: 'flex' },
          method: flexCollected,
        }} />
      </div>

      {!empty(stats) && (
        <div id="collector" className='block'>
          <span>
            Artworks collected : <b>{stats.total_collected}</b> &bull;
            Distinct artists : <b>{stats.distinct_artists}</b> &bull;
            Average : <b>{stats.average} artworks/day</b> &bull;
            Active days : <b>{stats.active_days}</b> &bull;
            First/Last collected: <b>{stats.first_collected} -&gt; {stats.last_collected}</b>
          </span>
        </div>
      )}

      <div id='filters'>
        <div className='block inline'>
          <Form.Check
            inline
            type="switch"
            id="gifts"
            label="Include gifts"
            onClick={changeGift}
          />

          <Form.Check
            inline
            type="switch"
            id="screenshot_mode"
            label="Screenshot view"
            onClick={screenshotMode}
          />
        </div>
      </div>

      <Result>
        <InfiniteScroll
          dataLength={items.length}
          next={showCollected}
          scrollThreshold='300px'
          hasMore={true}
          loader={undefined}
        >
          <div id="flex">
            {items.map(tx => {
              let date = formattedDate(tx.date, 'date')
              let new_day = date != current_date
              current_date = date
              if (tx.price == 'otc' && !show_gift) return null
              return (<ViewTrade tx={tx} wallet={wallet} new_day={new_day} key={tx.dom_id} />)
            })}
          </div>
        </InfiniteScroll>
      </Result>
    </>
  )
}
Flex.layout = 'skip_result'