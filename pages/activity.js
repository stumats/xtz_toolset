import React, { useEffect, useState } from 'react';

import Head from 'next/head'
import InfiniteScroll from 'react-infinite-scroll-component'
import Button from 'react-bootstrap/Button'
import ButtonGroup from 'react-bootstrap/ButtonGroup'

import { Result } from '../components/result'
import { AbsoluteDate } from '../components/absolute_date';
import { CopyTable } from '../components/copy_table';
import { WalletField } from '../components/wallet_field';
import { fetchAllActivities, activity_summary, creator } from '../utils/wallet_activity'

import {
  empty, loading, done, loadArtists, Artists, format_number,
  formattedDate, add_timeago, urlParams, update_current_href, platform_name,
} from '../utils/utils'
import { shorten_wallet, gallery_link, flex_link, history_link, nft_link, } from '../utils/links'

var transactions = []

function limited_to_creator(wallet, token) {
  let name = !empty(token.creator?.name) ? token.creator.name : Artists.get(token.creator?.address)
  if (empty(name)) name = token.creator?.address;
  return (<>
    <label className="form-label">View limited to creator: {shorten_wallet(name)}</label>
    <Button href={`/activity?wallet=${wallet}`} variant="secondary">View all</Button>
  </>)
}


export default function Activity() {
  const [items, setItems] = useState('')
  const [summary, setSummary] = useState(false)
  const [wallet, setWallet] = useState()
  const [creatorTxt, setCreatorTxt] = useState()
  const [hasMore, setHasMore] = useState(true)
  const [nbItems, setNbItems] = useState(100)
  const [filter, setFilter] = useState('all')

  const loadMore = async () => {
    if (!hasMore) return null
    if (transactions.length > nbItems) {
      let nb = nbItems + 100
      setNbItems(nb)
      filterByType()
    }
  }

  const ActivityTab = ({ transactions }) => {
    if (empty(transactions)) return (
      <div id="activity"></div>
    )
    let wallet = document.getElementById('wallet').value;
    return (
      <CopyTable id="activity" table_id="trades" style='tab' filename='activity'>
        <InfiniteScroll
          dataLength={transactions.length}
          next={loadMore}
          scrollThreshold='300px'
          hasMore={hasMore}
          loader={undefined}
        >

          <table id='trades'>
            <thead>
              <tr>
                <th className='right'>Date</th>
                <th>Token</th>
                <th className='sorttable_nosort'>Title</th>
                <th>Creator</th>
                <th>Seller</th>
                <th>Buyer</th>
                <th className='sorttable_nosort'>Type</th>
                <th>Platform</th>
                <th>Ed.</th>
                <th className='right sorttable_nosort'>Swap</th>
                <th className='right'>Total</th>
                <th className='sorttable_nosort'>History</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, index) => {
                if (empty(tx.token)) return null
                let token = tx.token
                if (token.creator == null) token.creator = { address: null }
                if (token.creator.address == tx.buyer.address) tx.buyer.name = 'creator'
                if (token.creator.address == tx.seller.address) tx.seller.name = 'creator'

                let creator_name = !empty(token.creator.name) ? token.creator.name : Artists.get(token.creator.address)
                if (empty(creator_name)) creator_name = token.creator.address

                let price, total, total_sort;
                if (tx.price == 'otc') {
                  total = 'OTC'
                  price = '--'
                  total_sort = 0
                } else {
                  price = `${tx.amount}x${format_number(tx.price)}tz`
                  total = tx.type == 'sale' ? `${format_number(tx.total)}tz` : `-${format_number(tx.total)}tz`
                  total_sort = parseFloat(total)
                }
                let tx_date = new Date(tx.timestamp);
                return (
                  <tr key={index} className={`tx_${tx.type}`}>
                    <td className='right' sorttable_customkey={tx_date.toISOString()}>{formattedDate(tx_date)}</td>
                    <td sorttable_customkey={token.id}>{nft_link(token.uuid)}</td>
                    <td>{String(token.title).slice(0, 30)}</td>
                    <td><a href={`/activity?wallet=${wallet}&creator=${token.creator.address}`}>{shorten_wallet(creator_name)}</a></td>
                    <td>{gallery_link(tx.seller)}</td>
                    <td>{flex_link(tx.buyer)}</td>
                    <td>{tx.type}</td>
                    <td>{platform_name(tx.platform)}</td>
                    <td className='right'>{token.supply}</td>
                    <td className='right'>{price}</td>
                    <td className={`right currency op_${tx.type} sorttable_numeric`} sorttable_customkey={total_sort}>{total}</td>
                    <td>{history_link(token.uuid)}</td>
                  </tr>

                )
              })}
            </tbody>
          </table>
        </InfiniteScroll>
        <br clear="all" />
        <p><b>Help</b></p>
        <ul>
          <li>Swap : current number of copies x swap price</li>
          <li>Total : total net price (platform fees and royalties deducted)</li>
        </ul>
        <p>No guarantee of any kind provided by this tool. Use it at your own risk.</p>
      </CopyTable>
    )
  }

  function filterByType(type, evt) {
    if (evt) try { evt.preventDefault() } catch (e) { }
    if (!empty(type)) {
      urlParams.set('filter', type)
      update_current_href()
      setFilter(type)
    }
    else type = filter
    if (empty(type)) type = filter
    let list = type == 'all' ? transactions : transactions.filter(e => e.type == type)
    setItems(list.slice(0, nbItems))
    add_timeago()
  }

  async function fetchWalletActivity() {
    let wallet = document.getElementById("wallet").value
    let type = urlParams.get('filter')
    if (empty(type)) type = 'all'
    loading(true);
    await loadArtists({ storage_only: true });

    transactions = await fetchAllActivities()
    transactions.sort(function (a, b) {
      return b.date - a.date;
    });
    done()
    if (!empty(transactions)) setCreatorTxt(creator ? limited_to_creator(wallet, transactions[0].token) : '')
    setWallet(wallet)
    setSummary(activity_summary)
    filterByType(type)
  }

  return (
    <>
      <div id="input" className='block'>
        <Head>
          <title>Wallet activity - TEZOS NFT</title>
        </Head>
        <h2>List all transactions for a wallet</h2>
        <WalletField monitoring={{
          bookmarklet: { title: 'Activity', path: 'activity' },
          method: fetchWalletActivity,
        }} />
      </div>

      <Result>
        <div>
          {summary && (
            <>
              <p>
                <b>Collected : </b> {Number(summary.editions_collected)} editions &bull; <b>Sold : </b> {Number(summary.editions_sold)} editions<br />
                <b>Total buy : </b> {Number(summary.total_buys).round(2)}tz &bull; <b>Total sales : </b> {Number(summary.total_sales).round(2)}tz &bull; <b>Earnings :</b> {Number(summary.total_sales - summary.total_buys).round(2)}tz<br />
                {summary.is_artist && (
                  <>
                    <b>Sales split = </b>
                    Artist primary market sales : {Number(summary.artistic_sales).round(2)}tz &bull; Collected artworks resold : {Number(summary.resold).round(2)}tz<br />
                  </>
                )}
                <b>Royalties paid on secondary sales to artists :</b> {Number(summary.total_royalties).round(2)}tz to {Object.keys(summary.artists_royalties).length} artists
              </p>
              <div className='block filter_block'>
                <label className="form-label">Activity</label>
                <ButtonGroup>
                  <Button variant="secondary" onClick={e => filterByType('all', e)}>All</Button>
                  <Button variant="secondary" onClick={e => filterByType('buy', e)}>Buys</Button>
                  <Button variant="secondary" onClick={e => filterByType('sale', e)}>Sales</Button>
                </ButtonGroup>
                <AbsoluteDate />
                {!empty(creatorTxt) && (
                  <>
                    {creatorTxt}
                  </>
                )}
              </div>
            </>
          )}

          {items && (
            <ActivityTab transactions={items} />
          )}
        </div>
      </Result>
    </>
  )
}

Activity.layout = 'skip_result'