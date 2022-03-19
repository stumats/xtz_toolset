import React, { useEffect, useState } from 'react';
import Head from 'next/head'
import * as AppConst from '../../utils/constants'
import { Home } from '../../components/home';
import { Result } from '../../components/result'
import Link from 'next/link';

import {
  empty, loading, done, showError, formattedDate, fetchGraphQL, sql_date, platform_name,
  getObjktsById, getWalletsInfos, urlParams, update_current_href, fa2_to_platform, format_number,
} from '../../utils/utils'
import { gallery_link, history_link, nft_link, get_artwork_link, flex_link, is_hen } from '../../utils/links'

import { getBannedWallets, getBannedObjkts } from '../../utils/banned'
import { buildStatMenu } from '../../utils/menu';

const SKIP_TOKENS = [
  'KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton_23711',
  'KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton_28841',
  'KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton_31983',
  'KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton_131159'
]
const LIMIT = 100

// wash trading to get hDAO
const SKIP_CREATORS = [
  'tz1RmuzUDF82LcS4a1NDq3vVdycTzF2Evpgi',
  'tz1XPcu86MbxHs8Djg1PG65TD4RE23a2E7vY',
  'tz1W9KPJQQg5kXpygX7z9TSGAx2sqUFZF8Ph',
  'tz1cVH1jz2qjLNGaqvtm3wnYMLpPy9xQE2L6',
  'tz1eRdK9wr4PZDkFMQoW2DzyxN8ZV4irmiGJ',
  'tz1UuMv5Nz1LgcjvE6SBWccimKKVy48jqf4p',
  'tz1bJkZ84CDRawefDHNoKtsK7d94bPrfS8sb',
  'tz1VWBwFKLq6TCrPEVU8sZDfrcbx9buqMxnZ',
  'tz1e52CpddrybiDgawzvqRPXthy2hbAWGJba',
  'tz1NufWtpqS3nfR8VW1xFyWq4GWqb969keeR',
  'tz1brWgKJ6L8wKoYUiqZ2RzRctjvJqykc6S4',
  'tz1ch5WHJDZbbFR8R98cDkriVMwFP6RN9it2',
  'tz1L6qoCzs48QJGubk4iCPacE6S69Pmd6TT2'
]

var cached = {}

async function prepareStats(data) {
  let ask = data.ask
  let bid = data.bid
  let english = data.english.map(e => {
    e.amount = 1
    return e
  })
  let transactions = bid.concat(ask).concat(english).sort((a, b) => b.price - a.price).filter(e => {
    let uuid = `${e.fa2_id}_${e.objkt_id}`
    return !SKIP_TOKENS.includes(uuid)
  }).slice(0, LIMIT)

  let list = transactions.map(e => String(e.token_id))
  let objkts = await getObjktsById([...new Set(list)])

  list = transactions.map(e => e.buyer_id).concat(transactions.map(e => e.seller_id))
  let names = await getWalletsInfos([...new Set(list)])

  for (let trade of transactions) {
    let info = null
    info = names[trade.buyer_id]
    if (trade.platform.match(/^hen/)) trade.platform = 'hen'
    if (!empty(info)) trade.buyer = info
    else trade.buyer = { address: trade.buyer_id, name: null }

    info = names[trade.seller_id]
    if (!empty(info)) trade.seller = info
    else trade.seller = { address: trade.seller_id, name: null }

    trade.objkt_id = String(trade.objkt_id)
    let token = objkts.find(o => o.pk_id == trade.token_id)
    trade.token = token
  }
  return transactions
}


const top_fragment = `
  fa2_id
  objkt_id
  timestamp
  token_id
  seller_id
  artist_id
  buyer_id
  price
  amount
  platform
`

const english_fragment = `
  platform
  fa2_id
  objkt_id
  timestamp:update_timestamp
  token_id
  seller_id:creator_id
  artist_id
  buyer_id:highest_bidder_id
  price:highest_bid
`

