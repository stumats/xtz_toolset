import React, { useEffect } from 'react';
import ReactDOM from 'react-dom'

import Head from 'next/head'
import { retrieveOTC } from '../utils/gift'
import { connectedWalletAddress } from '../utils/wallet';
import { WalletField } from '../components/wallet_field';
import ButtonGroup from 'react-bootstrap/ButtonGroup'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'

import * as AppConst from '../utils/constants'

import {
  empty, done, loading, add_timeago, getOrFindArtist, all_wallets,
  formattedDate, urlParams, update_current_href, loadArtists, fetchGraphQL, showError,
  get_wallet,
} from '../utils/utils'
import { nft_link, gallery_link, flex_link, history_link, twitter_link } from '../utils/links'
import { SendTokens } from '../utils/migrate'

var show_migrate = false

async function filterOTC(type, evt) {
  if (evt) evt.preventDefault()
  if (empty(type)) type = urlParams.get("filter")
  if (empty(type)) return

  if (type == 'all') {
    document.querySelectorAll('#gifts tbody tr').forEach((item) => { item.style.display = 'table-row' })
    urlParams.delete("filter")
  }
  else {
    urlParams.set("filter", type)
    document.querySelectorAll('#gifts tbody tr').forEach((item) => {
      if (item.classList.contains(type)) item.style.display = 'table-row'
      else item.style.display = 'none'
    });
  }
  update_current_href()
  return false;
}

const query_owned = `
query qryNftBiker($address: String!, $tokens: [String!]) {
  token(where: {uuid: {_in: $tokens}, token_holders: {holder_id: {_eq: $address}, quantity: {_gt: 0}}}) {
    uuid
  }
}
`

const query_holder = `
query qryNftBiker($wallets: [String!]) {
  holder(where: {address: {_in: $wallets}, name: {_neq: ""}}) {
    address
    name
  }
}
`

// list of tokens gifted and still owned
async function retrieveStillOwned(wallet, transactions) {
  let list = transactions.filter(e => e.buyer?.address == wallet).map(e => empty(e.uuid) ? null : e.uuid).filter(e => e)
  const { errors, data } = await fetchGraphQL(query_owned, "qryNftBiker", { "address": wallet, "tokens": list })
  if (errors) {
    showError(errors);
    return []
  }
  return data.token.map(e => e.uuid);
}

async function retrieveNames(transactions) {
  let list = {}
  for (let tx of transactions) {
    if (empty(tx.buyer.name)) list[tx.buyer.address] = true
    if (empty(tx.seller.name)) list[tx.seller.address] = true
  }
  const { errors, data } = await fetchGraphQL(query_holder, "qryNftBiker", { "wallets": Object.keys(list) })
  let names = {}
  for (let h of data.holder) {
    if (!empty(h.name)) names[h.address] = h.name
  }
  return names
}

async function fetchOTCTrades() {
  let wallets = get_wallet({ multiple: true })
  if (empty(wallets)) return;
  loading();
  let connected = await connectedWalletAddress()

  // auto include all other wallets
  if (wallets.length == 1 && connected == wallets[0]) wallets = all_wallets(wallet[0])
  show_migrate = wallets.includes(connected)

  if (show_migrate) document.getElementById("migrate_form").style.display = 'block'
  else document.getElementById("migrate_form").style.display = 'none'

  await loadArtists({ storage_only: true })

  const transactions = await retrieveOTC(wallets);
  let names = await retrieveNames(transactions)
  let owned = await retrieveStillOwned(connected || wallets[0], transactions)
  ReactDOM.render(
    <>
      <div id="filters" className='block'>
        <ButtonGroup>
          <Button variant="secondary" onClick={e => filterOTC('all', e)}>All</Button>
          <Button variant="secondary" onClick={e => filterOTC('received', e)}>Received</Button>
          <Button variant="secondary" onClick={e => filterOTC('sent', e)}>Sent</Button>
        </ButtonGroup>
      </div>

      <table id="gifts">
        <thead>
          <tr>
            <th className='right'>Date</th>
            <th>Token</th>
            <th>Title</th>
            <th className='right'>Qty</th>
            <th className='right'>Supply</th>
            <th colSpan="2">Creator</th>
            <th>From</th>
            <th>To</th>
            <th>History</th>
            {show_migrate && (
              <th>Send</th>
            )}
          </tr>
        </thead>
        <tbody>
          {transactions.map((item, index) => {
            let token = item.token
            if (empty(token)) return;
            let from = item.seller;
            if (empty(from.name)) from.name = names[from.address]
            let to = item.buyer;
            if (empty(to.name)) to.name = names[to.address]
            if (from.address == token.creator?.address) from.name = 'creator';
            else if (empty(from.name)) from.name = getOrFindArtist(from, true);

            if (to.address == token.creator?.address) to.name = 'creator';
            else if (empty(to.name)) to.name = getOrFindArtist(to, true);
            let style_op = item.type == 'received' ? 'op_sale' : 'op_buy'
            let migrate = show_migrate && owned.includes(token.uuid) && (item.buyer?.address == connected)
            let checkbox_id = `migrate_${token.id}`

            return (
              <tr key={index} className={item.type} data-id={token.id}>
                <td className='right nowrap'>{formattedDate(item.date)}</td>
                <td>{nft_link(token.uuid)}</td>
                <td>{String(token.title).slice(0, 40)}</td>
                <td className={`right ${style_op}`}>{item.quantity}x</td>
                <td className={`right`}>{token.supply}</td>
                <td>{twitter_link(token.creator?.twitter, true)}</td>
                <td>{gallery_link(token.creator)}</td>
                <td>{flex_link(from)}</td>
                <td>{flex_link(to)}</td>
                <td>{history_link(token.uuid)}</td>
                {show_migrate && (
                  <td>
                    {migrate ? (
                      <input type="checkbox"
                        name={checkbox_id}
                        id={checkbox_id}
                        data-token-id={token.uuid}
                        data-quantity={item.quantity}
                        className='migrate' >
                      </input>

                    ) : (
                      <>NA</>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
    , document.getElementById("result")
  )
  filterOTC()
  done()
  add_timeago();
}


export default function Gifted() {
  return (
    <div id="input" className="block">
      <Head>
        <title>Gifts - TEZOS NFTs</title>
      </Head>
      <h2>Gifts/OTC trades for a wallet (i.e. token sent or received, without a linked transaction)</h2>
      <WalletField monitoring={{
        bookmarklet: { title: 'Gift audit', path: 'gifted' },
        method: fetchOTCTrades,
        multiple: true
      }} />

      <div id="migrate_form" className='block inline' style={{ display: 'none' }}>
        <Form.Label>Transfer gifts to</Form.Label>
        <Form.Control
          id="send_to"
          name="send_to"
          type='text'
          placeholder='tz... or wallet.tez or HEN Username'
          style={{ width: '300px' }}>
        </Form.Control>
        <Button variant="secondary" onClick={(e) => SendTokens(e)}>Send</Button><br />
        <Form.Text muted>
          If you want to burn tokens, transfer them to the burn address: {AppConst.BURN_ADDRESS}
        </Form.Text>
      </div>
    </div>
  )
}