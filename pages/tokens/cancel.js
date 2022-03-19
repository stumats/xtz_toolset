import React, { useEffect, useState } from 'react';
import Script from 'next/script'

import Head from 'next/head'
import { Result } from '../../components/result'
import { WalletField } from '../../components/wallet_field';
import * as AppConst from '../../utils/constants'
import * as Wallet from '../../utils/wallet'
import { processTransaction } from '../../utils/transaction';
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
query qryNftBiker($wallet: String) {
  bid(where: { status: {_eq: "active"}, creator_id: {_eq : $wallet}}, order_by: { timestamp: desc} ) {
    pk_id
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

  const selectCheckbox = (pk_id, evt) => {
    if (evt.target?.nodeName == 'TD') {
      evt.preventDefault()
      let chk = document.getElementById(`bid_${pk_id}`)
      chk.checked = !chk.checked
    }
  }

  const selectAllTokens = (e) => {
    let new_value = document.getElementById("check_all").checked
    let nb = 0
    for (let e of document.querySelectorAll("input[type='checkbox']")) {
      if (e.id != 'check_all') {
        e.checked = new_value
        nb += 1
        if (new_value && nb >= 500) return
      }
    }
  }

  const cancelBids = async (evt) => {
    if (evt) evt.preventDefault()
    let list = []
    document.querySelectorAll("input.cancel:checked").forEach((elem) => {
      list.push({ id: elem.dataset.bidId, pk_id: elem.dataset.pkId, platform: elem.dataset.platform })
    })
    if (empty(list)) return
    let ok = await processTransaction('batch_cancel_bids', { bids: list })
    if (ok) {
      for (let bid of list) {
        console.log(`cancelled : ${bid.pk_id}`)
        let elem = document.getElementById(bid.pk_id)
        if (elem) elem.remove()
      }
    }
  }

  const ShowBids = () => {
    if (empty(bids)) return (
      <div id="bids"></div>
    )
    return (
      <table id='bids' className='sortable'>
        <thead>
          <tr>
            <th className='sorttable_nosort'>
              <input type="checkbox" id="check_all" onClick={e => selectAllTokens(e)}></input>
            </th>
            <th className='right'>Date</th>
            <th>Artist</th>
            <th className='sorttable_nosort'>Title</th>
            <th>Ed.</th>
            <th>Bidder</th>
            <th>Price</th>
            <th>Platform</th>
            <th>Token</th>
            <th className='sorttable_nosort'>History</th>
          </tr>
        </thead>
        <tbody>
          {bids.map((bid, index) => {
            let token = bid.token
            if (empty(token.creator.name)) token.creator.name = Artists.get(token.creator.address)
            let bid_date = new Date(bid.timestamp)
            let checkbox_id = `bid_${bid.pk_id}`

            return (
              <tr key={bid.id} id={bid.id}>
                <td onClick={e => selectCheckbox(bid.pk_id, e)}>
                  <input type="checkbox"
                    name={checkbox_id}
                    id={checkbox_id}
                    data-bid-id={bid.id}
                    data-platform={bid.platform}
                    data-pk-id={bid.pk_id}
                    className='cancel' >
                  </input>
                </td>
                <td className='right' sorttable_customkey={bid_date.toISOString()}>{formattedDate(bid_date)}</td>
                <td>{gallery_link(token.creator)}</td>
                <td>{token.title.slice(0, 30)}</td>
                <td className='right'>{token.supply}</td>
                <td>{flex_link(bid.creator)}</td>
                <td className='right'>{Number((bid.price / AppConst.HEN_DECIMALS).round(2))}</td>
                <td>{platform_name(bid.platform)}</td>
                <td sorttable_customkey={token.id}>{bid_link(token.uuid, `#${token.id}`)}</td>
                <td>{history_link(token.uuid)}</td>
              </tr>

            )
          })}
        </tbody>
      </table>
    )
  }

  async function getBids(wallet) {
    const { errors, data } = await fetchGraphQL(active_bids, "qryNftBiker", { "wallet": wallet });
    if (errors) {
      showError(errors)
      return null;
    }
    setBids(data.bid)
  }

  async function fetchBids() {
    if (!Wallet.account) await Wallet.syncTaquito()
    if (!Wallet.account) return null

    let address = Wallet.account?.address
    setWallet(address)

    loading(true);
    await loadArtists({ storage_only: true });

    await getBids(address)
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
          <title>Cancel objkt offers</title>
        </Head>
        <Script src="/js/sorttable.js" />

        <h2>Cancel your active offers on OBJKT/VERSUM</h2>
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
            <>
              {empty(bids) ? (
                <b>You don't have any active offer</b>
              ) : (
                <div>
                  <ShowBids />
                  <a href="#" className='btn btn-secondary' onClick={e => cancelBids(e)}>Cancel selected bids</a>
                </div>
              )}
            </>
          )}
        </div>
      </Result>
    </>
  )
}

PageContent.layout = 'skip_result'