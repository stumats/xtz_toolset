import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'

import InfiniteScroll from 'react-infinite-scroll-component'
import Head from 'next/head'
import { Home } from '../components/home'
import { getBannedWallets } from '../utils/banned'
import {
  empty, fetchGraphQL, showError, loadArtists, Artists, urlParams, loading, done,
  apiAsyncRequest, update_current_href,
} from '../utils/utils'
import { WalletConnector } from '../components/wallet_connector';

import { ShowTrade } from '../components/show_trade'
import { Result } from '../components/result'
import * as AppConst from '../utils/constants'

import Button from 'react-bootstrap/Button'
import ButtonGroup from 'react-bootstrap/ButtonGroup'
import Form from 'react-bootstrap/Form'

const _ = require('lodash');

const latest_feed = (order_by) => {
  return `
    query qryNftBiker($conditions: [fxhash_mint_bool_exp!], $limit: Int! = 25, $offset: Int! = 0) {
      fxhash_mint(where: { _and: $conditions }, order_by: {${order_by}}, limit: $limit, offset: $offset) {
        id
        uuid
        pk_id
        balance
        supply
        sold
        percentage_sold
        price
        title
        mime
        artifact_uri
        display_uri
        thumbnail_uri
        moderated
        locked_seconds
        timestamp
        creator_id
      }
    }
    `
}

const query_creators = `
query qryNftBiker($list: [String!]) {
  holder(where: {address: {_in: $list}}) {
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
}
`

const START_ID = 9999999
const LIMIT = 25

var clientTimezoneOffset = new Date().getTimezoneOffset() / 60
var restricted = []

const ShowItem = ({ token, following }) => {
  token.creator.sales = token.creator.sales_aggregate?.aggregate?.count || 0
  token.creator.tokens = token.creator.tokens_aggregate?.aggregate?.count || 0

  let buy = null
  token.fxhash = true
  token.show_platform = true
  if (token.balance > 0 && !token.moderated) {
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
  return (<ShowTrade token={token} transaction={buy} type="feed" />)
}

const Feeds = () => {
  const [items, setItems] = useState([])
  const [hasMore, setHasMore] = useState(true)
  const [creators, setCreators] = useState({})
  const [followingArtists, setFollowingArtists] = useState([])
  const [sort, setSort] = useState('date')
  const [paused, setPaused] = useState(true)
  const [followingOnly, setFollowingOnly] = useState(false)


  const loadMore = async () => {
    return await getLatest(items.length)
  }

  const changeFollowing = () => {
    let val = document.getElementById("following").checked
    val ? urlParams.set("following", '1') : urlParams.delete('following')
    update_current_href()
    setItems([])
    setFollowingOnly(val);
  }

  const changeSortMode = (val, e) => {
    if (e) e.preventDefault()
    if (val != sort) {
      urlParams.set("sort", val)
      update_current_href()
      setItems([])
      setSort(val)
      getLatest(0)
    }
  }

  const verify_open = async () => {
    let url = `https://api.tzkt.io/v1/contracts/${AppConst.FXHASH_MINTER}/storage`
    let data = await apiAsyncRequest(url)
    setPaused(data['paused'])
  }

  async function fetchFeed(offset) {
    if (empty(offset)) offset = 0
    let sort_mode = urlParams.get("sort")
    if (empty(sort_mode)) sort_mode = sort

    let params = { "limit": LIMIT, "offset": offset }
    // pk_id: desc
    let order = null

    if (sort_mode == 'date') order = 'timestamp: desc'
    else order = 'percentage_sold: desc'

    params.conditions = {
      fixed: { _eq: true },
      enabled: { _eq: true }
    }
    if (followingOnly) params.conditions.creator_id = { _in: followingArtists }

    const { errors, data } = await fetchGraphQL(latest_feed(order), "qryNftBiker", params);
    if (errors) {
      showError(errors)
      return
    }
    return data.fxhash_mint
  }


  const addCreators = async (list) => {
    let list_ids = list.map(e => e.creator_id).filter(e => !creators[e.creator_id])
    let current = Object.assign({}, creators)
    if (!empty(list_ids)) {
      const { errors, data } = await fetchGraphQL(query_creators, "qryNftBiker", { "list": list_ids });
      if (errors) showError(errors)
      else for (let c of data.holder) {
        current[c.address] = c
      }
    }
    list = list.map(e => {
      e.creator = current[e.creator_id]
      return e
    })
    setCreators(current)
    return list
  }

  const getLatest = async (offset) => {
    if (empty(offset)) offset = items.length
    let result = await fetchFeed(offset)
    if (empty(result)) return []
    if (offset == 0) loading(true)

    result = result.filter(e => !restricted.includes(e.creator_id))
    if (empty(result)) return await getLatest(offset + LIMIT)

    result = await addCreators(result)

    const next = offset == 0 ? result : items.concat(result)
    setItems(_.uniqBy(next, 'pk_id'))
    done()
  }

  useEffect(() => {
    async function processFeed() {
      let val = urlParams.get("day")
      if (!empty(val)) document.getElementById("day").value = val
      let sort = urlParams.get("sort")
      if (!empty(sort)) setSort(sort)
      ReactDOM.render(<WalletConnector />, document.getElementById("wallet_connector_container"))
      await loadArtists({ storage_only: true });
      setFollowingArtists(Artists.getWallets())
      restricted = await getBannedWallets()
      verify_open()
      await getLatest(0)
    }
    processFeed()
  }, [])

  useEffect(() => {
    async function processFeed() {
      await getLatest(0)
    }
    processFeed()
  }, [followingOnly])

  return (
    <>
      <div id="input" className="block">
        <Head>
          <title>Fxhash available mints</title>
        </Head>
        <Home title="Fxhash available mints" />

        <p>
          <b>Be sure to check on <a href="https://www.fxhash.xyz/" target="_blank">fxhash</a> if the artwork is not reported as undesirable content. Also <a href="https://www.fxhash.xyz/" target="_blank">check FxHASH</a> to verify that minting is open otherwise your transactions will fail.</b>
        </p>
      </div>

      <div id="filters" className='block'>
        <div className='inline'>
          <label className="form-label">SORT BY</label>
          <ButtonGroup>
            <Button variant="secondary" size="sm" onClick={e => changeSortMode('percent', e)}>Most sold</Button>
            <Button variant="secondary" size="sm" onClick={e => changeSortMode('date', e)}>Date</Button>
          </ButtonGroup>
          <Form.Check
            inline
            type="switch"
            id="following"
            label="Only show followed artists"
            onClick={changeFollowing}
          />

          <b>
            {paused ? (
              <>FxHASH minter is CLOSED</>
            ) : (
              <>FxHASH minter is OPEN</>
            )}
          </b>
          <span> || Green button = <a href="/follow">artist in your follow list</a></span>
        </div>
      </div>

      <Result>
        <div className='feed collections'>
          {items.length > 0 && (
            <InfiniteScroll
              dataLength={items.length}
              next={loadMore}
              scrollThreshold='200px'
              hasMore={hasMore}
              loader={undefined}
              endMessage={
                <p>
                  END OF FEED
                </p>
              }
            >
              {items.map((token, index) => (
                <ShowItem key={`${token.id}-${index}`} token={token} following={followingArtists.includes(token.creator_id)} />
              ))}
            </InfiniteScroll>
          )}
        </div>
      </Result>
    </>
  )
}

Feeds.layout = 'skip_result'
export default Feeds
