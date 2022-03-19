import React, { useEffect, useState } from 'react';
import Script from 'next/script'

import Head from 'next/head'
import { Result } from '../../components/result'
import { WalletField } from '../../components/wallet_field';
import * as AppConst from '../../utils/constants'
import * as Wallet from '../../utils/wallet'
import { MenuOffer } from '../../components/menu_offer';

import {
  empty, loading, done, loadArtists, Artists, formattedDate, fetchGraphQL, showError, urlParams, getAddress,
  platform_name,
} from '../../utils/utils'
import { gallery_link, history_link, bid_link, flex_link, } from '../../utils/links'

const _ = require('lodash')

const fragment_token = `
fragment tokenInfo on token {
  id
  uuid
  pk_id
  fa2_id
  title
  supply
  royalties
  mime
  display_uri
  thumbnail_uri
  artifact_uri
  timestamp
  creator_id
  creator {
    address
    name
  }
}
`

const active_bids = `
${fragment_token}
query qryNftBiker($wallets: [String!] = []) {
  bid(where: { token_id: { _is_null: false}, status: {_eq: "active"}, creator_id: {_in : $wallets}}, order_by: { timestamp: desc} ) {
    id
    platform
    objkt_id
    fa2_id
    token_id
    creator_id
    creator {
      address
      name
    }
    price
    status
    timestamp
    token {
      ...tokenInfo
    }
  }
}
`
export default function PageContent() {
  const [bids, setBids] = useState([])
  const [wallet, setWallet] = useState()
  const [error, setError] = useState()

  const ShowBids = () => {
    if (empty(bids)) return (
      <div id="bids"></div>
    )
    return (
      <table id='bids' className='sortable'>
        <thead>
          <tr>
            <th className='right'>Date</th>
            <th className='sorttable_nosort'>Title</th>
            <th>Artist</th>
            <th>Bidder</th>
            <th>Price</th>
            <th>Token</th>
            <th>Ed.</th>
            <th>Platform</th>
            <th className='sorttable_nosort'>History</th>
          </tr>
        </thead>
        <tbody>
          {bids.map((bid, index) => {
            let token = bid.token
            if (empty(token.creator.name)) token.creator.name = Artists.get(token.creator.address)
            let bid_date = new Date(bid.timestamp)
            return (
              <tr key={bid.id} id={bid.id}>
                <td className='right' sorttable_customkey={bid_date.toISOString()}>{formattedDate(bid_date)}</td>
                <td>{token.title.slice(0, 30)}</td>
                <td>{gallery_link(token.creator)}</td>
                <td>{flex_link(bid.creator)}</td>
                <td className='right'>{Number((bid.price / AppConst.HEN_DECIMALS).round(2))}</td>
                <td sorttable_customkey={token.id}>{bid_link(token.uuid, `#${token.id}`)}</td>
                <td className='right'>{token.supply}</td>
                <td>{platform_name(bid.platform)}</td>
                <td>{history_link(token.uuid)}</td>
              </tr>

            )
          })}
        </tbody>
      </table>
    )
  }

  async function getBids(tokens) {
    let list = {}
    tokens.forEach(t => {
      if (t.pk_id) list[t.pk_id] = true
    })
    list = Object.keys(list)
    const { errors, data } = await fetchGraphQL(active_bids, "qryNftBiker", { "tokens": list });
    if (errors) {
      showError(errors)
      return null;
    }
    let results = {}
    data.bid.forEach(bid => {
      let current = results[bid.token_id]
      if (!current) {
        bid.token = tokens.find(t => t.pk_id == bid.token_id)
        results[bid.token_id] = bid
      }
      else if (bid.price > current.price) {
        bid.token = current.token
        results[bid.token_id] = bid
      }
    })
    results = Object.values(results)
    return _.sortBy(results, 'timestamp').reverse()
  }

  async function fetchBids() {
    if (!Wallet.account) await Wallet.syncTaquito()
    if (!Wallet.account) return null
    setWallet(Wallet.account.address)

    await loadArtists({ storage_only: true })
    let wallets = Artists.getWallets()
    if (empty(wallets)) {
      setError("You don't follow any wallet. Please configure the follow tool first.")
      return false
    }

    loading(true);
    const { errors, data } = await fetchGraphQL(active_bids, "qryNftBiker", { "wallets": wallets });

    done()

    if (errors) return showError(errors);
    setBids(data.bid)

    // add sorting
    document.querySelectorAll("table.sortable").forEach(function (tbl) {
      try { sorttable.makeSortable(tbl) } catch (e) { console.log(e) }
    })
  }

  return (
    <>
      <div id="input" className='block'>
        <Head>
          <title>Active bids - TEZOS NFTs</title>
        </Head>
        <Script src="/js/sorttable.js" />

        <h2>Active offers made by people you follow</h2>
        <WalletField hide={true} monitoring={{
          method: fetchBids,
          hide: true,
        }} />
        <MenuOffer />
      </div>

      <Result>
        <div>
          {!wallet && (
            <p>
              You must first connect your wallet with the upper right CONNECT button to use this tool.<br />
              Once connected, reload the page to see active bids for your tokens.
            </p>
          )}
          {error && (
            <p>{error}</p>
          )}
          {bids && (
            <ShowBids />
          )}
        </div>
      </Result>
    </>
  )
}

PageContent.layout = 'skip_result'