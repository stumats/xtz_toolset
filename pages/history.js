import React, { useEffect, useState } from 'react';
import $ from 'jquery'
import Head from 'next/head'
import * as AppConst from '../utils/constants'

import { CopyTable } from '../components/copy_table'
import { MediaTag } from '../components/media_tag';
import { Result } from '../components/result'
import {
  empty, loading, done, fetchGraphQL, showError, normalizeBidData, holders_info,
  formattedDate, getWalletName, loadArtists, Artists, format_number,
  add_timeago, urlParams, update_current_href,
} from '../utils/utils'
import { operation_link, nft_link, flex_link, gallery_link, is_hen, twitter_link, operation_url } from '../utils/links'
import { Home } from '../components/home'
import { objkt_bookmarklet } from '../utils/objkt';
import { urlToToken, rewriteTokenId } from '../utils/contract'
import Form from 'react-bootstrap/Form'

var walletNames = {};
const MAX_ITEMS = 500

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
    token_holders(where: {quantity: {_gt: 0}}, order_by: {quantity: desc}) {
      token_id
      quantity
      holder {
        address
        name
        twitter
      }
    }
    asks(order_by: {timestamp: desc, id: desc}) {
      id
      platform
      price
      royalties
      status
      timestamp
      amount
      amount_left
      creator_id
      creator {
        address
        name
        twitter
      }
    }
    fulfilled_asks(order_by: {timestamp: desc, id: desc}) {
      id
      platform
      timestamp
      amount
      price
      buyer {
        address
        name
        twitter
      }
      seller {
        address
        name
        twitter
      }
      token {
        title
        royalties
        supply
        creator {
          address
          name
          twitter
        }
      }
    }
    bids(where: {status: {_in: ["concluded", "active"]}}) {
      id
      platform
      price
      seller_id
      timestamp:update_timestamp
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
    english_auctions(where: { status: {_eq: "concluded"}, highest_bid: {_gt:0}}) {
      id
      platform
      fa2_id
      objkt_id
      price:highest_bid
      timestamp:update_timestamp
      status
      buyer_id:highest_bidder_id
      buyer:highest_bidder {
        name
        address
      }
      seller_id:creator_id
      seller:creator {
        address
        name
      }
    }
  }
}
`

const HeaderInfos = (props) => {
  let token = props.token
  let artistName = token.creator.name
  let stats = token.stats
  let percent_artist = stats.totalCollected > 0 ? ` (${Number(stats.totalArtist * 100 / stats.totalCollected).round(2)}%)` : ''
  let percent_collectors = stats.totalCollected > 0 ? ` (${Number(stats.totalCollectors * 100 / stats.totalCollected).round(2)}%)` : ''

  return (
    <div className="block media_block clearfix">
      <a href={operation_url(token.uuid)} className='media_link' target='_blank'>
        <MediaTag token={token} full={true} />
      </a>
      <div className="media_infos">
        Transaction history for {nft_link(token.uuid)} - {nft_link(token.uuid, 'Make offer', 'bid')}<br />
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
        <br />
        {!empty(token) && (
          <>
            Royalties : <b>{token.royalties / 10} %</b> - Fees : {AppConst.HEN_FEE / 10}%
            - Original editions : <b>{token.supply + token.burned}</b>
            {token.burned > 0 && (
              <>
                &nbsp;- Modifications : <b>{token.burned} editions burned</b>
              </>
            )}
            <br />
          </>
        )}
        <p>
          Total Collected : <b>{Number(stats.totalCollected).round(2)}tz</b>
        </p>
        <p>
          Artist{percent_artist} : <b>{Number(stats.totalArtist).round(2)}tz</b> (incl. royalties, excl. fees)<br />
          Collectors{percent_collectors} : <b>{Number(stats.totalCollectors).round(2)}tz</b> (excl. fees & royalties)<br />
          Fees : <b>{Number(stats.totalFees).round(2)}tz</b>
        </p>
        <div>
          <input type="hidden" id="royalties" value={token.royalties} />
          <b>Calculator : </b> To get <input type='text' id='benefice' style={{ width: '100px' }} /> TZ, artwork must be sold for <input type='text' id='sale' style={{ width: '100px' }} /> TZ
        </div>
      </div>
    </div >
  )
}

const Transaction = (props) => {
  let transaction = props.transaction
  let token = props.token
  let token_id = rewriteTokenId(document.getElementById("token_id").value)
  let seller = {
    address: transaction.seller,
    name: transaction.seller_name
  }

  let buyer = null
  let price = format_number(transaction.price) + ' tz';
  if (transaction.type == "cancel_swap" || transaction.type == "old_swap" || transaction.type == 'sold') price = (<del>{price}</del>)
  else if (transaction.type == "swap") price = (<b>{price}</b>)

  let operation = '';
  if (transaction.type == "collect") {
    buyer = {
      address: transaction.buyer,
      name: transaction.buyer_name,
      twitter: transaction.buyer_twitter,
    }
  } else {
    if (transaction.type == 'sold') {
      operation = "sold";
    } else if (transaction.type == "swap") {
      operation = "selling";
    } else if (transaction.type == "cancel_swap") {
      operation = "cancelled";
    } else if (transaction.type == 'old_swap') {
      operation = `old v1<br/>SwapID: ${transaction.swap_id}`
    }
  }
  return (
    <tr data-swap-id={transaction.swap_id}>
      {!props.skip_date && (
        <td>{formattedDate(transaction.date)}</td>
      )}
      <td>{gallery_link(seller)}</td>
      <td className='right'>{transaction.quantity}</td>
      <td className='right'>{price}</td>
      {transaction.type == 'collect' ? (
        <>
          <td>{flex_link(buyer)}</td>
          <td>{twitter_link(buyer.twitter)}</td>
        </>
      ) : (
        <>
          <td>{operation == 'selling' ? operation_link(token_id, operation, transaction.platform) : operation}</td>
        </>
      )}
    </tr>
  )
}

const Market = (props) => {
  let token = props.token
  let list = props.transactions.filter(e => e.type == 'swap' && e.amount_left > 0)
  if (empty(list)) return null

  list.sort((a, b) => a.price - b.price)
  list = list.slice(0, 50)
  let cart = list.length > 1

  return (
    <div className='market_block'>
      <table>
        <thead>
          <tr><th colSpan="5">MARKET</th></tr>
          <tr>
            <th>Seller</th>
            <th>Qty</th>
            <th>Price</th>
            <th>&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {list.map((transaction, index) => {
            return (
              <Transaction transaction={transaction} token={token} buy={true} cart={cart} skip_date={true} key={index} />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const Offers = (props) => {
  let token = props.token
  let list = props.transactions.filter(e => e.status == 0)
  if (empty(list)) return null

  list.sort((a, b) => b.price - a.price)
  list = list.slice(0, 10)

  return (
    <div className='market_block'>
      <table>
        <thead>
          <tr><th colSpan="3">HIGHEST BIDS</th></tr>
          <tr>
            <th colSpan="2">Buyer</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {list.map((transaction, index) => {
            let price = format_number(transaction.price / AppConst.HEN_DECIMALS) + ' tz';
            return (
              <tr key={transaction.id}>
                <td>{flex_link(transaction.buyer)}</td>
                <td>{twitter_link(transaction.buyer.twitter)}</td>
                <td>{operation_link(token.uuid, price, transaction.platform)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const Owners = (props) => {
  let total_owners = 0;
  let total_editions = 0;
  let holders = props.holders.sort(function (a, b) { return b[1].quantity - a[1].quantity })

  holders.forEach(item => {
    if (item[1].quantity > 0) {
      total_owners += 1;
      total_editions += item[1].quantity;
    }
  })

  holders = holders.slice(0, 2 * MAX_ITEMS)

  return (
    <CopyTable id='owners'>
      <table>
        <thead>
          <tr>
            <th colSpan='3'>DISTINCT OWNERS : <b>{total_owners}</b> &bull; EDITIONS: <b>{total_editions}</b></th>
          </tr>
          <tr>
            <th>Owner</th>
            <th className='csv_only'>Wallet</th>
            <th>Twitter</th>
            <th>Qty</th>
          </tr>
        </thead>
        <tbody>
          {holders.map((item, index) => {
            total_owners += 1;
            total_editions += item[1].quantity;
            let val = item[1].name;
            if (empty(val)) val = walletNames[item[0]];
            if (empty(val)) val = Artists.get(item[0]);
            if (empty(val)) val = item[0];
            return (
              <tr key={`owner_${index}`}>
                <td>{flex_link({ address: item[0], name: val })}</td>
                <td className='csv_only'>{item[0]}</td>
                <td>{twitter_link(item[1].twitter)}</td>
                <td>{item[1].quantity}</td>
              </tr>
            )
          })}
        </tbody>
      </table >
    </CopyTable>
  )
}

const Sold = (props) => {
  let list = props.transactions.filter(t => t.type == 'collect').slice(0, MAX_ITEMS)
  let token = props.token
  return (
    <CopyTable id='sold'>
      <table>
        <thead>
          <tr><th colSpan='6'>MAX SOLD PRICE ON SECONDARY: <b>{token.stats.max_price.toString()}tz</b></th></tr>
          <tr>
            <th>Sold</th>
            <th>Seller</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Buyer</th>
            <th>Twitter</th>
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

const Sales = (props) => {
  let list = props.transactions.filter(t => t.type != 'collect').slice(0, MAX_ITEMS)
  let token = props.token
  return (
    <CopyTable id='sales'>
      <table>
        <thead>
          <tr>
            <th colSpan='5'>
              CURRENT MIN PRICE ON SECONDARY : <b>{token.stats.current_price}tz</b>
            </th>
          </tr>
          <tr>
            <th>Created</th>
            <th>Seller</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Op</th>
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
  const [offers, setOffers] = useState(false)
  const [theToken, setTheToken] = useState(false)
  const [theHolders, setTheHolders] = useState(false)

  async function retrieveObjktHistory() {
    let transactions = [];
    let totalCollected = 0
    let totalArtist = 0
    let totalCollectors = 0
    let totalFees = 0

    await loadArtists({ storage_only: true });

    let token_id = rewriteTokenId(document.getElementById('token_id').value);
    if (empty(token_id)) return;

    loading(true);

    let params = await urlToToken(token_id)
    const { errors, data } = await fetchGraphQL(objktHistoryQuery, "doRequest", { fa2_id: params.fa2_id, id: params.id });
    if (errors) return showError(errors);

    let token = data.token[0]
    if (empty(token)) {
      if (!is_hen(token_id)) showError('History is only available for HEN minted tokens', { raw: true })
      else showError('No history found for this token', { raw: true })
      return null
    }

    let swaps = [];
    let trades = [];
    let offers = [];
    let { asks, filled, bids, english } = await normalizeBidData({
      asks: token.asks,
      filled: token.fulfilled_asks,
      bids: token.bids,
      english: token.english_auctions
    })

    if (asks.length > 0) swaps = swaps.concat(asks);
    if (filled.length > 0) trades = trades.concat(filled);
    if (bids.length > 0) for (let b of bids) {
      if (b.status == 0) offers.push(b)
      else trades.push(b)
    }
    if (english.length > 0) trades = trades.concat(english);

    let holders = holders_info(token.token_holders, true);
    AppConst.MARKETPLACE_CONTRACTS.forEach(a => delete (holders[a]))
    token.burned = 0
    if (holders[AppConst.BURN_ADDRESS]) {
      token.burned = holders[AppConst.BURN_ADDRESS].quantity;
      delete (holders[AppConst.BURN_ADDRESS]);
    };

    // tx list
    // status: 0 = on sale, 1 = sold, 2 = cancelled
    for (let item of swaps) {
      if (empty(item)) continue;

      if (item.platform == 'bid2' && item.amount_left > 0) {
        let holding = holders[item.creator_id]
        if (empty(holding) || holding.quantity < item.amount_left) {
          item.status = 1
          item.amount_left = 0
        }
      }

      let tx = {}
      if (parseInt(item.status) > 1) tx.type = 'cancel_swap';
      else if (!empty(item.contract_version) && (item.contract_version < 2)) tx.type = 'old_swap';
      else if (item.status == 1 && item.amount_left == 0) tx.type = 'sold'
      else tx.type = 'swap';

      tx.id = item.id;
      tx.platform = empty(item.platform) ? 'hen' : item.platform;
      tx.quantity = item.status == 0 ? item.amount_left : item.amount;
      tx.amount_left = item.amount_left
      tx.timestamp = item.timestamp;
      tx.date = new Date(item.timestamp);
      tx.seller = item.creator?.address;
      tx.collector = tx.seller;
      tx.seller_name = item.creator?.name;
      tx.seller_twitter = item.creator?.twitter
      if (empty(tx.seller_name)) tx.seller_name = Artists.get(item.creator?.name)
      if (!empty(tx.seller_name)) walletNames[tx.seller] = tx.seller_name;
      tx.swap_id = item.id;
      tx.price = parseFloat(item.price) / 1000000;
      tx.token = token;
      tx.secondary = token.creator.address != item.creator?.address;
      if (item.status != 2 && tx.type != 'old_swap' && item.amount_left > 0 && tx.platform != 'bid2') {
        if (empty(holders[item.creator.address])) holders[item.creator.address] = { quantity: 0, name: tx.seller_name, twitter: tx.seller_twitter }
        holders[item.creator.address].quantity += item.amount_left;
      }
      transactions.push(tx);
    };

    for (let item of trades) {
      if (empty(item)) continue;

      let tx = {}
      tx.id = item.id;
      tx.type = 'collect';
      tx.platform = empty(item.platform) ? 'hen' : item.platform;
      tx.quantity = item.amount;
      tx.timestamp = item.timestamp;
      tx.date = new Date(item.timestamp)
      tx.buyer = item.buyer.address;
      tx.buyer_name = item.buyer.name;
      tx.buyer_twitter = item.buyer.twitter
      if (empty(tx.buyer_name)) tx.buyer_name = Artists.get(item.buyer.address);
      if (!empty(tx.buyer_name)) walletNames[tx.buyer] = tx.buyer_name;

      tx.seller = item.seller.address;
      tx.seller_name = item.seller.name;
      if (!empty(tx.seller_name)) walletNames[tx.seller] = tx.seller_name;
      tx.collector = tx.buyer;
      tx.swap_id = item.swap_id;
      tx.price = parseFloat(item.price) / 1000000;
      tx.token = token;
      tx.secondary = item.seller.address != token.creator.address;
      if (tx.type == "collect") totalCollected += tx.price;
      if (tx.secondary) {
        totalCollectors += tx.price * (1 - (tx.token.royalties + AppConst.HEN_FEE) / 1000);
        totalArtist += tx.price * tx.token.royalties / 1000;
        totalFees += tx.price * AppConst.HEN_FEE / 1000;
      } else {
        totalArtist += tx.price * (1 - AppConst.HEN_FEE / 1000);
        totalFees += tx.price * AppConst.HEN_FEE / 1000;
      }
      transactions.push(tx);
    };

    transactions = transactions.sort(function (a, b) {
      let val = b.date - a.date;
      if (val != 0) return val;
      return b.id - a.id;
    });

    let max_price = 0
    let current_price = 0
    transactions.forEach(tx => {
      if (tx.type == "collect") {
        if (tx.secondary && (tx.price > max_price)) max_price = tx.price;
      }
      else if (tx.type == 'swap') {
        if (tx.secondary && ((tx.price < current_price) || (current_price == 0))) current_price = tx.price;
      }
    })

    if (empty(token.creator.name)) token.creator.name = await getWalletName(token.creator.address, false);
    token.stats = {
      totalCollected: totalCollected,
      totalCollectors: totalCollectors,
      totalArtist: totalArtist,
      totalFees: totalFees,
      max_price: max_price,
      current_price: current_price
    }

    setTheToken(token)
    setTheHolders(Object.entries(holders))
    setHistory(transactions)
    setOffers(offers)
    done()
    add_timeago()
  };

  const evaluateSalePrice = () => {
    let royalties = parseInt(document.getElementById("royalties").value)
    let benefice = parseFloat(document.getElementById("benefice").value)
    let div = document.getElementById("sale")
    div.value = Number(benefice / (1 - ((royalties + AppConst.HEN_FEE) / 1000))).round(2);
  }

  const evaluateBenefice = () => {
    let royalties = parseInt(document.getElementById("royalties").value)
    let sale = parseFloat(document.getElementById("sale").value)
    let div = document.getElementById("benefice")
    div.value = Number(sale * (1 - ((royalties + AppConst.HEN_FEE) / 1000))).round(2)
  }

  useEffect(() => {
    objkt_bookmarklet('Token', 'https://nftbiker.xyz/history')
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

    $(document).on("change", "#benefice", function () {
      evaluateSalePrice()
    });

    $(document).on("change", "#sale", function () {
      evaluateBenefice()
    });
  }, []);

  return (
    <>
      <div id="input" className="block">
        <Head>
          <title>Token history - TEZOS NFTs</title>
        </Head>
        <Home title="Retrieve transactions history for a Tezos NFT" />

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
              <div className='block'>
                {history && (<Market transactions={history} token={theToken} />)}
                {offers && (<Offers transactions={offers} token={theToken} />)}
                <br clear="both" />
                {history && (<Sold transactions={history} token={theToken} />)}
                {history && (<Sales transactions={history} token={theToken} />)}
                {theHolders && (<Owners holders={theHolders} token={theToken} />)}
              </div>
            </>
          )}
        </Result>
      </div>
    </>
  )
}


PageContent.layout = 'skip_result'