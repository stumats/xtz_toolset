import React, { useEffect, useState } from 'react';
import Head from 'next/head'
import * as AppConst from '../utils/constants'
import * as Wallet from '../utils/wallet'

import { Result } from '../components/result';
import { getBannedWallets, getBannedObjkts, is_banned_objkt } from '../utils/banned'
import { WalletField } from '../components/wallet_field';
import { getCollectionInfos, fetchRaribleCreation } from '../utils/artist'

import InfiniteScroll from 'react-infinite-scroll-component'

import Button from 'react-bootstrap/Button'
import ButtonGroup from 'react-bootstrap/ButtonGroup'
import Form from 'react-bootstrap/Form'

import {
  empty, loading, fetchGraphQL, showError, loadArtists, Artists, update_by_artist, getWalletName,
  proper_value, get_wallet, holders_info, urlParams, update_current_href, extractTrades, normalizeBidData,
  formattedDate, done, getOrFindArtist, fa2_to_platform, all_wallets,
} from '../utils/utils'
import { ShowToken } from '../utils/trade'
import { is_fxhash, twitter_link, wallet_link } from '../utils/links';

var banned = {}

const fragment_token = `
fragment tokenInfo on token {
  id
  uuid
  pk_id
  fa2_id
  balance
  price
  title
  supply
  mime
  thumbnail_uri
  display_uri
  artifact_uri
  royalties
  moderated
  locked_seconds
  timestamp
  creator_id
  creator {
    address
    name
    twitter
  }
}
`

const query_tokens = (is_contract) => {
  let fa2_or_wallet = null
  if (is_contract) fa2_or_wallet = "fa2_id: { _eq: $address}"
  else fa2_or_wallet = "creator_id: { _eq: $address }"

  return `
${fragment_token}
query qryNftBiker($address: String!) {
  token(where: {${fa2_or_wallet}, supply: {_gt: 0}}, order_by: {timestamp: desc}) {
    ...tokenInfo
    token_holders(where: {quantity: {_gt: 0}}) {
      holder_id
      quantity
    }
    asks(where: {status: {_eq: "active"}, platform: {_neq: "hen1"}}, order_by: {timestamp: desc}) {
      id
      platform
      creator_id
      token_id
      timestamp
      status
      price
      amount
      amount_left
    }
  }
  external:ask(where: { artist_id: { _eq: $address }, token_id: { _is_null: true }, status: { _eq: "active" } }) {
    id
    fa2_id
    objkt_id
    platform
    creator_id
    timestamp
    status
    price
    amount
    amount_left
  }
}
`
}

const query_secondary = `
${fragment_token}
query qryNftBiker($address: String!) {
  ask(where: { creator_id: { _eq: $address }, platform: {_neq: "hen1"}, status: { _eq: "active" } }) {
    id
    platform
    creator_id
    timestamp
    status
    price
    amount
    amount_left
    token_id
    token {
      ...tokenInfo
      token_holders(where: {holder_id:{_eq: $address}, quantity: {_gt: 0}}) {
        holder_id
        quantity
      }
    }
  }
}
`

function priceFilter(price) {
  if (price < 15) return '10'; // just a bit
  else if (price < 50) return '20'; // i'm serious
  else if (price < 200) return '30'; // the real deal
  else return '99'; // all-in
}

function rarityFilter(edition) {
  edition = parseInt(edition);
  if (edition <= 5) return '10'; // exclusive
  else if (edition <= 10) return '20'; // very rare
  else if (edition <= 25) return '30'; // rare
  else if (edition <= 50) return '40'; // uncommon
  else return '99'; // common
}

function prepare_trade(trade) {
  trade.type = 'swap'
  if (empty(trade.platform)) trade.platform = 'hen'
  trade.swap_id = trade.id
  trade.date = new Date(trade.timestamp).getTime();
  trade.extended_price = trade.price
  trade.price = (trade.price / AppConst.HEN_DECIMALS).round(2)
  trade.token.date = new Date(trade.token.timestamp).getTime();
  trade.dom_key = `swap_${trade.swap_id}_${trade.date}`
  trade.price_filter = priceFilter(trade.price);
  trade.rarity_filter = rarityFilter(trade.token.supply);
  return trade
}

