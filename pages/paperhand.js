import React, { useState, useEffect } from 'react';
import Head from 'next/head'
import Script from 'next/script';
import * as AppConst from '../utils/constants'
import { Result } from '../components/result'
import { Home } from '../components/home';
import * as Wallet from '../utils/wallet'
import Link from 'next/link'

import {
  empty, loading, done, fetchGraphQL, showError, loadArtists, Artists,
  formattedDate, normalizeBidData, platform_name, format_number, urlParams, update_current_href,
} from '../utils/utils'
import { shorten_wallet, nft_link, gallery_link, history_link, operation_link } from '../utils/links'

import { InputGroup, Form, Row, Col } from 'react-bootstrap';


const query_deals = `
query qryNftBiker($wallets: [String!], $min_supply: Int! = 1, $max_supply: Int! = 100, $delta: bigint! = 50, $limit: Int! = 200, $min_price: bigint! = 0, $max_price: bigint! = 100000000000, $offset: Int! = 0) {
  paperhand(where: {artist_id: {_in: $wallets}, supply: {_gte: $min_supply, _lte: $max_supply}, current_price: {_lte: $max_price, _gte: $min_price}, delta: {_lte: $delta}}, order_by: {timestamp: desc}, limit: $limit, offset: $offset) {
    swap_id: pk_id
    token_id
    platform
    artist_id
    seller_id: creator_id
    uuid
    current_price
    primary_price
    delta
    timestamp
  }
}
`

async function retrieveData(wallets, delta, min_supply, max_supply, min_price, max_price) {
  const { data, errors } = await fetchGraphQL(query_deals, "qryNftBiker", {
    wallets: wallets,
    delta: delta,
    min_supply: min_supply,
    max_supply: max_supply,
    min_price: min_price,
    max_price: max_price,
    limit: 500,
    offset: 0
  })
  if (errors) return showError(errors);
  let trades = await normalizeBidData({ asks: data.paperhand }, true)
  return trades.asks
}

async function checkLogged() {
  let wallet = await Wallet.connectedWalletAddress()
  if (empty(wallet)) return 'You must connect your wallet to access this tool'
  return true
}