const top_single = `
query topSales($ask: marketplace_ask_bool_exp!, $bid: marketplace_bid_bool_exp!, $english: english_auction_bool_exp!, $limit: Int! = 100) {
  ask:marketplace_ask(where: $ask, order_by: {price: desc}, limit: $limit) {
    ${top_fragment}
  }
  bid:marketplace_bid(where: $bid, order_by: {price: desc}, limit: $limit) {
    ${top_fragment}
  }
  english:english_auction(where: $english, order_by: {highest_bid: desc_nulls_last}, limit: $limit) {
    ${english_fragment}
  }
}
`

const top_multi = `
query topSales($conditions: token_bool_exp!, $limit: Int! = 100) {
  token(where: $conditions, order_by: {primary_total: desc}, limit: $limit) {
    pk_id
    uuid
    fa2_id
    id
    primary_count
    primary_total
    supply
    timestamp
    title
    mime
    display_uri
    creator_id
    creator {
      address
      name
      twitter
    }
  }
}
`

const PlatformFilter = (props) => {
  if (empty(props.type)) return null
  let platform = props.type.split('_').pop()
  if (empty(platform)) platform = 'all'
  return (
    <div className="filter_form me-3 mb-2">
      <label className="form-label">Platform</label>
      <div className="btn-group ms-2" role="group" onChange={event => props.select(event)}>
        <input type="radio"
          className="btn-check btn-sm"
          name="platform"
          id="platform_all"
          value="all"
          readOnly={true}
          checked={platform == 'all'} />
        <label className="btn btn-sm btn-outline-secondary" htmlFor="platform_all">All</label>

        <input type="radio"
          className="btn-check btn-sm"
          name="platform"
          id="platform_hen"
          value="hen"
          readOnly={true}
          checked={platform == 'hen'} />
        <label className="btn btn-sm btn-outline-secondary" htmlFor="platform_hen">HEN</label>

        <input type="radio"
          className="btn-check btn-sm"
          name="platform"
          id="platform_versum"
          value="versum"
          readOnly={true}
          checked={platform == 'versum'} />
        <label className="btn btn-sm btn-outline-secondary" htmlFor="platform_versum">VERSUM</label>

        <input type="radio"
          className="btn-check btn-sm"
          name="platform"
          id="platform_bid"
          value="bid"
          readOnly={true}
          checked={platform == 'bid'} />
        <label className="btn btn-sm btn-outline-secondary" htmlFor="platform_bid">OBJKT</label>
      </div>
    </div>
  )
}

