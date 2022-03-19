import React, { useEffect, useState } from 'react';
import Script from 'next/script';
import $ from 'jquery'
import Head from 'next/head'
import * as AppConst from '../utils/constants'
import { CopyTable } from '../components/copy_table'
import { Result } from '../components/result'
import {
  empty, loading, done, fetchGraphQL, showError, normalizeBidData,
  formattedDate, getWalletName, loadArtists, Artists,
  add_timeago, urlParams, update_current_href, platform_name,
} from '../utils/utils'
import { nft_link, is_hen, twitter_link, gallery_link } from '../utils/links'
import { Home } from '../components/home'
import { objkt_bookmarklet } from '../utils/objkt';
import { urlToToken, rewriteTokenId } from '../utils/contract'

import Form from 'react-bootstrap/Form'

var walletNames = {};

const objktHistoryQuery = `
query doRequest($id: String = "", $fa2_id: String = "${AppConst.HEN_OBJKT}") {
  token(where: { id: {_eq: $id}, fa2_id: {_eq: $fa2_id}}) {
    id
    uuid
    pk_id
    supply
    royalties
    title
    timestamp
    artifact_uri
    display_uri
    thumbnail_uri
    mime
    creator {
      address
      name
      twitter
    }
    bids {
      swap_id:id
      platform
      price
      seller_id
      timestamp
      status
      royalties
      creator {
        address
        name
        twitter
      }
      seller {
        address
        name
        twitter
      }
    }
  }
}
`

const HeaderInfos = (props) => {
  let token = props.token
  let artistName = token.creator.name
  return (
    <div className="block media_block clearfix">
      <div className="media_infos">
        Offers history for {nft_link(token.uuid)}<br />
        {!empty(token) && !empty(token.title) && (
          <b>
            {token.title} <br />
          </b>
        )}
        {!empty(artistName) && (
          <>
            by <a href={`/artist?wallet=${token.creator.address}`} target="_blank"><b>{artistName}</b></a><br />
          </>
        )}
      </div>
    </div >
  )
}

const Transaction = ({ transaction }) => {
  let token_id = rewriteTokenId(document.getElementById("token_id").value)

  let operation = '';
  if (transaction.status == 2) operation = 'cancelled'
  else if (transaction.status == 1) operation = 'accepted'
  else operation = 'active'

  let price = Number(transaction.price).round(2) + ' tz';
  if (operation == 'cancelled') price = (<del>{price}</del>)

  let buyer = {
    address: transaction.buyer,
    name: transaction.buyer_name,
    twitter: transaction.buyer_twitter,
  }

  return (
    <tr data-swap-id={transaction.swap_id} data-platform={transaction.platform}>
      <td>{formattedDate(transaction.date, 'absolute')}</td>
      <td>{gallery_link(buyer)}</td>
      <td>{twitter_link(buyer.twitter)}</td>
      <td className="csv_only">{buyer.address}</td>
      <td>{platform_name(transaction.platform)}</td>
      <td className='right' sorttable_customkey={transaction.price}>{price}</td>
      <td>{operation}</td>
    </tr>
  )
}

const Bids = (props) => {
  let list = props.transactions
  if (props.view != 'all') list = props.transactions.filter(e => e.status == props.view)
  return (
    <CopyTable id='bids_csv' table_id="bids" filename="bids">
      <table id="bids" className='sortable'>
        <thead>
          <tr>
            <th>Date</th>
            <th>Buyer</th>
            <th>Twitter</th>
            <th className='sorttable_nosort csv_only'>Wallet</th>
            <th className='sorttable_nosort'>Platform</th>
            <th>Price</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {list.map((transaction, index) => {
            return (
              <Transaction transaction={transaction} key={index} />
            )
          })}
        </tbody>
      </table>
    </CopyTable >
  )
}


