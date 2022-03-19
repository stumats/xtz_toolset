import React, { useEffect, useState, useContext } from 'react';
import Script from 'next/script'

import Head from 'next/head'
import { Result } from '../../components/result'
import { WalletField } from '../../components/wallet_field';
import * as AppConst from '../../utils/constants'
import * as Wallet from '../../utils/wallet'
import { MenuOffer } from '../../components/menu_offer'

import {
  empty, loading, done, loadArtists, Artists, formattedDate, fetchGraphQL, showError, urlParams, getAddress,
  platform_name, all_wallets,
} from '../../utils/utils'
import { gallery_link, history_link, bid_link, flex_link, wallet_link, } from '../../utils/links'

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

const token_owned = `
${fragment_token}
query qryNftBiker($wallets: [String!]) {
  token(where: { creator_id: { _in: $wallets } }) {
    ...tokenInfo
  }
  token_holder(where: { holder_id: { _in: $wallets }, quantity: { _gt: "0" } }) {
    holder {
      name
      address
    }
    token {
      ...tokenInfo
    }
  }
  ask(where: { creator_id: {_in: $wallets}, status: {_eq: "active"}, token_id:{ _is_null: false}}) {
    creator {
      name
      address
    }
    token {
      ...tokenInfo
    }
  }
}
`

const active_bids = `
query qryNftBiker($tokens: [bigint!] = []) {
  bid(where: { status: {_eq: "active"}, token_id: {_in : $tokens}}, order_by: { price: desc} ) {
    id
    platform
    token_id
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
  }
}
`

class ShowBids extends React.Component {
  constructor(props) {
    super(props)
  }

  render() {
    if (empty(this.props.bids)) return (
      <div id="bids"></div>
    )
    return (
      <table id='bids' className='sortable'>
        <thead>
          <tr>
            <th className='right'>Date</th>
            <th>Wallet</th>
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
          {this.props.bids.map((bid, index) => {
            let token = bid.token
            if (empty(token.creator.name)) token.creator.name = Artists.get(token.creator.address)
            let bid_date = new Date(bid.timestamp)
            let owner = empty(token.owner) ? token.creator : token.owner
            let price = (bid.price / AppConst.HEN_DECIMALS).round(4)
            return (
              <tr key={bid.id} id={bid.id}>
                <td className='right' sorttable_customkey={bid_date.toISOString()}>{formattedDate(bid_date)}</td>
                <td>{wallet_link(owner)}</td>
                <td>{token.title.slice(0, 30)}</td>
                <td>{gallery_link(token.creator)}</td>
                <td>{flex_link(bid.creator)}</td>
                <td className='right' sorttable_customkey={bid.price}>{Number(price)} tz</td>
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
}

export default function PageContent() {
  const [tokens, setTokens] = useState([])
  const [bids, setBids] = useState([])
  const [wallet, setWallet] = useState()
  const [error, setError] = useState()

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

  async function getTokensOwned(wallets) {
    const { errors, data } = await fetchGraphQL(token_owned, "qryNftBiker", { "wallets": wallets });
    if (errors) {
      showError(errors)
      return null;
    }
    let tokens = []
    tokens = tokens.concat(data.ask.map(e => {
      let token = e.token
      token.owner = e.creator
      token.swapped = true
      return token
    }))
    tokens = tokens.concat(data.token_holder.map(e => {
      let token = e.token
      token.owner = e.holder
      return token
    }))
    tokens = tokens.concat(data.token)
    return _.uniqBy(tokens.filter(t => t), 'uuid');
  }

  async function fetchBids() {
    if (!Wallet.account) await Wallet.syncTaquito()
    if (!Wallet.account) return null

    let address = Wallet.account?.address
    setWallet(address)

    loading(true);
    await loadArtists({ storage_only: true });

    let wallets = all_wallets(address)
    let list = await getTokensOwned(wallets)
    setTokens(list)
    if (list.length > 0) {
      list = await getBids(list)
      setBids(list)
    }
    done()

    // add sorting
    document.querySelectorAll("table.sortable").forEach(function (tbl) {
      try { sorttable.makeSortable(tbl) } catch (e) { console.log(e) }
    })
  }

  return (
    <>
      <div id="input" className='block'>
        <Head>
          <title>Offers checker</title>
        </Head>
        <Script src="/js/sorttable.js" />

        <h2>Offers received on any owned tokens (OBJKT/VERSUM)</h2>
        <WalletField hide={true} monitoring={{
          method: fetchBids,
          hide: true,
        }} />

        <MenuOffer />
      </div>

      <Result>
        <div className='block'>
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
            <>
              <ShowBids bids={bids} wallet={wallet} />
            </>
          )}
        </div>
      </Result>
    </>
  )
}

PageContent.layout = 'skip_result'