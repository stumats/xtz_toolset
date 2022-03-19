import React, { useEffect, useState } from 'react';
import Script from 'next/script'
import Head from 'next/head'
import Link from 'next/link';
import {
  empty, fetchGraphQL, loadArtists, Artists, formattedDate, updateArtistStorage,
  all_wallets,
} from '../../utils/utils'
import { Result } from '../../components/result';
import * as AppConst from '../../utils/constants'
import { gallery_link, flex_link, shorten_wallet, twitter_link } from '../../utils/links'
import { connectedWalletAddress } from '../../utils/wallet'
import { Home } from '../../components/home';

const query_artists = `
query qryNftBiker($wallets: [String!], $owners: [String!]) {
  artist(where: {address: {_in: $wallets}}, order_by: {last_mint: asc}) {
    address
    name
    twitter
    fxname
    total_mint
    first_mint
    last_mint
    last_buy
  }

  fulfilled_ask(where: {token: {creator_id: {_in: $wallets}}, _or: [{seller_id: {_in: $owners}}, {buyer_id: {_in: $owners}}]}) {
    platform
    buyer_id
    seller_id
    amount
    price
    token {
      creator_id
    }
  }
}
`

export default function PageContent() {
  const [artists, setArtists] = useState(false)

  async function fetchInfos() {
    let list = await loadArtists({ storage_only: true });
    let owner = await connectedWalletAddress()
    let owned_wallets = all_wallets(owner)

    const { errors, data } = await fetchGraphQL(query_artists, "qryNftBiker", {
      wallets: list,
      owners: owned_wallets
    })
    if (empty(data?.artist)) return false
    let result = {}
    for (let wallet of list) {
      let artist = data.artist.find(e => e.address == wallet)
      if (!empty(artist)) result[wallet] = artist
    }

    for (let trade of data.fulfilled_ask) {
      let artist = result[trade.token?.creator_id]
      if (empty(artist)) continue

      if (owned_wallets.includes(trade.buyer_id)) {
        if (empty(artist.buy_total)) artist.buy_total = 0
        artist.buy_total += trade.amount * trade.price
        if (empty(artist.buy_editions)) artist.buy_editions = 0
        artist.buy_editions += trade.amount
      }
      else if (owned_wallets.includes(trade.seller_id)) {
        if (empty(artist.sale_total)) artist.sale_total = 0
        artist.sale_total += trade.amount * trade.price
        if (empty(artist.sale_editions)) artist.sale_editions = 0
        artist.sale_editions += trade.amount
      }
    }
    setArtists(result)
  }

  const deleteWallet = async (wallet, e) => {
    if (e) e.preventDefault()
    delete (Artists.list[wallet])
    let list = []
    for (let addr of Object.keys(Artists.list)) {
      let name = Artists.get(addr)
      list.push({ name: name, address: addr })
    }
    updateArtistStorage(list)
    let line = document.querySelector(`tr[data-wallet='${wallet}']`)
    if (line) line.remove()
  }

  const ShowArtist = (props) => {
    let name = Artists.get(props.wallet)
    let artist = artists[props.wallet] || { address: props.wallet, total_mint: 0 }
    if (empty(name)) name = artist.name
    if (empty(artist.buy_editions)) artist.buy_editions = 0
    if (empty(artist.sale_editions)) artist.sale_editions = 0
    if (empty(artist.sale_total)) artist.sale_total = 0
    if (empty(artist.buy_total)) artist.buy_total = 0
    artist.benefit = ((artist.sale_total - artist.buy_total) / AppConst.HEN_DECIMALS).round(2)
    let benefit_cls = 'right'
    if (artist.benefit > 0) benefit_cls += ' op_sale'
    else if (artist.benefit < 0) benefit_cls += ' op_buy'

    return (
      <tr data-wallet={props.wallet}>
        <td sorttable_customkey={artist.twitter}>{twitter_link(artist.twitter, true)}</td>
        <td sorttable_customkey={name}>{gallery_link({ name: name, address: artist.address }, { secondary: true, empty: true, title: name })}</td>
        <td sorttable_customkey={props.wallet}>{flex_link({ name: name, address: artist.address }, { title: shorten_wallet(artist.address) })}</td>
        <td>{artist.name}</td>
        <td>{artist.total_mint}</td>
        <td sorttable_customkey={artist.first_mint}>{artist.first_mint ? formattedDate(new Date(artist.first_mint), 'date') : ''}</td>
        <td sorttable_customkey={artist.last_mint}>{artist.last_mint ? formattedDate(new Date(artist.last_mint), 'date') : ''}</td>
        <td className='right' sorttable_customkey={artist.buy_total}>{(artist.buy_total / AppConst.HEN_DECIMALS).round(2)} tz</td>
        <td className='right' sorttable_customkey={artist.buy_editions}>{artist.buy_editions} ed.</td>
        <td className='right' sorttable_customkey={artist.sale_total}>{(artist.sale_total / AppConst.HEN_DECIMALS).round(2)} tz</td>
        <td className='right' sorttable_customkey={artist.sale_editions}>{artist.sale_editions} ed.</td>
        <td className={benefit_cls} sorttable_customkey={artist.benefit}>{artist.benefit} tz</td>
        <td><a href="#" onClick={e => deleteWallet(props.wallet, e)}>Remove</a></td>
      </tr>
    )
  }

  useEffect(() => {
    fetchInfos()
    var tbl = document.getElementById("artists")
    if (tbl) try { sorttable.makeSortable(tbl) } catch (e) { }
  }, []);

  return (
    <>
      <div id="input" className="sticky block">
        <Head>
          <title>Following tool</title>
        </Head>
        <Script src="/js/sorttable.js" />
        <Home title="Followed artist analysis"></Home>
        <div id="filters">
          {!empty(artists) && (
            <p>{Object.keys(Artists.list).length} wallets in your list</p>
          )}
          <p>If you remove some wallets, you need to copy/paste your new wallets list into the <Link href="/follow">follow tool</Link> (or update your external follow list file)</p>
          <textarea id="wallets" style={{ display: 'block', width: '100%', height: '50px', margin: '10px 0px' }}></textarea>
        </div>
      </div>
      <Result>
        <table id="artists" className='sticky2 sortable hoover'>
          <thead>
            <tr>
              <th className="sorttable_nosort">Twit</th>
              <th>Artist</th>
              <th>Wallet</th>
              <th>Official name</th>
              <th className="sorttable_numeric">Tokens</th>
              <th>First mint</th>
              <th>Last mint</th>
              <th className="sorttable_numeric">Buy tz</th>
              <th className="sorttable_numeric">Buy ed</th>
              <th className="sorttable_numeric">Sale tz</th>
              <th className="sorttable_numeric">Sale ed</th>
              <th className="sorttable_numeric">P&L</th>
              <th className="sorttable_nosort">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {!empty(artists) && (
              Object.keys(Artists.list).map((item) => {
                return (
                  <ShowArtist key={item} wallet={item} />
                )
              })
            )}
          </tbody>
        </table>
      </Result>
    </>
  )
}


PageContent.layout = 'skip_result'