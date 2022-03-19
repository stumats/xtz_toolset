import React, { useEffect } from 'react';
import ReactDOM from 'react-dom'
import Head from 'next/head'
import { CopyTable } from '../components/copy_table';
import { WalletField } from '../components/wallet_field';
import {
  empty, loading, done, fetchGraphQL, showError, get_wallet,
} from '../utils/utils'
import { nft_link, gallery_link, history_link } from '../utils/links'

const query = `
query qryNftBiker($address: String!) {
  token_holder(where: {holder_id: {_eq: $address}, token: {creator_id: {_neq: $address}}, quantity: {_gt: "1"}}, order_by: {quantity: desc}) {
    token {
      id
      uuid
      title
      supply
      creator {
        address
        name
      }
    }
    quantity
  }
  ask(where: {creator_id: {_eq: $address}, artist_id: {_neq: $address}, status: {_eq: "active"}}, order_by: {amount: desc}) {
    platform
    amount
    amount_left
    price
    status
    creator {
      address
      name
    }
    token {
      id
      uuid
      title
      supply
      creator {
        address
        name
      }
    }
  }
}
`

const ShowTokens = ({ tokens }) => {
  return (
    <div style={{ maxWidth: '48%', float: 'left' }}>
      <CopyTable id="tokens_csv" table_id="tokens" style='tab' filename='activity'>

        <table id='tokens'>
          <thead>
            <tr>
              <th colSpan='8'>Multiple editions collected</th>
            </tr>
            <tr>
              <th>Token</th>
              <th>Title</th>
              <th>Creator</th>
              <th className='right'>Held</th>
              <th className='right'>Sold</th>
              <th className='right'>Total</th>
              <th className='right'>Ed.</th>
              <th>History</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((token, index) => {
              if (token.total < 2) return;
              return (
                <tr key={index}>
                  <td>{nft_link(token.uuid)}</td>
                  <td>{token.title}</td>
                  <td>{gallery_link(token.creator)}</td>
                  <td className='right'>{token.quantity}</td>
                  <td className='right'>{token.sold}</td>
                  <td className='right'>{token.total}</td>
                  <td className='right'>{token.supply}</td>
                  <td>{history_link(token.uuid)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </CopyTable>
    </div>
  )
}

const ShowHelp = () => {
  return (
    <>
      <br clear="all" />
      <p><b>Help</b></p>
      <ul>
        <li>Held : current number of copies held by collector</li>
        <li>Sold : number of copies already sold by collector</li>
        <li>Total : total number of copies the collector have collected (ie Held + Sold)</li>
        <li>Ed. : initial supply of the artwork (include burned copies if any)</li>
      </ul>
      <p>
        Only artworks collected more than once are shown, because it's what the HEN collector's police do not want you to do!<br />
        Hopefully, this tool will help them to come after you more easily :-)
      </p>
    </>
  )
}

async function fetchCollectorWallet() {
  let wallet = get_wallet()
  if (empty(wallet)) return;
  loading();

  const { errors, data } = await fetchGraphQL(query, "qryNftBiker", { "address": wallet });
  if (errors) return showError(errors);

  const holdings = data.token_holder;
  const swaps = data.ask;

  var tokens = {}
  for (let hold of holdings) {
    let token = hold.token;
    if (empty(token)) continue;
    tokens[token.uuid] = {
      uuid: token.uuid,
      title: token.title,
      supply: token.supply,
      creator: token.creator,
      quantity: hold.quantity,
      sold: 0,
      total: hold.quantity
    }
  }

  for (let swap of swaps) {
    let token = swap.token;
    if (empty(token)) continue;
    if (empty(tokens[token.uuid])) {
      tokens[token.uuid] = {
        uuid: token.uuid,
        title: token.title,
        supply: token.supply,
        creator: token.creator,
        quantity: 0,
        sold: 0,
        total: 0
      }
    }
    if (swap.status == 1 || swap.status == 'concluded') {
      tokens[token.uuid].sold += swap.amount;
    } else {
      tokens[token.uuid].quantity += swap.amount_left
      tokens[token.uuid].sold += swap.amount - swap.amount_left
    }
    tokens[token.uuid].total = tokens[token.uuid].sold + tokens[token.uuid].quantity;
  }

  tokens = Object.values(tokens).sort(function (a, b) {
    return b.total - a.total;
  });

  ReactDOM.render(
    <>
      <ShowTokens tokens={tokens} />
      <ShowHelp />
    </>
    , document.getElementById('result'));
  done();
}

export default function PageContent() {
  useEffect(() => {
  }, []);

  return (
    <div id="input" className="block">
      <Head>
        <title>Collector - TEZOS NFTs</title>
      </Head>
      <h2>How many edition of each artwork a collector do have</h2>
      <WalletField monitoring={{
        bookmarklet: { title: 'Collector audit', path: 'collector' },
        method: fetchCollectorWallet,
      }} />
    </div>
  )
}