const ShowTop = (props) => {
  let trades = props.trades
  if (empty(trades) || !trades) return null

  let m = props.type.split('_')
  let type = m[0]
  let platform = m[1]

  let title = '24 hours';
  if (type == '30') title = '30 days';
  else if (type == '7') title = '7 days';

  if (type == 'all') title = 'BIGGEST SINGLE SALES - LEGEND ... WAIT FOR IT... ARY !'
  else title = `TOP SINGLE SALES IN THE LAST ${title}`
  if (!empty(platform) && platform != 'all') {
    let name = platform_name(platform).toUpperCase().replace(/(V[0-9]+)$/, '')
    title += ` # ${name}`
  }
  return (
    <>
      <h4>{title.toUpperCase()}</h4>
      <PlatformFilter type={props.type} select={props.select} />

      <table>
        <thead>
          <tr>
            <th className='right'>Rank</th>
            <th className='right'>Token</th>
            <th>Type</th>
            <th>Creator</th>
            <th>Title</th>
            <th className='right'>Ed.</th>
            <th>Seller</th>
            <th>Buyer</th>
            <th className='right'>Price</th>
            <th>Platform</th>
            <th className='right'>Date</th>
            <th>History</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade, index) => {
            let token = trade.token;
            if (empty(token)) return null
            let platform = platform_name(trade.platform)

            let cls = null
            if (bannedWallets.includes(token.creator_id)) cls = "tx_error"
            else if (is_hen(token.uuid) && bannedObjkts.includes(token.id)) cls = "tx_error"

            return (
              <tr key={index} className={cls}>
                <td className='right'>{index + 1}</td>
                <td className='right'>{nft_link(token.uuid)}</td>
                <td>{get_artwork_link(token)}</td>
                <td>{gallery_link(token.creator)}</td>
                <td>{token.title.slice(0, 40)}</td>
                <td className='right'>{token.supply}</td>
                <td>{gallery_link(trade.seller)}</td>
                <td>{flex_link(trade.buyer)}</td>
                <td className='right'>{format_number((trade.price / 1000000).round(0))}tz</td>
                <td>{platform}</td>
                <td className='right'>{formattedDate(new Date(trade.timestamp))}</td>
                <td>{history_link(token.uuid)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}


const ShowMulti = (props) => {
  let tokens = props.tokens
  if (empty(tokens) || !tokens) return null

  let platform = props.type.split('_').pop()

  let title = 'BIGGEST MULTI-EDITIONS SALES ON PRIMARY MARKET'
  if (!empty(platform) && platform != 'all') title += ` # ${platform_name(platform).toUpperCase()}`

  return (
    <>
      <h4>{title.toUpperCase()}</h4>
      <p>Data are cached, to prevent hammering API - Refresh is done every hour</p>
      <PlatformFilter type={props.type} select={props.select} />
      <table>
        <thead>
          <tr>
            <th className='right'>Rank</th>
            <th className='right'>Token</th>
            <th>Type</th>
            <th>Creator</th>
            <th>Title</th>
            <th className='right'>Ed.</th>
            <th>Sold</th>
            <th className='right'>Total</th>
            <th>Platform</th>
            <th>Created</th>
            <th>History</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token, index) => {
            if (empty(token)) return null
            let artwork_link = get_artwork_link(token);
            let cls = null
            if (bannedWallets.includes(token.creator_id)) cls = "tx_error"
            else if (is_hen(token.uuid) && bannedObjkts.includes(token.id)) cls = "tx_error"

            return (
              <tr key={index} className={cls}>
                <td className='right'>{index + 1}</td>
                <td className='right'>{nft_link(token.uuid)}</td>
                <td>{artwork_link}</td>
                <td>{gallery_link(token.creator)}</td>
                <td>{String(token.title).slice(0, 50)}</td>
                <td className='right'>{token.supply}</td>
                <td className='right'>{token.primary_count}</td>
                <td className='right'>{format_number((token.primary_total / AppConst.HEN_DECIMALS).round(0))}tz</td>
                <td>{fa2_to_platform(token.uuid)}</td>
                <td>{formattedDate(new Date(token.timestamp), 'date')}</td>
                <td>{history_link(token.uuid)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}

var bannedWallets = []
var bannedObjkts = []

async function fetchMulti(filter) {
  let conditions = {
    supply: { _gt: 1 },
    primary_total: { _gte: 100 * AppConst.HEN_DECIMALS },
    creator_id: { _nin: SKIP_CREATORS }
  }
  let params = { limit: LIMIT }

  if (!empty(filter) && filter != "all") {
    if (filter == 'bid') conditions.fa2_id = { _nin: [AppConst.HEN_OBJKT, AppConst.VERSUM_MINTER, AppConst.FXHASH_OBJKT] }
    else if (filter == 'versum') conditions.fa2_id = { _eq: AppConst.VERSUM_MINTER }
    else conditions.fa2_id = { _eq: AppConst.HEN_OBJKT }
  }
  params.conditions = conditions
  const { errors, data } = await fetchGraphQL(top_multi, "topSales", params)
  if (!empty(errors)) return showError(errors);
  return data.token;
}

async function fetchSingle(type, platform) {
  let params = { limit: LIMIT }
  let conditions = {
    token_id: { _is_null: false },
  }
  if (!empty(platform) && platform != "all") {
    if (platform == 'bid') conditions.fa2_id = { _nin: [AppConst.HEN_OBJKT, AppConst.VERSUM_MINTER, AppConst.FXHASH_OBJKT] }
    else if (platform == 'versum') conditions.fa2_id = { _eq: AppConst.VERSUM_MINTER }
    else conditions.fa2_id = { _eq: AppConst.HEN_OBJKT }
  }

  if (type == 'all') {
    params.ask = conditions
    params.bid = conditions
    params.english = Object.assign({
      status: { _eq: 'concluded' }
    }, conditions)
    params.limit += SKIP_TOKENS.length
  }
  else {
    let date = new Date();
    date.setDate(date.getDate() - parseInt(type));
    let date_str = sql_date(date)

    params.ask = Object.assign({ timestamp: { _gte: date_str } }, conditions)
    params.bid = Object.assign({ timestamp: { _gte: date_str } }, conditions)
    params.english = Object.assign({ update_timestamp: { _gte: date_str }, status: { _eq: 'concluded' } }, conditions)
  }

  const { errors, data } = await fetchGraphQL(top_single, "topSales", params)
  if (!empty(errors)) return showError(errors);
  return data
}

export default function PageContent() {
  const [topType, setTopType] = useState(null)
  const [topData, setTopData] = useState([])

  useEffect(() => {
    let type = urlParams.get("type");
    if (!empty(type) && type != topType) setTopType(type)
    else selectTop('1_all')
    buildStatMenu()
  }, [])

  useEffect(() => {
    fetchTopTrades()
  }, [topType])

  const selectPlatform = (evt) => {
    let platform = evt.target.value
    let type = topType.split('_')[0]
    let val = `${type}_${platform}`
    urlParams.set('type', val)
    update_current_href();
    setTopType(val)
  }

  const selectTop = (type) => {
    let data = type.split('_')
    if (data.length == 1) {
      if (!empty(topType)) type += '_' + topType.split('_').pop()
      else type += '_all'
    }
    urlParams.set('type', type)
    update_current_href();
    setTopType(type)
  }

  async function fetchTopTrades() {
    if (empty(topType)) return
    loading(true);

    if (empty(bannedWallets)) bannedWallets = await getBannedWallets()
    if (empty(bannedObjkts)) bannedObjkts = await getBannedObjkts()

    let transactions = null

    let m = topType.split('_')
    let type = m[0]
    let platform = m[1]

    if (!empty(cached[topType])) transactions = cached[topType]
    else if (type == 'multi') {
      transactions = await fetchMulti(platform)
      cached[topType] = transactions
    }
    else {
      let data = await fetchSingle(type, platform)
      if (!empty(data)) {
        transactions = await prepareStats(data)
        cached[topType] = transactions
      }
    }
    setTopData(transactions)
    done();
  }

  return (
    <div id="input" className='block'>
      <Head>
        <title>Top sales</title>
      </Head>
      <h2>Top sales</h2>

      <div className='block multi-btn'>
        <a onClick={e => selectTop('1')} className='btn btn-secondary'>Last 24 hours</a>
        <a onClick={e => selectTop('7')} className='btn btn-secondary'>Last 7 days</a>
        <a onClick={e => selectTop('30')} className='btn btn-secondary'>Last 30 days</a>
        <a onClick={e => selectTop('all')} className='btn btn-secondary'>Hall of fame</a>
        <a onClick={e => selectTop('multi')} className='btn btn-secondary'>Multi-Edition</a>
      </div>

      <Result>
        {topType && (
          <>
            {topType.match(/^multi/) ? (
              <ShowMulti tokens={topData} type={topType} select={selectPlatform} />
            ) : (
              <ShowTop trades={topData} type={topType} select={selectPlatform} />
            )}
          </>
        )}
      </Result>
    </div>
  )
}

PageContent.layout = 'skip_result'