export default function PageContent() {
  const [history, setHistory] = useState(false)
  const [theToken, setTheToken] = useState(false)
  const [theHolders, setTheHolders] = useState(false)
  const [view, setView] = useState('all')

  async function retrieveObjktHistory() {
    await loadArtists({ storage_only: true });

    let token_id = rewriteTokenId(document.getElementById('token_id').value);
    if (empty(token_id)) return;

    loading(true);

    let params = await urlToToken(token_id)
    const { errors, data } = await fetchGraphQL(objktHistoryQuery, "doRequest", { fa2_id: params.fa2_id, id: params.id });
    if (errors) return showError(errors);

    let token = data.token[0]
    if (empty(token)) {
      if (!is_hen(token_id)) showError('This tool is not available for this token', { raw: true })
      else showError('No history found for this token', { raw: true })
      return null
    }

    let offers = [];
    let { bids } = await normalizeBidData({ bids: token.bids })

    for (let item of bids) {
      if (empty(item)) continue;

      let tx = {}
      tx.id = item.id;
      tx.type = 'offer'
      tx.platform = empty(item.platform) ? 'hen' : item.platform;
      tx.quantity = item.amount;
      tx.timestamp = item.timestamp;
      tx.date = new Date(item.timestamp)
      tx.buyer = item.buyer.address;
      tx.buyer_name = item.buyer.name;
      tx.buyer_twitter = item.buyer.twitter
      if (empty(tx.buyer_name)) tx.buyer_name = Artists.get(item.buyer.address);
      if (!empty(tx.buyer_name)) walletNames[tx.buyer] = tx.buyer_name;

      tx.collector = tx.buyer;
      tx.swap_id = item.swap_id;
      tx.price = parseFloat(item.price) / 1000000;
      tx.token = token;
      tx.status = item.status
      offers.push(tx)
    }

    if (empty(token.creator.name)) token.creator.name = await getWalletName(token.creator.address, false);

    setTheToken(token)
    setHistory(offers.sort((a, b) => b.date - a.date))
    done()

    var tbl = document.getElementById("bids")
    if (tbl) sorttable.makeSortable(tbl)
  };

  const changeView = (evt) => {
    let val = evt.target.value
    if (val != 'all') val = parseInt(val)
    setView(val)
  }

  useEffect(() => {
    objkt_bookmarklet('OFFER', 'https://nftbiker.xyz/offer')
    $(document).on("change", "#token_id", function () {
      urlParams.set('token_id', $(this).val());
      update_current_href();
      retrieveObjktHistory()
    });

    let token_id = rewriteTokenId(urlParams.get("token_id"))
    if (!empty(token_id)) {
      $("#token_id").val(token_id);
      retrieveObjktHistory();
    }
  }, []);

  return (
    <>
      <div id="input" className="block">
        <Head>
          <title>Manage offers - TEZOS NFTs</title>
        </Head>
        <Home title="Drop offer manager for a Tezos NFT" />
        <Script src="/js/sorttable.js" />

        <div className='block inline'>
          <Form.Label>Token</Form.Label>
          <Form.Control
            id="token_id"
            name="token_id"
            type='text'
            placeholder='Token URL or HEN OBJKT #ID'
            style={{ width: '75%' }}>
          </Form.Control>
        </div>

        <Result>
          {theToken && (
            <>
              <HeaderInfos token={theToken} />

              <div className="filter_form block">
                <label className="form-label">Filter</label>

                <div className="btn-group ms-3" role="group" onChange={event => changeView(event)}>
                  <input type="radio" className="btn-check" name="follow" id="view_all" value="all"
                    defaultChecked={view == 'all'} />
                  <label className="btn btn-sm btn-outline-secondary" htmlFor="view_all">All</label>

                  <input type="radio" className="btn-check" name="follow" id="view_active" value="0"
                    defaultChecked={view == 0} />
                  <label className="btn btn-sm btn-outline-secondary" htmlFor="view_active">Active</label>

                  <input type="radio" className="btn-check" name="follow" id="view_accepted" value="1"
                    defaultChecked={view == 1} />
                  <label className="btn btn-sm btn-outline-secondary" htmlFor="view_accepted">Accepted</label>

                  <input type="radio" className="btn-check" name="follow" id="view_cancelled" value="2"
                    defaultChecked={view == 2} />
                  <label className="btn btn-sm btn-outline-secondary" htmlFor="view_cancelled">Cancelled</label>
                </div>
              </div>
              <div className="block">
                {history && (<Bids transactions={history} view={view} token={theToken} />)}
              </div>
            </>
          )}
        </Result>
      </div>
    </>
  )
}


PageContent.layout = 'skip_result'