export default function PageContent() {
  const [maxDelta, setMaxDelta] = useState(20)
  const [minPrice, setMinPrice] = useState(0)
  const [maxPrice, setMaxPrice] = useState(100)
  const [minSupply, setMinSupply] = useState(1)
  const [maxSupply, setMaxSupply] = useState(100)
  const [transactions, setTransactions] = useState()
  const [message, setMessage] = useState()
  const [autoRefresh, setAutoRefresh] = useState(false)

  const changeDelta = (e) => {
    if (e && (e.key === 'Enter' || e._reactName == 'onBlur')) {
      let val = e.target.value
      urlParams.set("delta", val)
      update_current_href()
      setMaxDelta(val)
      if (e.key === 'Enter') setAutoRefresh(true)
    }
  }

  const changeMaxPrice = (e) => {
    if (e && (e.key === 'Enter' || e._reactName == 'onBlur')) {
      let val = e.target.value
      urlParams.set("max_price", val)
      update_current_href()
      setMaxPrice(parseInt(val))
      if (e.key === 'Enter') setAutoRefresh(true)
    }
  }

  const changeMinPrice = (e) => {
    if (e && (e.key === 'Enter' || e._reactName == 'onBlur')) {
      let val = e.target.value
      urlParams.set("min_price", val)
      update_current_href()
      setMinPrice(parseInt(val))
      if (e.key === 'Enter') setAutoRefresh(true)
    }
  }

  const changeMinSupply = (e) => {
    if (e && (e.key === 'Enter' || e._reactName == 'onBlur')) {
      let val = e.target.value
      urlParams.set("min_supply", val)
      update_current_href()
      setMinSupply(parseInt(val))
      if (e.key === 'Enter') setAutoRefresh(true)
    }
  }

  const changeMaxSupply = (e) => {
    if (e && (e.key === 'Enter' || e._reactName == 'onBlur')) {
      let val = e.target.value
      urlParams.set("max_supply", val)
      update_current_href()
      setMaxSupply(parseInt(val))
      if (e.key === 'Enter') setAutoRefresh(true)
    }
  }

  useEffect(() => {
    let val = urlParams.get("delta")
    if (!empty(val)) setMaxDelta(val)

    val = urlParams.get("min_supply")
    if (!empty(val)) setMinSupply(val)

    val = urlParams.get("max_supply")
    if (!empty(val)) setMaxSupply(val)

    val = urlParams.get("max_price")
    if (!empty(val)) setMaxPrice(val)

    val = urlParams.get("min_price")
    if (!empty(val)) setMinPrice(val)

    setAutoRefresh(true)
  }, [])

  useEffect(() => {
    if (autoRefresh) {
      fetchOffers()
      setAutoRefresh(false)
    }

  }, [autoRefresh])

  async function fetchOffers() {
    let ok = await checkLogged()
    if (ok !== true) {
      setMessage(ok)
      return false
    }
    setMessage(null)

    loading(true);
    await loadArtists({ storage_only: true });
    let wallets = Artists.getWallets()
    let list = await retrieveData(wallets, parseInt(maxDelta) + 100, minSupply, maxSupply, minPrice * AppConst.HEN_DECIMALS, maxPrice * AppConst.HEN_DECIMALS);
    setTransactions(list)
    done()

    var tbl = document.getElementById("offers")
    if (tbl) try { sorttable.makeSortable(tbl) } catch (e) { }
  }

  const ShowTrade = (props) => {
    let tx = props.transaction
    let token = tx.token
    let delta = (tx.delta - 100)
    return (
      <tr>
        <td className='right'>{formattedDate(new Date(tx.timestamp))}</td>
        <td>{operation_link(token.uuid, `#${token.id}`, tx.platform)}</td>
        <td>{gallery_link(token.creator)}</td>
        <td>{token.title.slice(0, 30)}</td>
        <td className='right'>{token.royalties / 10} %</td>
        <td className='right'>{token.supply}</td>
        <td>{shorten_wallet(tx.seller_id)}</td>
        <td className='right' sorttable_customkey={tx.primary_price}>{format_number((tx.primary_price / AppConst.HEN_DECIMALS).round(2))} tz</td>
        <td className='right' sorttable_customkey={tx.current_price}>{format_number((tx.current_price / AppConst.HEN_DECIMALS).round(2))} tz</td>
        <td className='right' sorttable_customkey={tx.delta}>{delta} %</td>
        <td>{operation_link(token.uuid, platform_name(tx.platform), tx.platform)}</td>
        <td>{history_link(token.uuid || token.id)}</td>
      </tr>
    )
  }

  return (
    <div id="input" className="block">
      <Head>
        <title>Secondary market deal finder - TEZOS NFTs</title>
      </Head>
      <Script src="/js/sorttable.js" />

      <Home title="Secondary market deal finder" />

      <p>
        This tool allow you to find artworks from artists you follow on secondary market, priced at most at X% above the original selling price. So to get artworks priced at most 30% above primary sale price, enter 30 in the "Max difference" field below.
      </p>
      <ul>
        <li>For performance reason, data are cached and refreshed every hour.</li>
        <li>You must configure a list of <Link href="/follow">artists to follow</Link></li>
        <li>At most 500 results are returned.</li>
        <li>Primary price is the average price of all primary editions sold by the artist</li>
      </ul>

      <Row>
        <Col xs="12" md="3">
          <Form.Label>Max difference</Form.Label>
          <InputGroup>
            <Form.Control
              id="delta"
              name="delta"
              type='text'
              placeholder='difference with the primary price in percentage'
              defaultValue={maxDelta}
              onBlur={changeDelta}
              onKeyPress={changeDelta}
            >
            </Form.Control>
            <InputGroup.Text id="basic-addon1">%</InputGroup.Text>
          </InputGroup>
        </Col>

        <Col xs="3" md="2">
          <Form.Label>Min price</Form.Label>
          <InputGroup>
            <Form.Control
              id="min_price"
              name="min_price"
              type='text'
              placeholder='Min price in tezos you are willing to pay'
              defaultValue={minPrice}
              onBlur={changeMinPrice}
              onKeyPress={changeMinPrice}
            >
            </Form.Control>
            <InputGroup.Text>tz</InputGroup.Text>
          </InputGroup>
        </Col>

        <Col xs="3" md="2">
          <Form.Label>Max price</Form.Label>
          <InputGroup>
            <Form.Control
              id="max_price"
              name="max_price"
              type='text'
              placeholder='Max price in tezos you are willing to pay'
              defaultValue={maxPrice}
              onBlur={changeMaxPrice}
              onKeyPress={changeMaxPrice}
            >
            </Form.Control>
            <InputGroup.Text>tz</InputGroup.Text>
          </InputGroup>
        </Col>

        <Col xs="3" md="2">
          <Form.Label className='me-2'>Min supply</Form.Label>
          <Form.Control
            id="min_supply"
            name="min_supply"
            type='text'
            placeholder='minimum artwork supply'
            defaultValue={minSupply}
            onBlur={changeMinSupply}
            onKeyPress={changeMinSupply}
          >
          </Form.Control>
        </Col>

        <Col xs="3" md="2">
          <Form.Label className='me-2'>Max supply</Form.Label>
          <Form.Control
            id="max_supply"
            name="max_supply"
            type='text'
            placeholder='maximum artwork supply'
            defaultValue={maxSupply}
            onBlur={changeMaxSupply}
            onKeyPress={changeMaxSupply}
          >
          </Form.Control>
        </Col>
        <Col xs="12" className='mt-2'>
          <a href="#" onClick={fetchOffers} className='btn btn-secondary'>FIND</a>
        </Col>
      </Row>

      <Result>
        {message && (
          <b>{message}</b>
        )}
        <table id="offers" className='sortable'>
          <thead>
            <tr>
              <th className='right'>Date</th>
              <th>Token</th>
              <th>Artist</th>
              <th>Title</th>
              <th className='right sorttable_nosort'>% Royalties</th>
              <th className='right'>Supply</th>
              <th className='sorttable_nosort'>Flipper</th>
              <th className='right'>Primary Price</th>
              <th className='right'>Current Price</th>
              <th>Delta</th>
              <th>Platform</th>
              <th className='sorttable_nosort'>History</th>
            </tr>
          </thead>
          <tbody>
            {transactions && (
              <>
                {transactions.map((tx, idx) => (
                  <ShowTrade transaction={tx} key={`${tx.platform}_${tx.swap_id}`}></ShowTrade>
                ))}
              </>
            )}
          </tbody>
        </table>
      </Result>

    </div >
  )
}

PageContent.layout = 'skip_result'