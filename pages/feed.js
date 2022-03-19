import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'

import InfiniteScroll from 'react-infinite-scroll-component'
import Head from 'next/head'
import { Home } from '../components/home'
import { getBannedWallets } from '../utils/banned'
import * as AppConst from '../utils/constants'
import {
  empty, fetchGraphQL, showError, loadArtists, Artists, urlParams,
  sql_date, update_current_href
} from '../utils/utils'
import { WalletConnector } from '../components/wallet_connector';
import { ShowTrade } from '../components/show_trade'
import { Result } from '../components/result'
import { is_fxhash, is_hen } from '../utils/links'
import Link from 'next/link'
import Form from 'react-bootstrap/Form'

import Masonry from 'react-masonry-css'

const _ = require('lodash');

const latest_feed = (props) => {
  let platform = props.platform
  let supply = props.supply
  let following = props.following
  let where = "pk_id: { _lt: $lastId }, fixed: { _eq: true}"
  let fa2_id = null
  if (platform == 'bid') {
    fa2_id = [AppConst.FXHASH_MINTER, AppConst.VERSUM_MINTER, AppConst.HEN_OBJKT]
    where += `, fa2_id: {_nin: ["${AppConst.FXHASH_OBJKT}","${AppConst.HEN_OBJKT}","${AppConst.VERSUM_MINTER}"]}`
  }
  else {
    if (platform == 'fxhash') fa2_id = AppConst.FXHASH_MINTER
    else if (platform == 'versum') fa2_id = AppConst.VERSUM_MINTER
    else if (platform == 'hen') fa2_id = AppConst.HEN_OBJKT
    if (!empty(fa2_id)) where += `, fa2_id: {_eq: "${fa2_id}"}`
  }
  if (!empty(supply)) where += `, supply: {_gt:0, _lte: ${supply}}`
  else where += ', supply: { _gt: 0 }'

  if (following) where += ', creator_id: { _in: $following, _neq: $skip_creator }'
  else where += ', creator_id: { _neq: $skip_creator }'
  return `
query qryNftBiker($lastId: bigint = 99999999, $following: [String!] = [], $skip_creator: String = "") {
  token(order_by: {pk_id: desc}, limit: 25, where: {${where}}) {
    id
    uuid
    pk_id
    balance
    price
    title
    mime
    artifact_uri
    display_uri
    thumbnail_uri
    moderated
    locked_seconds
    timestamp
    supply
    creator_id
    creator {
      name
      address
      sales_aggregate {
        aggregate {
          count
        }
      }
      tokens_aggregate {
        aggregate {
          count
        }
      }
    }
    asks(where: {is_valid: {_eq: true}, status: {_eq: "active"}, amount_left: {_gt: 0}, platform: {_neq: "hen1"}}, limit:1, order_by:{price: asc}) {
      id
      platform
      status
      amount
      amount_left
      creator_id
      price
    }
  }
}
`
}

const daily_feed = `
query qryNftBiker($lastId: bigint = 99999999, $start: timestamptz!, $end: timestamptz!) {
  token(order_by: {pk_id: desc}, limit: 25, where: {pk_id: {_lt: $lastId}, supply: {_gt: 0}, fixed: {_eq: true}, timestamp: {_gte: $start}, _and: { timestamp: {_lt: $end}}}) {
    id
    uuid
    pk_id
    title
    balance
    price
    mime
    artifact_uri
    display_uri
    thumbnail_uri
    moderated
    locked_seconds
    timestamp
    supply
    creator_id
    creator {
      name
      address
      sales_aggregate {
        aggregate {
          count
        }
      }
      tokens_aggregate {
        aggregate {
          count
        }
      }
    }
    asks(where: {is_valid: {_eq: true}, status: {_eq: "active"}, amount_left: {_gt: 0}, platform: {_neq: 'hen1'}}) {
      id
      platform
      status
      amount
      amount_left
      creator_id
      price
    }
  }
}`