export default function OnSale() {
  const [created, setCreated] = useState(null)
  const [collected, setCollected] = useState(null)
  const [currentTab, setCurrentTab] = useState('created')
  const [items, setItems] = useState([])
  const [mintInfos, setMintInfos] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [collectorOnly, setCollectorOnly] = useState(false)
  const [showSecondary, setShowSecondary] = useState(false)
  const [showEmpty, setShowEmpty] = useState(false)
  const [byPrice, setByPrice] = useState(0)
  const [byRarity, setByRarity] = useState(0)

  const MAX_ITEMS = 50

  useEffect(() => {
    let wallet = get_wallet()
    if (!empty(wallet)) setShowFilter(true)

    let val = urlParams.get("secondary")
    if (val && val == '1') setShowSecondary(true)

    val = urlParams.get("empty")
    if (val && val == '1') setShowEmpty(true)

    val = urlParams.get("tab")
    if (!empty(val)) setCurrentTab(val)

    val = urlParams.get("rarity")
    if (!empty(val)) setByRarity(parseInt(val))

    val = urlParams.get("price")
    if (!empty(val)) setByPrice(parseInt(val))

  }, []);

  useEffect(() => {
    let list = (currentTab == 'collected') ? collected : created
    let result = combinedFilter(list)
    setItems(result.slice(0, MAX_ITEMS))
    done()
  }, [currentTab, collected, created, showSecondary, showEmpty, byPrice, byRarity])

  const ArtistInfo = () => {
    if (!mintInfos) return // not an artist
    return (
      <p id='artist_info' className='block'>
        <b>Summary for {wallet_link(mintInfos.artist)} {twitter_link(mintInfos.artist.twitter, true)} :</b> First Mint : {formattedDate(new Date(mintInfos.first_mint), 'absolute')} - Last Mint : {formattedDate(new Date(mintInfos.last_mint), 'absolute')} - Tokens minted : {mintInfos.total_objkts} - Editions : {mintInfos.total_editions}
      </p>
    )
  }

  function compare_sales(a, b, wallet, sorting) {
    if (sorting.type == 'price') {
      let val = b.price - a.price
      return (sorting.order == 'asc') ? -val : val
    }
    else {
      let a_val = a.token.creator.address;
      let b_val = b.token.creator.address;
      let val = (a_val == b_val && a_val == wallet) ? (b.token.date - a.token.date) : (b.date - a.date)
      return (sorting.order == 'asc' ? -val : val)
    }
  }

  function sortAndRefresh(sort, order) {
    if (!empty(sort)) urlParams.set('sort', sort)
    else sort = urlParams.get('sort')
    if (!empty(order)) urlParams.set('order', order)
    else order = urlParams.get('order')
    update_current_href()

    let wallet = get_wallet()
    let sorting = { type: sort, order: order }
    let list = currentTab == 'collected' ? collected : created
    list.sort((a, b) => { return compare_sales(a, b, wallet, sorting) })
    currentTab == 'collected' ? setCollected(list) : setCreated(list)
    let result = combinedFilter(list)
    setItems(result.slice(0, MAX_ITEMS))
  }

  const changeTab = async (evt) => {
    let val = evt.target.value
    urlParams.set("tab", val)
    update_current_href()
    if (val == 'collected') await fetchCollected()
    else await fetchCreated()
    setCurrentTab(val)
    setByPrice(0)
    setByRarity(0)
  }

  const ToggleSecondary = () => {
    let checkbox = document.getElementById("show_secondary")
    let val = checkbox && checkbox.checked ? true : false
    val ? urlParams.set('secondary', '1') : urlParams.delete('secondary')
    update_current_href()
    setShowSecondary(val)
  }

  const ToggleEmpty = () => {
    let checkbox = document.getElementById("show_empty")
    let val = checkbox && checkbox.checked ? true : false
    val ? urlParams.set('empty', '1') : urlParams.delete('empty')
    update_current_href()
    setShowEmpty(val)
  }

  const TogglePrice = (evt) => {
    let level = parseInt(evt.target.value)
    if (level == 0) urlParams.delete("price")
    else urlParams.set("price", level)
    update_current_href()
    setByPrice(level)
  }

  const ToggleRarity = (evt) => {
    let level = parseInt(evt.target.value)
    if (level == 0) urlParams.delete("rarity")
    else urlParams.set("rarity", level)
    update_current_href()
    setByRarity(level)
  }

  const loadMore = async () => {
    let nb = items.length
    let list = (currentTab == 'collected') ? collected : created
    let result = combinedFilter(list)
    setItems(result.slice(0, items.length + MAX_ITEMS))
  }

  function combinedFilter(list) {
    if (empty(list)) return []
    return list.filter(tx => {
      let hide = false
      if (tx.empty && !showEmpty) hide = true
      else if (tx.secondary && !showSecondary) hide = true
      else if (byPrice && byPrice > 0 && tx.price_filter != byPrice) hide = true
      else if (byRarity && byRarity > 0 && tx.rarity_filter != byRarity) hide = true
      return !hide
    })
  }

  async function loadData(wallet) {
    loading(true);

    if (empty(banned.wallets)) banned.wallets = await getBannedWallets()
    if (banned.wallets.includes(wallet)) {
      showError([{ message: 'This wallet is blocked by HEN' }], { raw: true, keep_loading: true })
    }
    if (empty(banned.objkts)) banned.objkts = await getBannedObjkts()
    await loadArtists({ storage_only: true });
    return true
  }

  async function fetchCreated(force = false) {
    let wallet = get_wallet();
    if (empty(wallet)) {
      setCreated(null)
      return
    }
    if (!empty(created) && !force) return

    let transactions = []
    let div = document.getElementById("artist_infos")
    if (div) div.remove()

    let ok = await loadData(wallet)
    if (!ok) return;

    let infos = { total_objkts: 0, total_editions: 0 }

    let artist_name = null
    let artist_wallet = wallet
    let is_contract = wallet.match(/^KT.+/im) ? true : false
    if (is_contract) {
      let collection = await getCollectionInfos(wallet)
      if (empty(collection)) is_contract = false
      else {
        artist_name = collection.name
        artist_wallet = collection.creator_id
        infos.artist = { address: artist_wallet, name: artist_name }
      }
    }

    let results = await fetchGraphQL(query_tokens(is_contract), "qryNftBiker", { "address": wallet });
    if (results.errors) return showError(results.errors);
    let tokens = await extractTrades(results.data.token, { per_token: true })

    if (!is_contract) {
      // find external tokens sold through objkt
      try {
        let external = await normalizeBidData({ asks: results.data.external }, true, { per_token: true, with_holders: true })
        for (let token of external) {
          if (tokens.find(e => e.uuid == token.uuid)) continue // already known
          tokens.push(token)
        }
      }
      catch (e) { console.error(e) }

      try {
        let rarible = await fetchRaribleCreation(wallet)
        for (let token of rarible) {
          if (tokens.find(e => e.uuid == token.uuid)) continue // already known
          tokens.push(token)
        }
      } catch (e) { console.error(e) }
    }

    // created art swaps (1st & 2nd)
    for (let token of tokens) {
      if (is_banned_objkt(token)) continue;
      if (empty(infos.artist)) infos.artist = token.creator
      if (empty(infos.first_mint)) infos.first_mint = token.timestamp
      else if (token.timestamp < infos.first_mint) infos.first_mint = token.timestamp

      if (empty(infos.last_mint)) infos.last_mint = token.timestamp
      else if (token.timestamp > infos.last_mint) infos.last_mint = token.timestamp

      if (empty(token.platform)) token.platform = fa2_to_platform(token.uuid)

      infos.total_objkts += 1
      infos.total_editions += token.supply

      let holders = holders_info(token.token_holders);
      token.held = empty(holders[token.creator.address]) ? 0 : holders[token.creator.address].quantity
      token.date = new Date(token.timestamp).getTime();
      if (empty(token.creator.name)) token.creator.name = proper_value(Artists.get(token.creator.address))

      let primary_swap = false
      let secondary_swap = null
      if (empty(token.swaps)) token.swaps = []

      if (is_fxhash(token.uuid)) {
        token.fxhash = true
        if (token.balance > 0) {
          primary_swap = true
          let tx = {
            creator_id: token.creator.address,
            timestamp: token.timestamp,
            date: new Date(token.timestamp),
            amount_left: token.balance,
            price: token.price,
            status: 0,
            swap_id: `fx_${token.id}`,
            type: 'swap',
            platform: 'fxhash',
            full: true,
          }
          token.swaps.push(tx)
        }
      }

      for (let trade of token.swaps) {
        if (trade.creator_id == artist_wallet) {
          if (trade.platform == 'bid2') {
            if (trade.amount_left > token.held) trade.amount_left = token.held
            token.held -= trade.amount_left
            if (trade.amount_left == 0) continue
          }
          if (!primary_swap) primary_swap = trade.price
          else if (trade.price < primary_swap) primary_swap = trade.price
          trade.primary = true
          trade.token = token
          prepare_trade(trade)
          transactions.push(trade);
        }
        else if (!trade.rarible) {
          if (trade.platform == 'bid2') {
            let holding = holders[trade.creator_id]
            if (empty(holding) || holding.quantity <= 0) continue // ignore empty ask
          }
          if (!secondary_swap) secondary_swap = trade
          else if (trade.price <= secondary_swap.price) secondary_swap = trade
        }
      }

      if (secondary_swap && (!primary_swap || secondary_swap.price < primary_swap)) {
        secondary_swap.token = token
        secondary_swap.secondary = true
        prepare_trade(secondary_swap)
        transactions.push(secondary_swap);
      }
      else if (!primary_swap) {
        token.date = new Date(token.timestamp).getTime();
        let swap = {
          type: 'swap',
          empty: true,
          swap_id: `token_${token.id}`,
          token: token,
          date: token.date,
          platform: token.platform,
          price: 0,
          extended_price: 0,
          amount_left: 0,
          dom_key: `token_${token.id}_${token.date}`
        }
        transactions.push(swap);
      }
    }

    if (empty(artist_name)) {
      artist_name = getOrFindArtist(infos.artist, true)
      if (empty(artist_name)) artist_name = await getWalletName(wallet)
    }
    if (!empty(artist_name)) {
      if (empty(infos.artist)) infos.artist = { address: wallet, name: artist_name }
      update_by_artist(artist_name, null, is_contract)
    }

    transactions = transactions.sort((a, b) => b.token?.date - a.token?.date)
    setCreated(transactions)
    if (infos.total_objkts == 0) {
      setMintInfos(false)
      if (force) fetchCollected(true)
    }
    else setMintInfos(infos)
  }

  async function fetchCollected(force = false) {
    let wallet = get_wallet();
    if (empty(wallet)) {
      setCollected(null)
      return
    }
    if (!empty(collected) && !force) return

    let ok = await loadData(wallet)
    if (!ok) return

    // 2ndary
    let transactions = []
    let results = await fetchGraphQL(query_secondary, "qryNftBiker", { "address": wallet });
    if (results.errors) showError(results.errors);
    if (results.data) {
      let normalized = await normalizeBidData({ asks: results.data.ask }, false)
      let swaps = normalized.asks

      for (let trade of swaps) {
        if (empty(trade.token)) continue
        if (trade.token.creator_id == trade.creator_id) continue;
        if (is_banned_objkt(trade.token)) continue;
        if (banned.wallets && banned.wallets.includes(trade.token.creator.address)) continue;

        let held = 0
        if (trade.token.token_holders) {
          let holders = holders_info(trade.token.token_holders);
          held = empty(holders[trade.token.creator.address]) ? 0 : holders[trade.token.creator.address].quantity
        }
        if (trade.platform == 'bid2' && trade.token.held == 0) continue
        trade.token.held = held
        trade.token.date = new Date(trade.token.timestamp).getTime();
        if (empty(trade.token.creator.name)) trade.token.creator.name = proper_value(Artists.get(trade.token.creator.address))
        prepare_trade(trade)
        transactions.push(trade);
      };
    }

    setCollected(transactions)
    if (force) setCurrentTab('collected')
  }


  async function fetchOnSale() {
    let wallet = get_wallet();
    if (empty(wallet)) return;
    setCreated(null)
    setCollected(null)
    setCollectorOnly(false)
    setByRarity(0)
    setByPrice(0)
    if (urlParams.get("tab") == 'collected') await fetchCollected(true)
    else await fetchCreated(true)
    setShowFilter(true)
  }

  let external_gallery = !empty(urlParams.get("hide")) && (urlParams.get("hide") == '1')

  let rarityList = [
    { value: 10, title: '<=5' },
    { value: 20, title: '6-10' },
    { value: 30, title: '11-25' },
    { value: 40, title: '26-50' },
    { value: 99, title: '>50' },
    { value: 0, title: 'All' },
  ]

  let priceList = [
    { value: 10, title: '<=15tz' },
    { value: 20, title: '15-49tz' },
    { value: 30, title: '50-199tz' },
    { value: 99, title: '>=200tz' },
    { value: 0, title: 'All' },
  ]

  return (
    <>
      <div id="input" className='block'>
        <Head>
          <title>HEN Gallery</title>
        </Head>

        <h2>
          Artworks for sale <span id='by_artist'></span>
        </h2>
        <WalletField monitoring={{
          bookmarklet: { title: 'Gallery', path: 'onsale?secondary=1' },
          method: fetchOnSale,
          hide: external_gallery,
        }}></WalletField>
      </div>

      <div className="filter_form block mb-1 mt-1">
        <div className="btn-group" role="group" onChange={event => changeTab(event)}>
          <input type="radio"
            className="btn-check"
            name="view"
            id="view_created"
            defaultChecked={currentTab == 'created'}
            value="created" />
          <label className="btn btn-sm btn-outline-secondary" htmlFor="view_created">Created</label>

          <input type="radio"
            className="btn-check"
            name="view"
            id="view_collected"
            defaultChecked={currentTab == 'collected'}
            value="collected" />
          <label className="btn btn-sm btn-outline-secondary" htmlFor="view_collected">Collected</label>
        </div>

        {currentTab == 'created' && (
          <ButtonGroup>
            <Form.Check
              inline
              type="switch"
              id="show_secondary"
              label="Secondary market offers"
              className="secondary"
              defaultChecked={showSecondary}
              onClick={ToggleSecondary}
            />
            <Form.Check
              inline
              type="switch"
              id="show_empty"
              label="No offers"
              defaultChecked={showEmpty}
              onClick={ToggleEmpty}
            />
          </ButtonGroup>
        )}
      </div>

      <Result>
        <div>
          {showFilter && (
            <div id="filters" className='block'>
              <div className="inline">
                <label className="form-label">FILTER BY PRICE</label>
                <div className="btn-group ms-2" role="group" onChange={event => TogglePrice(event)}>
                  {priceList.map((item, idx) => (
                    <React.Fragment key={idx}>
                      <input type="radio"
                        className="btn-check"
                        name="by_price"
                        id={`by_price_${item.value}`}
                        defaultChecked={byPrice == item.value}
                        value={item.value} />
                      <label className="btn btn-sm btn-outline-secondary"
                        htmlFor={`by_price_${item.value}`}>
                        {item.title}
                      </label>
                    </React.Fragment>
                  ))}

                </div>
              </div>

              <div className='inline'>
                <label className="form-label">FILTER BY EDITION</label>
                <div className="btn-group ms-2" role="group" onChange={event => ToggleRarity(event)}>
                  {rarityList.map((item, idx) => (
                    <React.Fragment key={idx}>
                      <input type="radio"
                        className="btn-check"
                        name="by_rarity"
                        id={`by_rarity_${item.value}`}
                        defaultChecked={byRarity == item.value}
                        value={item.value} />
                      <label className="btn btn-sm btn-outline-secondary"
                        htmlFor={`by_rarity_${item.value}`}>
                        {item.title}
                      </label>
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <div className='inline'>
                <label className="form-label">SORT BY</label>
                <ButtonGroup>
                  <Button variant="secondary" size="sm" onClick={e => sortAndRefresh('price', 'asc', e)}>Price (asc)</Button>
                  <Button variant="secondary" size="sm" onClick={e => sortAndRefresh('price', 'desc', e)}>Price (desc)</Button>
                  <Button variant="secondary" size="sm" onClick={e => sortAndRefresh('date', 'asc', e)}>Date (asc)</Button>
                  <Button variant="secondary" size="sm" onClick={e => sortAndRefresh('date', 'desc', e)}>Date (desc)</Button>
                </ButtonGroup>
              </div>
            </div>
          )}

          {!external_gallery && mintInfos && currentTab != 'collected' && (<ArtistInfo />)}

          {items && (
            <div id="swap">
              <InfiniteScroll
                dataLength={items.length}
                next={loadMore}
                scrollThreshold='200px'
                hasMore={true}
                loader={undefined}
              >
                {items.map((tx, index) => (
                  <ShowToken
                    key={`${currentTab}_${tx.dom_key}`}
                    tx={tx}
                    shopping={currentTab == 'created' ? 'offer' : true}
                    collection='onsale'
                  />
                )
                )}
              </InfiniteScroll>
            </div>
          )}
        </div>
      </Result>
    </>
  )
}

OnSale.layout = 'skip_result'