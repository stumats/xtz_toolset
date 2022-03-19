import React, { useEffect } from 'react';
import ReactDOM from 'react-dom'
import Head from 'next/head'
import { empty, loading, done, getAddress, fetchGraphQL, showError } from '../../utils/utils'
import * as AppConst from '../../utils/constants'
import { buildBatchMenu } from '../../utils/menu'
import { connectedWalletAddress } from '../../utils/wallet';
import Form from 'react-bootstrap/Form'
import Button from 'react-bootstrap/Button'

const query_migrate = `
query qryNftBiker($address: String = "", $contracts: [String!]) {
  token_holder(where: {token: {fa2_id: {_in: $contracts}}, holder_id: {_eq: $address}, quantity: {_gt: 0}}, order_by: {token_id: desc}) {
    holder_id
    quantity
    token_id
    token {
      id
      title
    }
  }
}
`

const query_sort = `
query qryNftBiker($address: String, $list: [bigint!]) {
  fulfilled_ask(order_by: {timestamp: desc}, where: {buyer_id: {_eq: $address}, token_id: {_in: $list}}) {
    token_id
    timestamp
  }
}

`

export const BatchCSV = (tokens, wallet) => {
  const handleFocus = (event) => event.target.select();
  let txt = []
  for (let token of tokens) {
    txt.push(`${wallet},${token.token_id},${token.quantity}`);
  }
  return (
    <textarea id="csv" rows="25" cols="100" onFocus={handleFocus} defaultValue={txt.join("\n")}>
    </textarea>
  )
}

async function getTokens(wallet) {
  let { errors, data } = await fetchGraphQL(query_migrate, "qryNftBiker", { "address": wallet, contracts: [AppConst.HEN_OBJKT] });
  if (errors) {
    showError(errors)
    return false
  }

  return data.token_holder;
}

async function sortTokens(wallet, tokens) {

  let list_ids = tokens.map(e => e.token_id)
  let { errors, data } = await fetchGraphQL(query_sort, "qryNftBiker", { "address": wallet, "list": list_ids });
  if (errors) {
    showError(errors)
    return tokens
  }

  let sorted = {}
  for (let t of data.fulfilled_ask) {
    if (empty(sorted[t.token_id])) sorted[t.token_id] = new Date(t.timestamp)
  }

  let now = new Date('2021-01-01T00:00:00Z')
  for (let t of tokens) {
    t.date = sorted[t.token_id] || now
  }
  return tokens.sort((a, b) => { return b.date - a.date })
}

async function migrateWallet(e) {
  e.preventDefault();

  let migrate_from, migrate_to, wallet;

  wallet = document.querySelector('#wallet').value;
  if (empty(wallet)) return;
  else migrate_from = await getAddress(wallet)

  wallet = document.querySelector('#wallet_to').value;
  if (empty(wallet)) return;
  else migrate_to = await getAddress(wallet)

  loading();

  let tokens = await getTokens(migrate_from)
  if (!tokens) return

  tokens = await sortTokens(migrate_from, tokens)
  if (!tokens) return

  ReactDOM.render(BatchCSV(tokens, migrate_to), document.getElementById('result'));
  done();
}

export default function Migrate() {
  useEffect(() => {
    async function loadMigrate() {
      buildBatchMenu()
      let connected = await connectedWalletAddress()
      if (connected) document.getElementById("wallet").value = connected
    }
    loadMigrate()
  }, []);
  return (
    <>
      <Head>
        <title>Migrate Wallet - HEN</title>
      </Head>
      <div id="input" className='block'>
        <h2>Prepare a CSV to move all your unswapped HEN tokens from one wallet to another</h2>
        <p>This tool only work for HEN minted tokens. If you want to move OBJKT minted tokens, use the <a href="/migrate/transfer">transfer tool</a></p>
        <div className='block'>
          <Form.Label>Migrate from wallet</Form.Label>
          <Form.Control
            id="wallet"
            name="wallet"
            type='text'
            placeholder='tz... or wallet.tez or HEN Username'>
          </Form.Control>
        </div>
        <div className='block'>
          <Form.Label>Send to wallet</Form.Label>
          <Form.Control
            id="wallet_to"
            name="wallet_to"
            type='text'
            placeholder='tz... or wallet.tez or HEN Username'>
          </Form.Control>
        </div>
        <Button variant="secondary" onClick={migrateWallet}>GENERATE CSV</Button>
      </div>
      <p className='block'>
        This tool generate the needed CSV data that you can copy/paste into <a href="https://batch.xtz.tools/" target="_blank" rel="noreferrer">FA2 Token Batch Sender</a> to send each of your objkts in your wallet to another wallet. The objkt are sorted by reverse acquisition date. The gift/OTC trades are at the end of the list, as there is no quick way to attribute them a proper trade date.<br />
        <b>WARNING : </b> make sure to only do the send by <b>batch of at most 500 objkts</b> to be sure to not hit the hard limit of tezos storage needed to do such batch transfers.<br />
      </p>
    </>
  )
}