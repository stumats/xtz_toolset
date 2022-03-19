import React, { useEffect, useState } from 'react';
import Script from 'next/script'

import Head from 'next/head'

import { Result } from '../components/result'
import { WalletField } from '../components/wallet_field';
import { fetchAllActivities, activity_summary, collectorFlexStats } from '../utils/wallet_activity'

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

import {
  empty, loading, done, loadArtists, urlParams,
} from '../utils/utils'
import { artist_link, flex_link } from '../utils/links'

var transactions = []

function sortList(list) {
  list = Object.values(list)
  for (let item of list) {
    item.objkts = [...new Set(item.objkts)].length
  }
  return list
}

export default function PageContent() {
  const [summary, setSummary] = useState(false)

  const [wallet, setWallet] = useState()
  const [fans, setFans] = useState('')
  const [buyers, setBuyers] = useState('')

  function buildBuyers(skip_wallet) {
    let result = {}
    for (let tx of transactions) {
      if (tx.type != 'sale') continue;
      // ignore primary sales
      if (tx.seller.address == tx.token.creator?.address) continue;

      let adr = tx.buyer.address
      if (empty(adr)) continue;
      else if (adr == skip_wallet) continue;

      if (empty(result[adr])) result[adr] = {
        address: adr,
        name: tx.buyer.name,
        objkts: [],
        editions: 0,
        spent: 0,
      }
      result[adr].objkts.push(tx.token.id)
      result[adr].editions += tx.amount
      if (tx.price != 'otc') result[adr].spent += (tx.amount * parseFloat(tx.price))
    }

    result = sortList(result)
    let list = {}
    result.sort((a, b) => b.spent - a.spent).filter(e => e.spent > 0).slice(0, 100).forEach(item => list[item.address] = item)

    result = result.filter(e => e.objkts > 1)
    result.sort((a, b) => b.editions - a.editions).slice(0, 100).forEach(item => list[item.address] = item)
    result.sort((a, b) => b.objkts - a.objkts).slice(0, 100).forEach(item => list[item.address] = item)
    setBuyers(Object.values(list))
  }

  function buildFans(skip_wallet) {
    let result = {}
    for (let tx of transactions) {
      let adr = tx.token?.creator?.address
      if (empty(adr)) continue
      else if (adr == skip_wallet) continue

      if (empty(result[adr])) result[adr] = {
        address: adr,
        name: tx.token.creator?.name,
        objkts: [],
        editions: 0,
        spent: 0,
        sold: 0,
        total: 0,
      }
      if (tx.type == 'buy') {
        result[adr].objkts.push(tx.token.id)
        result[adr].editions += tx.amount
        if (tx.price != 'otc' && !isNaN(tx.price)) result[adr].spent += (tx.amount * tx.price)
      }
      else if (tx.type == 'sale') {
        if (tx.price != 'otc' && !isNaN(tx.price)) result[adr].sold += (tx.amount * tx.price)
      }
      result[adr].total = result[adr].sold - result[adr].spent
      result[adr].with_tx = (result[adr].sold != 0 || result[adr].spent != 0)
    }
    result = sortList(result)
    let list = {}
    result.sort((a, b) => b.spent - a.spent).filter(e => e.spent > 0).slice(0, 100).forEach(item => list[item.address] = item)
    result.sort((a, b) => b.sold - a.sold).filter(e => e.sold > 0).slice(0, 100).forEach(item => list[item.address] = item)
    result.sort((a, b) => b.total - a.total).filter(e => e.with_tx).slice(0, 100).forEach(item => list[item.address] = item)

    result = result.filter(e => e.objkts > 1)
    result.sort((a, b) => b.editions - a.editions).filter(e => e.with_tx).slice(0, 100).forEach(item => list[item.address] = item)
    result.sort((a, b) => b.objkts - a.objkts).filter(e => e.with_tx).slice(0, 100).forEach(item => list[item.address] = item)

    setFans(Object.values(list))
  }

  const FansTab = (props) => {
    let list = props.list.sort(function (a, b) {
      return b.spent - a.spent
    })

    return (
      <div>

        <table id="fans" className='ranked sortable'>
          <thead>
            <tr>
              <th colSpan='7' className='sorttable_nosort'>FAN OF<br />Top 100 of artists this wallet collect from</th>
            </tr>
            <tr>
              <th className="sorttable_nosort">Rank</th>
              <th className='sorttable_nosort'>Artist</th>
              <th>Token</th>
              <th>Editions</th>
              <th>Spent</th>
              <th>Sold</th>
              <th>P&L</th>
            </tr>
          </thead>
          <tbody>
            {list.map((item, index) => {
              return (
                <tr key={index}>
                  <td></td>
                  <td>{artist_link(item)}</td>
                  <td className='right'>{item.objkts}</td>
                  <td className='right'>{item.editions}</td>
                  <td className='right currency' sorttable_customkey={item.spent.round(2)}>{item.spent.round(2)}tz</td>
                  <td className='right currency' sorttable_customkey={item.sold.round(2)}>{item.sold.round(2)}tz</td>
                  <td className='right currency' sorttable_customkey={item.total.round(2)}>{item.total.round(2)}tz</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const BuyersTab = (props) => {
    let list = props.list.sort(function (a, b) {
      return b.spent - a.spent
    })
    return (
      <div>
        <table id="buyers" className='ranked sortable'>
          <thead>
            <tr>
              <th colSpan='5' className='sorttable_nosort'>BIGGEST BUYERS<br />Top 100 of people who collect the most from this wallet</th>
            </tr>
            <tr>
              <th className="sorttable_nosort">Rank</th>
              <th className='sorttable_nosort'>Buyer</th>
              <th>Token</th>
              <th>Editions</th>
              <th>Spent</th>
            </tr>
          </thead>
          <tbody>
            {list.map((item, index) => {
              return (
                <tr key={index}>
                  <td></td>
                  <td>{flex_link(item)}</td>
                  <td className='right'>{item.objkts}</td>
                  <td className='right'>{item.editions}</td>
                  <td className='right currency' sorttable_customkey={item.spent.round(2)}>{item.spent.round(2)}tz</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  async function fetchWalletActivity() {
    let wallet = document.getElementById("wallet").value
    if (empty(wallet)) return null
    let type = urlParams.get('filter')
    setWallet(wallet)
    if (empty(type)) type = 'all'
    loading(true);
    await loadArtists({ storage_only: true });

    transactions = await fetchAllActivities()
    transactions.sort(function (a, b) {
      return b.date - a.date;
    });

    buildFans(wallet)
    buildBuyers(wallet)

    let data = await collectorFlexStats(transactions)
    done()
    activity_summary.average_spent = (activity_summary.total_buys / data.active_days).round(2)
    setSummary(Object.assign(activity_summary, { flex: data }))
  }

  useEffect(() => {
    document.querySelectorAll("table.sortable").forEach(function (tbl) {
      try { sorttable.makeSortable(tbl) } catch (e) { console.log(e) }
    })
  }, [buyers, fans, summary])

  return (
    <>
      <div id="input" className='block'>
        <Head>
          <title>Collector statistics - TEZOS NFT</title>
        </Head>
        <Script src="/js/sorttable.js" />

        <h2>Collector statistics</h2>
        <WalletField monitoring={{
          bookmarklet: { title: 'Collector', path: 'collector' },
          method: fetchWalletActivity,
        }} />
      </div>

      <Result>
        <div>
          {summary && (
            <p>
              <b>Collected : </b> {summary.flex.total_collected} artworks / {Number(summary.editions_collected)} editions from {summary.flex.distinct_artists} distinct artists &bull; <b>Sold : </b> {Number(summary.editions_resold)} editions<br />

              <b>Average : </b> {summary.flex.average} artworks/day &bull;
              &nbsp;<b>Active days : </b> {summary.flex.active_days} &bull;
              &nbsp;<b>First/Last collected: </b> {summary.flex.first_collected} -&gt; {summary.flex.last_collected}<br />

              <b>Total buy : </b> {Number(summary.total_buys).round(2)}tz &bull; <b>Total sales : </b> {Number(summary.total_resold).round(2)}tz &bull; <b>Earnings :</b> {Number(summary.total_resold - summary.total_buys).round(2)}tz
              &nbsp;&bull; <b>Average spent : </b> {summary.average_spent} tz/day<br />
              <b>Royalties paid on secondary sales to artists :</b> {Number(summary.total_royalties).round(2)}tz to {Object.keys(summary.artists_royalties).length} artists
            </p>
          )}
          <div id="ranks" className='tab'>
            <Row>
              {fans && (
                <Col xs="12" xl="6">
                  <FansTab list={fans} />
                </Col>
              )}
              {buyers && (
                <Col xs="12" md="6">
                  <BuyersTab list={buyers} />
                </Col>
              )}
            </Row>
          </div>
        </div>
      </Result>
    </>
  )
}

PageContent.layout = 'skip_result'