const START_ID = 999999

var clientTimezoneOffset = new Date().getTimezoneOffset() / 60
var restricted = []

const ShowItem = ({ token, following }) => {
  token.creator.sales = token.creator.sales_aggregate?.aggregate?.count || 0
  token.creator.tokens = token.creator.tokens_aggregate?.aggregate?.count || 0
  token.show_platform = true

  let buy = null
  if (is_fxhash(token.uuid)) {
    token.fxhash = true
    if (token.balance > 0) {
      buy = {
        token: token,
        creator_id: token.creator.address,
        timestamp: token.timestamp,
        date: new Date(token.timestamp),
        amount_left: token.balance,
        extended_price: parseInt(token.price),
        swap_id: token.id,
        platform: 'fxhash',
        style: following ? 'primary' : null,
        following: following,
        full: true,
      }
    }
  }
  else {
    buy = empty(token.asks) ? null : Object.assign({}, token.asks[0])
    if (buy) {
      buy.extended_price = parseInt(buy.price)
      buy.price = Number(buy.extended_price / AppConst.HEN_DECIMALS).round(2)
      buy.swap_id = buy.id
      if (empty(buy.platform) || buy.platform.match(/^hen/)) buy.platform = 'hen'
      if (token.creator_id != buy.creator_id) buy.style = 'secondary'
      else buy.style = following ? 'primary' : null

      buy.following = following
      buy.token = token
      buy.full = true
    }
    else {
      // force bid for HEN token to allow bidding
      if (is_hen(token.uuid)) token.force_platform = 'bid'
      token.following = following
    }
  }

  return (<ShowTrade token={token} transaction={buy} type="feed" />)
}

var fullyLoaded = false

