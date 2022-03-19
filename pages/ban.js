import React from 'react';
import ReactDOM from 'react-dom'

import * as AppConst from '../utils/constants'
import Head from 'next/head'
import { ShowTrade } from '../components/show_trade'
import { WalletField } from '../components/wallet_field';
import * as Wallet from '../utils/wallet'
import Button from "react-bootstrap/Button"
import Form from "react-bootstrap/Form"
import {
  empty, done, loading, fetchGraphQL, showError, getAddress,
} from '../utils/utils'
import { getBannedWallets, getBannedObjkts } from '../utils/banned'

const query_bans = `
query qryNftBiker($address: String, $objkts: [String!], $wallets: [String!]) {
  by_token:token_holder(where: {holder_id: {_eq: $address}, quantity: {_gt: 0}, token: {id: {_in: $objkts}, fa2_id: {_eq: "${AppConst.HEN_OBJKT}"}}}) {
    quantity
    token {
      id
      uuid
      pk_id
      mime
      supply
      royalties
      display_uri
      thumbnail_uri
      timestamp
      title
      creator {
        address
        name
      }
    }
  }
  by_wallet:token_holder(where: {holder_id: {_eq: $address}, quantity: {_gt: 0}, token: { creator_id: {_in: $wallets}}}) {
    quantity
    token {
      id
      uuid
      pk_id
      mime
      supply
      royalties
      display_uri
      thumbnail_uri
      timestamp
      title
      creator {
        address
        name
      }
    }
  }
}
`
async function DoTransfer() {
  let list = []
  document.querySelectorAll("input:checked").forEach((elem) => {
    let item = { token_id: elem.dataset.id, amount: parseInt(elem.dataset.amount) }
    list.push(item)
  })
  let transfer_to = document.getElementById("transfer_to").value
  if (empty(transfer_to)) return;
  else transfer_to = await getAddress(transfer_to)
  await Wallet.transfer({ tokens: list, transfer_to: transfer_to });
}

async function fetchBanned() {
  let wallet = document.getElementById("wallet").value;
  if (empty(wallet)) return;
  loading();
  let bannedWallets = await getBannedWallets()
  let bannedObjkts = await getBannedObjkts()

  const { errors, data } = await fetchGraphQL(query_bans, "qryNftBiker", { "address": wallet, 'objkts': bannedObjkts, 'wallets': bannedWallets });
  if (errors) return showError(errors);
  let tokens = {}
  if (!empty(data.by_wallet))
    for (let item of data.by_wallet) {
      let token = item.token
      token.quantity = item.quantity
      token.reason = "Restricted wallet"
      tokens[token.id] = token
    }
  if (!empty(data.by_token))
    for (let item of data.by_token) {
      let token = item.token
      token.quantity = item.quantity
      token.reason = "Banned objkt"
      tokens[token.id] = token
    }

  let list = Object.values(tokens);
  if (empty(list)) {
    ReactDOM.render(
      <h3>NO BANNED ARTWORKS DETECTED IN THIS WALLET, GOOD JOB !</h3>,
      document.getElementById("result")
    )
  }
  else {
    ReactDOM.render(
      <div id="swap">
        {list.map((token) => (
          <ShowTrade token={token} type='ban' key={token.id} />
        ))}
        <br clear='all' />
        <div id='transfer_selected' className='block'>
          <p clear='all'>
            Select the tokens that you want to transfer, and enter the wallet to transfer to. If you want to burn them, use the address :<br />
            <b>{AppConst.BURN_ADDRESS}</b>
          </p>
          <div className='block inline'>
            <Form.Label>Transfer to</Form.Label>
            <Form.Control
              id="transfer_to"
              name="transfer_to"
              type='text'
              placeholder='tz...'
              style={{ width: '300px' }}>
            </Form.Control>
            <Button variant="secondary" onClick={(e) => DoTransfer(e)}>Transfer</Button>
            <br />
            <b>Depending on nodes load, the transaction confirmation screen can take up to a minute to appear, be patient.</b>
          </div>
        </div>
      </div>, document.getElementById("result")
    )
  }
  done();
}


export default function Ban() {
  return (
    <div id="input" className="block">
      <Head>
        <title>Banned Tezos artworks</title>
      </Head>
      <h2>Banned artworks (as per HEN ban list) in a wallet</h2>
      <WalletField monitoring={{
        bookmarklet: { title: 'Ban', path: 'ban' },
        method: fetchBanned,
      }} />
    </div>
  )
}