const Feeds = () => {
  const [items, setItems] = useState([])
  const [lastId, setLastId] = useState(START_ID)
  const [skipCreator, setSkipCreator] = useState('')
  const [previousCreators, setPreviousCreators] = useState([])
  const [followingArtists, setFollowingArtists] = useState([])
  const [followingOnly, setFollowingOnly] = useState(0)

  const [filters, setFilters] = useState({
    platform: 'all',
    rarity: 0,
    followingOnly: 0
  })

  var masonry = empty(urlParams.get("standard"))

  async function fetchFeed(lastId, skip_creator = '') {
    let params = { "lastId": lastId, "skip_creator": skip_creator }

    let opt = { platform: filters.platform }
    if (filters.rarity && filters.rarity > 0) opt.supply = filters.rarity
    if (filters.followingOnly && filters.followingOnly > 0) {
      params.following = followingArtists
      opt.following = true
    }

    let query = latest_feed(opt)
    let day = urlParams.get("day")

    if (!empty(day)) {
      let date = new Date(`${day}T00:00:00Z`)
      date.setHours(date.getHours() + clientTimezoneOffset)
      params['start'] = sql_date(date) + 'Z'
      date.setDate(date.getDate() + 1)
      params['end'] = sql_date(date) + 'Z'
      query = daily_feed
    }

    const { errors, data } = await fetchGraphQL(query, "qryNftBiker", params);
    if (errors) {
      showError(errors)
      return
    }
    return data.token
  }


  const changeDay = (evt) => {
    if (!evt || evt.key === 'Enter' || evt._reactName == 'onBlur') {
      let val = document.getElementById("day").value
      if (val != urlParams.get("day")) {
        let url = '/feed'
        if (!empty(val)) url = url + `?day=${val}`
        window.location.href = url
      }
    }
  }

  const loadMore = async () => {
    await getLatest(Math.min.apply(Math, items.map(e => e.pk_id)), skipCreator)
  }

  const selectPlatform = (evt) => {
    let val = evt.target.value
    if (empty(filters.platform) || val != filters.platform) {
      urlParams.set("platform", val)
      update_current_href()
      setItems([])
      window.scrollTo(0, 0);
      let newFilters = Object.assign({}, filters)
      newFilters.platform = val
      setFilters(newFilters)
    }
  }

  const ToggleRarity = (evt) => {
    let level = parseInt(evt.target.value)
    if (level == 0) urlParams.delete("rarity")
    else urlParams.set("rarity", level)
    update_current_href()
    setItems([])
    window.scrollTo(0, 0);
    let newFilters = Object.assign({}, filters)
    newFilters.rarity = level
    setFilters(newFilters)
  }

  const ToggleFollowing = () => {
    let checkbox = document.getElementById("following_only")
    let val = checkbox && checkbox.checked ? 1 : 0
    urlParams.set("following", parseInt(val))
    update_current_href()
    setItems([])
    window.scrollTo(0, 0);
    let newFilters = Object.assign({}, filters)
    newFilters.followingOnly = val
    setFilters(newFilters)
  }

  const getLatest = async (id, skip_creator = '') => {
    let result = await fetchFeed(id, skip_creator)
    let min_id = Math.min.apply(Math, result.map(e => e.pk_id))

    // show only one artwork per creators
    // setCreators([...creators, result.map(e => e.creator_id)])
    // result = _.uniqBy(result, 'creator_id')
    // setCreators(creators.concat(result.map(e => e.creator_id)))
    // result = result.filter(e => !creators.includes(e.creator_id))

    result = result.filter(e => !restricted.includes(e.creator_id))
    if (filters.followingOnly > 0 || filters.rarity > 0) skip_creator = ''
    else {
      // in one load, we only show 1 artwork per creator to prevent batch minting overload
      // we keep a list of previous batch creator and add new creators to do the filter
      let new_creators = [...new Set(result.map(e => e.creator_id))]
      result = _.uniqBy(result, 'creator_id')
      setPreviousCreators(new_creators)
      if (new_creators.length > 1) skip_creator = ''
      else if (new_creators.length == 1) skip_creator = new_creators[0]
      setSkipCreator(skip_creator)
    }

    if (empty(result)) return await getLatest(min_id, skip_creator)
    setLastId(min_id)

    const next = items.concat(result)
    setItems(next)
  }

  useEffect(() => {
    async function processFeed() {
      let val = urlParams.get("day")
      if (!empty(val)) document.getElementById("day").value = val

      ReactDOM.render(<WalletConnector />, document.getElementById("wallet_connector_container"))
      await loadArtists({ storage_only: true });
      setFollowingArtists(Artists.getWallets())
      restricted = await getBannedWallets()

      let updated = false
      let newFilters = Object.assign({}, filters)

      val = urlParams.get("platform")
      if (!empty(val) && val != filters.platform) {
        updated = true
        newFilters.platform = val
      }

      val = urlParams.get("rarity")
      if (!empty(val) && parseInt(val) != filters.rarity) {
        updated = true
        newFilters.rarity = parseInt(val)
      }

      val = urlParams.get("following")
      if (!empty(val) && parseInt(val) != filters.followingOnly) {
        updated = true
        newFilters.followingOnly = parseInt(val)
      }

      fullyLoaded = true
      if (updated) setFilters(newFilters)
      else await getLatest(lastId)
    }
    processFeed()
  }, [])

  useEffect(() => {
    if (!fullyLoaded) return
    async function processFeed() {
      await getLatest(START_ID)
    }
    processFeed()
  }, [filters])


  let breakpointMasonry = {
    default: 5,
    1350: 4,
    1080: 3,
    810: 2,
    540: 1
  };

  let platformList = [
    { value: 'all', title: 'All' },
    { value: 'hen', title: 'HEN' },
    { value: 'versum', title: 'VERSUM' },
    { value: 'bid', title: 'OBJKT' },
    { value: 'fxhash', title: 'FXHASH' },
  ]

  let rarityList = [
    { value: 0, title: 'All' },
    { value: 1, title: '1/1' },
    { value: 10, title: '<=10' },
    { value: 25, title: '<=25' },
    { value: 50, title: '<=50' },
    { value: 100, title: '<=100' },
  ]

  return (
    <>
      <div id="input" className="block">
        <Head>
          <title>Latest mints</title>
        </Head>
        <Home title="Latest mints" />
        <p>
          <b>{AppConst.FAKE_WARNING}</b> Green button = primary sale by artist you follow || Black button = primary sale by artist you don't follow || Orange button = secondary sale
        </p>
        <p>
          If you see copymint or fake artwork, please report it on <a href="https://discord.gg/W8vQ7REym7" target='_blank'>HEN discord</a> in #report-copyminters channel.
        </p>
      </div>

      <div className='block inline' id="filters">
        <div className='block inline'>
          <div className='multi-btn'>
            <Link href="/follow">
              <a className='btn btn-secondary right'>Follow</a>
            </Link>
          </div>

          <div className="filter_form me-3 mb-2">
            <label className="form-label">Platform</label>
            <div className="btn-group ms-2" role="group" onChange={event => selectPlatform(event)}>
              {platformList.map((item, idx) => (
                <React.Fragment key={idx}>
                  <input type="radio"
                    className="btn-check"
                    name="platform"
                    id={`platform_${item.value}`}
                    defaultChecked={filters.platform == item.value}
                    value={item.value} />
                  <label className="btn btn-sm btn-outline-secondary"
                    htmlFor={`platform_${item.value}`}>
                    {item.title}
                  </label>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className='filter_form me-3 mb-2'>
            <label className="form-label">Max editions</label>
            <div className="btn-group ms-2" role="group" onChange={event => ToggleRarity(event)}>
              {rarityList.map((item, idx) => (
                <React.Fragment key={idx}>
                  <input type="radio"
                    className="btn-check"
                    name="by_rarity"
                    id={`by_rarity_${item.value}`}
                    defaultChecked={filters.rarity == item.value}
                    value={item.value} />
                  <label className="btn btn-sm btn-outline-secondary"
                    htmlFor={`by_rarity_${item.value}`}>
                    {item.title}
                  </label>
                </React.Fragment>
              ))}
            </div>
          </div>

          <Form.Check
            inline
            type="switch"
            id="following_only"
            label="Followed artists only"
            className="secondary"
            defaultChecked={filters.followingOnly == 1}
            onClick={ToggleFollowing}
          />

          <br />
          <div className='inline'>
            <Form.Label>
              Go back to a specific day
            </Form.Label>
            <Form.Control
              id="day"
              name="day"
              type='text'
              placeholder='YYYY-MM-DD'
              onBlur={changeDay}
              onKeyPress={e => changeDay(e)}
              style={{ width: '150px' }}>
            </Form.Control>
          </div>
        </div>
      </div>
      <Result>
        <div className='feed collections'>
          {items.length > 0 && (
            <InfiniteScroll
              dataLength={items.length}
              next={loadMore}
              scrollThreshold='200px'
              hasMore={true}
              loader={undefined}
              endMessage={
                <p>
                  END OF FEED
                </p>
              }
            >
              {masonry ? (
                <Masonry
                  breakpointCols={breakpointMasonry}
                  className="feedm"
                  columnClassName="feedm_column">
                  {items.map((token, index) => (
                    <ShowItem key={`${token.id}-${index}`} token={token} following={followingArtists.includes(token.creator_id)} />
                  ))}
                </Masonry>
              ) : (
                <>
                  {
                    items.map((token, index) => (
                      <ShowItem key={`${token.id}-${index}`} token={token} following={followingArtists.includes(token.creator_id)} />
                    ))
                  }
                </>
              )}
            </InfiniteScroll>
          )}
        </div>
      </Result>
    </>
  )
}

export default Feeds
Feeds.layout = 'skip_result';