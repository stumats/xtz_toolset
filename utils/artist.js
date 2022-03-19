
import React from 'react';
import ReactDOM from 'react-dom'
import $ from 'jquery'
import * as AppConst from './constants'
import {
  empty, loading, done, fetchGraphQL, showError, extractTrades, get_wallet, holders_info,
  formattedDate, getWalletName, urlParams, loadArtists, Artists,
  add_timeago, update_current_href, fetchObjQL, apiAsyncRequest, all_wallets,
} from './utils'
import { shorten_wallet, nft_link, wallet_link, gallery_link, artist_link, flex_link, history_link, get_artwork_link, twitter_link, nft_url } from './links'
import { connectedWalletAddress } from './wallet'

import { CopyTable } from '../components/copy_table'
import Form from 'react-bootstrap/Form'


const MAX_FANS = 20;

const query_tokens = (field) => {
  return `
query qryNftBiker($address: String!) {
  token(where: {${field}: {_eq: $address}, supply: {_gt: 0}}) {
    id
    uuid
    fa2_id
    pk_id
    title
    supply
    royalties
    mime
    thumbnail_uri
    display_uri
    artifact_uri
    timestamp
    price
    balance
    creator_id
    creator {
      address
      name
      twitter
    }
    token_holders(where: {quantity: {_gt: 0}}) {
      quantity
      holder {
        address
        name
        twitter
      }
    }
    fulfilled_asks {
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
    }
    asks(where: {status: {_eq: "active"}, platform: {_neq: "hen1"}}) {
      id
      platform
      timestamp
      status
      price
      amount
      amount_left
      royalties
      seller:creator {
        address
        name
        twitter
      }
    }
    bids(where: {status: {_eq: "concluded"}}) {
      id
      platform
      price
      seller_id
      timestamp:update_timestamp
      status
      royalties
      buyer:creator {
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
    english_auctions(where: { status: {_eq: "concluded"}}) {
      id
      platform
      price:highest_bid
      timestamp:update_timestamp
      status
      buyer_id:highest_bidder_id
      buyer: highest_bidder {
        name
        address
        twitter
      }
      seller_id: creator_id
      seller: creator {
        address
        name
        twitter
      }
    }
  }
}`
}

const query_custom = `
query qryNftBiker($contract: String!) {
  ask(where: {status: {_eq: "active"}, fa2_id: {_eq: $contract}}) {
    id
    platform
    objkt_id
    fa2_id
    timestamp
    status
    amount
    amount_left
    seller_id: creator_id
    seller:creator {
      address
      name
    }
  }
  english_auction(where: {fa2_id: {_eq: $contract}, status: {_eq: "active"}}) {
    id
    platform
    objkt_id
    fa2_id
    timestamp
    status
    buyer_id:highest_bidder_id
    seller_id:creator_id
    seller:creator {
      address
      name
    }
  }
}
`
var buyers = {};
var sellers = {};
var fans = {};
var walletNames = {};
var shill = '';
var artistInfos = null;
var artistWallet = null;

var wallet
var summary = { editions: 0, artist: 0, collectors: 0, fees: 0, objkt: 0, profits: 0, buyback: 0 };

function initData() {
  shill = '';
  wallet = null
  artistInfos = {}
  artistWallet = null
  buyers = {};
  sellers = {};
  fans = {};
  summary = { editions: 0, artist: 0, collectors: 0, fees: 0, objkt: 0, profits: 0, buyback: 0 };
}


function setOrRetrieveName(adr, name) {
  if (!empty(walletNames[adr])) return walletNames[adr];
  if (!empty(name)) {
    walletNames[adr] = name
    return name
  } else if (Artists.loaded && !empty(Artists.get(adr))) {
    walletNames[adr] = Artists.get(adr)
    return walletNames[adr]
  }
  else {
    return null
  }
}

export async function getCollectionInfos(address, local_check) {
  if (local_check) {
    let query = `
  query qryNftBiker($address: String!) {
    fa2(where: {contract: {_eq: $address}}) {
      name
      creator_id
      contract
      collection_id
    }
  }
  `
    const { errors, data } = await fetchGraphQL(query, "qryNftBiker", { address: address }, { timeout: 30 })
    if (!empty(data.fa2)) return data.fa2[0]
    else return {}
  }
  else {
    let query = `
  query qryNftBiker($address: String!) {
    fa2:fa(where: {contract: {_eq: $address}}) {
      name
      items
      type
      creator_id:creator_address
      contract
      collection_id
      collection_type
    }
  }
  `
    const { errors, data } = await fetchObjQL(query, "qryNftBiker", { address: address }, { timeout: 30 })
    if (!empty(data.fa2)) return data.fa2[0]
    else return {}
  }
}

async function fetchCustomFans(contract) {
  // retrieve ledger
  let url = `https://api.tzkt.io/v1/contracts/${contract}/bigmaps/ledger`
  let data = await apiAsyncRequest(url);
  let key = data.ptr

  url = `https://api.tzkt.io/v1/bigmaps/${key}/keys?active=true&limit=10000`
  data = await apiAsyncRequest(url);
  let result = {}
  for (let entry of data) {
    let adr = null
    if (entry.key && entry.key.address) {
      adr = entry.key.address
      if (parseInt(entry.value) == 0) continue
    }
    else adr = entry.value
    if (AppConst.SKIP_CONTRACTS.includes(entry.value)) continue
    if (empty(result[adr])) result[adr] = {
      wallet: adr,
      tokens: 0,
      editions: 0,
      objkts: []
    }
    result[adr].tokens += 1
    result[adr].editions += 1
    result[adr].objkts.push(entry.key)
  }

  data = await fetchGraphQL(query_custom, "qryNftBiker", { contract: contract }, { timeout: 30 })
  if (data.data) {
    data = data.data
    for (let entry of data.ask.concat(data.english_auction)) {
      if (empty(result[entry.seller_id])) result[entry.seller_id] = {
        wallet: entry.seller_id,
        name: entry.seller.name,
        twitter: entry.seller.twitter,
        tokens: 0,
        editions: 0,
        objkts: []
      }
      result[entry.seller_id].name = entry.seller.name
      result[entry.seller_id].twitter = entry.seller.twitter
      result[entry.seller_id].tokens += 1
      result[entry.seller_id].editions += 1
      result[entry.seller_id].objkts.push(entry.objkt_id)
    }
  }
  return Object.values(result)
}


async function fetchData(wallet, contract) {
  await loadArtists({ storage_only: true })

  let is_contract = wallet.match(/^KT.+/im) ? true : false
  if (is_contract) {
    let collection = await getCollectionInfos(wallet, true)
    if (empty(collection)) is_contract = false
  }

  let query = is_contract ? query_tokens('fa2_id') : query_tokens('creator_id')
  let results = await fetchGraphQL(query, "qryNftBiker", { address: wallet });
  if (results.errors) return showError(results.errors);
  let tokens = await extractTrades(results.data.token, { per_token: true })

  tokens.map(e => e.date = new Date(e.timestamp))

  if (empty(artistInfos) && tokens.length > 0) artistInfos = tokens[0].creator
  if (empty(artistInfos.name)) artistInfos.name = await getWalletName(wallet, false);

  return tokens
}

function addSingleOwners(tokens) {
  if (empty(tokens)) return tokens

  for (let token of tokens) {
    if (token.supply != 1 && token.total != 1) {
      token.owner = null
      continue
    }

    // add current owner
    let owner = token.token_holders[0]
    if (empty(owner) || empty(owner.holder)) {
      token.owner = null
      continue
    }

    token.owner = owner.holder
    let adr = token.owner.address
    if (AppConst.MARKETPLACE_CONTRACTS.includes(adr)) {
      if (token.swaps.length > 0) {
        let s = token.swaps[0]
        token.owner = {
          name: empty(s.seller.name) ? null : s.seller.name,
          address: s.seller.address
        }
      }
      else token.owner = null
    }
  }
  return tokens
}

async function addCollectorInfo(tokens) {
  let collector = await connectedWalletAddress()
  if (empty(collector)) return

  let owned_wallets = all_wallets(collector)

  let total_editions = 0
  let total_objkts = 0
  let total_buy = 0
  let total_sale = 0
  let total_editions_sold = 0

  for (let token of tokens) {
    let have_one = false
    let holders = holders_info(token.token_holders);
    let editions = 0

    owned_wallets.forEach((adr) => {
      if (!empty(holders[adr])) {
        have_one = true
        editions += holders[adr].quantity
      }
    })

    for (let t of token.trades) {
      if (owned_wallets.includes(t.seller.address)) {
        have_one = true
        let price = t.price / AppConst.HEN_DECIMALS;
        total_sale += (t.amount * price)
        editions += t.amount
        total_editions_sold += t.amount
      }
      else if (owned_wallets.includes(t.buyer.address)) {
        have_one = true
        let price = t.price / AppConst.HEN_DECIMALS;
        total_buy += (t.amount * price)
      }
    }

    for (let s of token.swaps) {
      if (!owned_wallets.includes(s.seller.address)) continue;
      if (s.status > 0) continue // already seen in trade
      have_one = true
      editions += (s.amount - s.amount_left)
    }

    total_editions += editions
    if (have_one) {
      if (editions == 0) total_editions += 1 //gifted
      total_objkts += 1
    }
  }
  if (total_objkts == 0) return

  let div = document.createElement('div')
  ReactDOM.render(
    <p id="collector_info" className='block'>
      <b>Your collection for this artist : </b>
      Total tokens collected : {total_objkts} - Total editions collected : {total_editions}<br />
      Total buy : {total_buy.round(2)} tz - Total sales : {total_sale.round(2)} tz ({total_editions_sold} ed.) - P&L: {(total_sale - total_buy).round(2)} tz
    </p>, div)
  document.getElementById("artist_info").after(div.firstChild)
}

function addHelp() {
  let div = document.createElement('div')
  ReactDOM.render(
    <div id="help">
      <p><b>Help</b></p>
      <ul>
        <li>Ed. : current number of copies (burned copies are not counted)</li>
        <li>Held : number of copies held by artist</li>
        <li>&#128293; : if any copy was burnt, this is the number of copies burned</li>
        <li>First : min sale price on first market (ie by the seller)</li>
        <li>Offers : number of editions currently on sale by artist x minimum sale price</li>
        <li>Resale : number of editions currently on secondary market x minimum secondary price</li>
        <li>Tot. offers : number of editions currently on sale either by the artist or on secondary market</li>
        <li>Tot. artist : total of tez collected by artist (including royalties and excluding fees)</li>
        <li>Tot. col. : total of tez collected by collectors (excluding royalties and fees)</li>
        <li>Min price	: minimal current price to get one edition</li>
        <li>Trades : number of times the artwork as been resold on secondary market (exclude sales by creator)</li>
        <li>Best sale : highest price at which an edition was sold</li>
        <li>History : link to the detail of all sales for a token</li>
      </ul>
      <p>
        For FXHASH, only primary market sales are included and gains are an estimate, against the last sale price of each token (real gain can differ if artist changed price during the sale)
      </p>
      <p>
        Net gains are the sum of (average sale price - average buy price) for each edition sold. Artist net gains are their total sales, minus the price they paid to buyback some editions if they did it.
      </p>
      <p>
        Biggest Fans : current biggest holders of artworks from this artist (number of distinct NFTs and total number of editions).<br />
        Biggest Sellers : current biggest sellers of artworks from this artist (ie aggregated amount of editions sold, and total of sales).<br />
        Biggest Buyers : current biggest buyers of artworks from this artist (ie aggregated amount of editions bought, and total of buys).
      </p>
    </div>, div
  )
  document.getElementById("tokens").after(div.firstChild)
}

export async function fetchArtistWallet() {
  initData();
  wallet = get_wallet()
  if (empty(wallet)) return;
  loading();

  let tokens = await fetchData(wallet);
  tokens = addSingleOwners(tokens)
  tokens.sort((a, b) => { return b.date - a.date })

  ReactDOM.render(
    <CopyTable id="tokens" table_id="tokens_data" filename='tokens'>
      <table id="tokens_data" className="sortable">
        <thead>
          <tr>
            <th>Token</th>
            <th className='sorttable_nosort'>Type</th>
            <th>Title</th>
            <th className='right sorttable_numeric'>Ed.</th>
            <th className='right sorttable_numeric'>Held</th>
            <th className='nocsv right sorttable_nosort'>&#128293;</th>
            <th className='right sorttable_nosort'>First</th>
            <th className='right sorttable_numeric'>Offers</th>
            <th className='right sorttable_numeric'>Resale</th>
            <th className='right sorttable_numeric'>Tot. offers</th>
            <th className='right sorttable_numeric'>Tot. artist</th>
            <th className='right'>Tot. col.</th>
            <th className='right'>Min price</th>
            <th className='right'>Trades</th>
            <th className='right'>Best sale</th>
            <th className='right'>Last sale</th>
            <th className='hidden'>Owner Name</th>
            <th className='hidden'>Owner Wallet</th>
            <th className='nocsv'>History</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token, idx) => <ShowArtwork key={idx} token={token} />)}
        </tbody>
      </table>
    </CopyTable>
    , document.getElementById("result"));
  $("#result").show();

  summary.total = summary.artist + summary.collectors + summary.fees;
  let percent_artist = summary.total > 0 ? `(${(summary.artist * 100 / summary.total).round(2)}%) ` : "";
  let percent_collectors = summary.total > 0 ? `(${(summary.collectors * 100 / summary.total).round(2)}%) ` : "";
  let percent_fees = summary.total > 0 ? `(${(summary.fees * 100 / summary.total).round(2)}%) ` : "";

  let profits_artist = (summary.artist - summary.buyback).round(2)
  let profits_total = (profits_artist + summary.profits).round(2)
  let percent_profit_artist = profits_total > 0 ? `(${(profits_artist * 100 / profits_total).round(2)}%) ` : "";
  let percent_profit_collectors = profits_total > 0 ? `(${(summary.profits * 100 / profits_total).round(2)}%) ` : "";

  let first_mint = empty(tokens) ? null : tokens[tokens.length - 1].timestamp
  let last_mint = empty(tokens) ? null : tokens[0].timestamp

  let intro = document.createElement('div')
  ReactDOM.render(
    <p className='block' id='artist_info'>
      <b>Summary for {gallery_link(artistInfos)} {twitter_link(artistInfos.twitter, true)}</b> &bull; {wallet_link({ name: 'Creations', address: wallet }, { page: 'creations' })} &bull; {wallet_link({ name: 'Collection', address: wallet }, { page: 'collection' })}<br />
      {first_mint && (
        <>First Mint: {formattedDate(new Date(first_mint))} -&nbsp;</>
      )}
      {last_mint && (
        <>Last Mint: {formattedDate(new Date(last_mint))} -&nbsp;</>
      )}
      Tokens : {summary.objkt} - Editions : {summary.editions}<br />
      <span id='collectors_info'></span>
      Total collected: {summary.total.round(2)}tz
      - Artist : {summary.artist.round(2)}tz {percent_artist}
      - Collectors: {summary.collectors.round(2)}tz {percent_collectors}
      - Fees: {summary.fees.round(2)}tz {percent_fees}<br />
      Net gains : {profits_total.round(2)}tz
      - Artist : {profits_artist}tz {percent_profit_artist}
      - Collectors: {summary.profits.round(2)}tz {percent_profit_collectors}
    </p>
    , intro
  )
  $("#tokens").before(intro.innerHTML);
  add_timeago()
  done()

  await addCollectorInfo(tokens)
  addHelp()
  addSellers();
  addBuyers();
  let nb_fans = await addFans(false);
  addShill();
  ReactDOM.render(
    <>
      Collectors : {Object.keys(fans).length} (owning at least 1 ed.) - Fans : {nb_fans} (owning at least 2 distinct NFTs)<br />
    </>
    , document.getElementById("collectors_info")
  )
  return;
}

const ShowArtwork = ({ token }) => {
  if (empty(artistWallet)) artistWallet = token.creator.address;
  let artwork_link = get_artwork_link(token);
  // add holders infos
  let holders = holders_info(token.token_holders, true);
  if (empty(holders) && token.fa2_id == AppConst.HEN_OBJKT) return null; // burned so we skip
  if (token.supply == 0) return null; //burned

  if (token.fa2_id == AppConst.FXHASH_MINTER) token.available = token.balance
  else token.available = 0

  AppConst.MARKETPLACE_CONTRACTS.forEach(adr => {
    if (!empty(holders[adr])) token.available += holders[adr].quantity;
  })

  token.burned = holders[AppConst.BURN_ADDRESS] ? holders[AppConst.BURN_ADDRESS].quantity : ''
  delete (holders[AppConst.BURN_ADDRESS])
  token.held = empty(holders[wallet]) ? 0 : holders[wallet].quantity;
  token.total = 0;
  for (let adr in holders) {
    let item = holders[adr];
    token.total += Number(item.quantity);
    // fans
    if (AppConst.MARKETPLACE_CONTRACTS.includes(adr)) continue;
    else if (adr == wallet) continue;
    let name = setOrRetrieveName(adr, item.name);
    if (empty(fans[adr])) fans[adr] = {
      name: name,
      twitter: item.twitter,
      wallet: adr,
      tokens: 0,
      editions: 0,
      list: [],
    };
    fans[adr].tokens += 1;
    fans[adr].editions += item.quantity;
    fans[adr].list.push(token.pk_id);
  }
  if (token.total == 0 && token.fa2_id != AppConst.HEN_OBJKT) token.total = token.supply
  summary.objkt += 1;
  summary.editions += token.total;

  // add market infos
  let issuer_count = 0;
  let issuer_offer = 1e9;
  let resale_count = 0;
  let resale_offer = 1e9;
  let min_offer = 1e9;
  let min_first_market = null;
  let max_resale = 0;
  let trade_count = 0;
  let last_sale = 0;
  let total_artist = 0;
  let total_collectors = 0;
  let total_fees = 0;

  let profits = {}
  for (let t of token.trades) {
    let adr = null;
    max_resale = Math.max(max_resale, t.price / 1000000);
    let ts = Date.parse(t.timestamp);
    if (ts > last_sale) last_sale = ts;
    let price = t.price / AppConst.HEN_DECIMALS;

    if (t.seller.address != token.creator.address) {
      adr = t.seller.address;
      let name = setOrRetrieveName(adr, t.seller.name);
      if (empty(sellers[adr])) sellers[adr] = {
        name: name,
        twitter: t.seller.twitter,
        wallet: adr,
        editions: 0,
        total: 0,
      };

      sellers[adr].editions += t.amount;
      sellers[adr].total += price * t.amount;
      trade_count += t.amount;
      total_collectors += t.amount * price * (1 - (token.royalties + AppConst.HEN_FEE) / 1000);
      total_artist += (t.amount * price * token.royalties) / 1000;
      total_fees += (t.amount * price * AppConst.HEN_FEE) / 1000;

      if (empty(profits[adr])) profits[adr] = {
        sold_ed: 0,
        sold_total: 0,
        buy_ed: 0,
        buy_total: 0
      }
      profits[adr].sold_ed += t.amount
      profits[adr].sold_total += price * t.amount;
    } else {
      min_first_market = Math.min(
        min_first_market ? min_first_market : 1e9,
        t.price / 1000000
      );
      total_artist += t.amount * price * (1 - AppConst.HEN_FEE / 1000);
      total_fees += (t.amount * price * AppConst.HEN_FEE) / 1000;
    }
    adr = t.buyer.address;
    let name = setOrRetrieveName(adr, t.buyer.name);
    if (empty(buyers[adr])) buyers[adr] = {
      name: name,
      twitter: t.buyer.twitter,
      wallet: adr,
      editions: 0,
      total: 0
    };
    buyers[adr].editions += t.amount;
    buyers[adr].total += price * t.amount;

    if (empty(profits[adr])) profits[adr] = {
      sold_ed: 0,
      sold_total: 0,
      buy_ed: 0,
      buy_total: 0
    }
    profits[adr].buy_ed += t.amount
    profits[adr].buy_total += price * t.amount;
  }

  for (let key of Object.keys(profits)) {
    if (profits[key].sold_ed == 0) {
      if (key != token.creator.address) continue
      summary.buyback += (profits[key].buy_total * (1 - (token.royalties + AppConst.HEN_FEE) / 1000)).round(4)
      continue
    }
    let avg_buy = profits[key].buy_ed == 0 ? 0 : (profits[key].buy_total / profits[key].buy_ed).round(4)
    let avg_sale = ((profits[key].sold_total / profits[key].sold_ed) * (1 - (token.royalties + AppConst.HEN_FEE) / 1000)).round(4)
    summary.profits += (avg_sale - avg_buy) * profits[key].sold_ed
  }

  // we evaluate only first market data
  if (token.fa2_id == AppConst.FXHASH_MINTER) {
    issuer_count = token.balance
    issuer_offer = token.price / AppConst.HEN_DECIMALS
    min_offer = min_first_market = issuer_offer
    total_artist = (token.supply - token.balance) * issuer_offer * (1 - AppConst.HEN_FEE / 1000)
    total_fees = (token.supply - token.balance) * issuer_offer * AppConst.HEN_FEE / 1000;
  }

  summary.artist += total_artist;
  summary.collectors += total_collectors;
  summary.fees += total_fees;

  for (let s of token.swaps) {
    if (s.amount_left == 0) continue;
    min_offer = Math.min(min_offer, s.price / 1000000);
    if (s.seller.address == token.creator.address) {
      if (s.platform == 'bid2') {
        if (s.amount_left > token.held) s.amount_left = token.held
        token.held -= s.amount_left
        if (s.amount_left == 0) continue; // invalid offer
      }
      issuer_count += Number(s.amount_left);
      issuer_offer = Math.min(issuer_offer, s.price / 1000000);
    } else {
      let adr = s.seller.address;
      if (s.platform == 'bid2') {
        if (empty(holders[s.seller.address])) continue
        else if (holders[s.seller.address].quantity < s.amount_left) s.amount_left = holders[s.seller.address].quantity
        if (s.amount_left == 0) continue; // invalid offer
      }
      else {
        if (empty(fans[adr])) fans[adr] = {
          name: empty(s.seller.name) ? null : s.seller.name,
          twitter: s.seller.twitter,
          wallet: adr,
          tokens: 0,
          editions: 0,
          list: [],
        };
        if (!fans[adr].list.includes(token.pk_id)) fans[adr].tokens += 1;
        fans[adr].editions += s.amount_left;
      }
      resale_count += Number(s.amount_left);
      resale_offer = Math.min(resale_offer, s.price / 1000000);
    }
    let list = !empty(s.fulfilled) ? s.fulfilled : s.trades
    if (!empty(list))
      for (let t of list) {
        setOrRetrieveName(t.buyer.address, t.buyer.name);
        setOrRetrieveName(t.seller.address, t.seller.name);
      }
  }

  if (issuer_count == 0) issuer_offer = 0;
  if (resale_count == 0) resale_offer = 0;
  let offer = "0";
  offer = issuer_count > 0 ? `${issuer_count}x${issuer_offer}tz` : "0";

  let first_market =
    min_first_market != null ?
      `${min_first_market.round(2)}tz` :
      "-";
  let resale = resale_count > 0 ? `${resale_count}x${resale_offer}tz` : "0";
  if (issuer_count == 0 && resale_count == 0) min_offer = 0;
  let ldate = new Date(last_sale);

  if (issuer_count > 0) {
    let url = nft_url(token.uuid, 'shill')
    shill += `${empty(token.title) ? 'untitled' : token.title} (${issuer_count}/${token.total}) ${issuer_offer}tz - ${url}\n`
  }

  return (
    <tr>
      <td sorttable_customkey={token.timestamp}>{nft_link(token.uuid)}</td>
      <td>{artwork_link}</td>
      <td>{token.title.slice(0, 50)}</td>
      <td className='right'>{token.total}</td>
      <td className='right'>{token.held}</td>
      <td className='right nocsv'>{token.burned}</td>
      <td className='right currency'>{first_market}</td>
      <td sorttable_customkey={issuer_offer} className='right'>{offer}</td>
      <td sorttable_customkey={resale_offer} className='right'>{resale}</td>
      <td className='right'>{issuer_count + resale_count}</td>
      <td className='right sorttable_numeric currency' sorttable_customkey={total_artist}>{Number(total_artist).round(2)}tz</td>
      <td className='right sorttable_numeric currency' sorttable_customkey={total_collectors}>{Number(total_collectors).round(2)}tz</td>
      <td className='right sorttable_numeric currency' sorttable_customkey={min_offer}>{Number(min_offer).round(2)}tz</td>
      <td className='right'>{trade_count}</td>
      <td className='right sorttable_numeric currency' sorttable_customkey={max_resale}>{Number(max_resale).round(2)}tz</td>
      <td sorttable_customkey={ldate.toISOString()} className='right nowrap'>{last_sale > 0 ? formattedDate(ldate) : "--"}</td>
      {token.owner ? (
        <>
          <td className='hidden'>{token.owner.name}</td>
          <td className='hidden'>{token.owner.address}</td>
        </>
      ) : (
        <>
          <td className='hidden'>NA</td>
          <td className='hidden'>NA</td>
        </>
      )}
      <td className='nocsv'>{history_link(token.uuid || token.id)}</td>
    </tr>
  )
}

async function addShill() {
  if (empty(shill)) return '';
  $("#help").before(`
  <div class='block'>
    <b>Shill remaining artworks</b><br/>
    <textarea id="shill" cols="120" rows="25">${shill}</textarea>
  </div>
  `)
}

async function addFans(full) {
  let list = Object.values(fans);
  if (list.length == 0) return 0;
  list = list.sort(function (a, b) {
    let val = b.tokens - a.tokens;
    if (val == 0) val = b.editions - a.editions;
    if (val == 0) val = a.date - b.date;
    return val;
  });

  let nb_fans = list.filter(e => e.tokens > 1).length;

  if (full) {
    if (full != 'all') list = list.filter(e => e.tokens > 1);
  }
  else if (list.length > MAX_FANS) list = list.slice(0, MAX_FANS);

  let div = document.createElement('div')
  div.className = 'inline_table'
  ReactDOM.render(
    <CopyTable id="fans">
      <table id="fanst">
        <thead>
          <tr>
            <th colSpan='2'>{full ? 'Fans' : 'Biggest Fans'}</th>
            <th>Twitter</th>
            <th className='right'>Tokens</th>
            <th className='right'>Editions</th>
            {full && (
              <>
                <th>First collect</th>
                <th>Wallet</th>
              </>
            )}
            <th>Activity</th>
          </tr>
        </thead>
        <tbody>
          {
            list.map((entry, idx) => {
              let name = empty(entry.name) ? walletNames[entry.wallet] : entry.name
              if (empty(name)) name = shorten_wallet(entry.wallet)
              return (
                <tr key={idx}>
                  <td className='right'>{idx + 1}</td>
                  <td>{flex_link({ address: entry.wallet, name: name })}</td>
                  <td>{twitter_link(entry.twitter)}</td>
                  <td className='right'>{entry.tokens}</td>
                  <td className='right'>{entry.editions}</td>
                  {full && (
                    <>
                      <td>{formattedDate(entry.date, 'absolute')}</td>
                      <td>{entry.wallet}</td>
                    </>
                  )}
                  <td><a href={`/activity?wallet=${entry.wallet}&creator=${artistWallet}`} target="_blank">Activity</a></td>
                </tr>
              )
            })
          }
        </tbody>
      </table>
    </CopyTable>
    , div
  )
  document.getElementById("tokens").after(div)
  return nb_fans;
}

const changeView = async () => {
  let val = document.getElementById("show_all").checked
  val ? urlParams.set("full", 1) : urlParams.delete("full");
  update_current_href();
  await showFans()
}


export async function fetchRaribleCollection(wallet) {
  if (empty(wallet)) return;
  let url = `https://tezos-api.rarible.org/v0.1/collections/byOwner?owner=${wallet}&includeMeta=true`
  let data = await apiAsyncRequest(url);
  if (empty(data) || empty(data.collections)) return []

  let results = {}
  for (let item of data.collections) {
    let entry = {
      fa2_id: item.id,
      owner: item.owner,
      name: item.name,
      symbol: item.symbol,
    }
    if (entry.owner == wallet) results[entry.fa2_id] = entry
  }
  return results
}

export async function fetchRaribleSwaps(wallet) {
  if (empty(wallet)) return;
  let url = `https://tezos-api.rarible.org/v0.1/orders/sell/byMaker?maker=${wallet}&size=1000`
  let data = await apiAsyncRequest(url);
  if (empty(data) || empty(data.orders)) return []

  let results = []
  for (let item of data.orders) {
    if (item.status != 'ACTIVE') continue
    if (item.cancelled) continue
    let order = {
      rarible: true,
      platform: 'rarible',
      timestamp: item.createdAt,
      token_id: item.make.assetType.tokenId,
      fa2_id: item.make.assetType.contract,
      amount: parseInt(item.makeStock),
      amount_left: parseInt(item.makeBalance),
      price: (parseFloat(item.take.value) / parseFloat(item.make.value)) * AppConst.HEN_DECIMALS,
      creator_id: item.maker,
      creator: { address: item.maker },
      status: 0,
      id: item.hash,
    }
    order.uuid = `${order.fa2_id}_${order.token_id}`
    results.push(order)
  }
  return results
}

export async function fetchRaribleTokens(wallet) {
  if (empty(wallet)) return;
  let url = `https://tezos-api.rarible.org/v0.1/items/byCreator?creator=${wallet}&includeMeta=true&size=1000`
  let data = await apiAsyncRequest(url);
  if (empty(data) || empty(data.items)) return []

  let collections = await fetchRaribleCollection(wallet)

  let results = []
  for (let item of data.items) {
    let ok = (item.contract == AppConst.RARIBLE_MINTER || collections[item.contract])
    if (!ok) continue

    let token = {
      id: item.tokenId,
      rarible: true,
      collection: collections[item.contract] ? true : false,
      platform: 'rarible',
      fa2_id: item.id.split(':')[0],
      title: item.meta.name,
      supply: parseInt(item.supply),
      timestamp: item.mintedAt,
      display_uri: item.meta.image,
      artifact_uri: item.meta.image,
      thumbnail_uri: item.meta.image,
      royalties: item.royalties.map(e => e.value / 10).reduce((a, b) => a + b, 0),
      creator_id: wallet,
      creator: { address: wallet },
    }
    if (token.supply == 0) token.supply = parseInt(item.lazySupply)
    token.uuid = `${token.fa2_id}_${token.id}`

    token.token_holders = item.owners.map(e => {
      return (e == wallet ? null : { quantity: 1, holder: { address: e } })
    }).filter(e => e)

    // owned by creator
    token.balance = token.supply - token.token_holders.length
    token.token_holders.push({ quantity: token.balance, holder: { address: wallet } })
    token.swaps = []
    results.push(token)
  }
  return results
}

export async function fetchRaribleCreation(wallet) {
  let tokens = await fetchRaribleTokens(wallet)
  if (!empty(tokens)) {
    let data = await fetchRaribleSwaps(wallet)
    for (let order of data) {
      let token = tokens.find(e => e.uuid == order.uuid)
      if (token) {
        if (empty(token.swaps)) token.swaps = []
        token.swaps.push(order)
        let holder = token.token_holders.find(e => e.holder.address == wallet)
        if (holder) holder.quantity -= order.amount_left
      }
    }
  }
  return tokens
}

export async function fetchFans() {
  initData()

  wallet = get_wallet();
  if (empty(wallet)) return;
  loading();

  let is_contract = wallet.match(/^KT.+/im) ? true : false
  let infos = null
  if (is_contract) {
    infos = await getCollectionInfos(wallet)
    if (!empty(infos)) {
      artistInfos = { wallet: wallet, name: infos.name }
      artistWallet = infos.contract
      if (empty(infos?.collection_id)) {
        fans = await fetchCustomFans(wallet)
        await showFans()
        return
      }
    }
  }

  let tokens = await fetchData(wallet, infos);
  summary = { editions: 0, objkt: 0 };
  for (let token of tokens) {
    // for 1/1 edition we will store the owner
    if (empty(artistWallet)) artistWallet = token.creator.address;
    // add holders infos
    let holders = holders_info(token.token_holders);
    if (empty(holders)) continue; // burned so we skip
    token.available = 0
    AppConst.MARKETPLACE_CONTRACTS.forEach(a => {
      if (!empty(holders[a])) token.available += holders[a].quantity;
    })

    token.held = empty(holders[wallet]) ? 0 : holders[wallet].quantity;
    token.total = 0;
    let token_date = new Date(token.timestamp)

    for (let adr in holders) {
      let item = holders[adr];
      token.total += Number(item.quantity);
      // fans
      if (AppConst.MARKETPLACE_CONTRACTS.includes(adr)) continue;
      else if (adr == AppConst.BURN_ADDRESS) continue;
      else if (adr == wallet) continue;
      let name = setOrRetrieveName(adr, item.name);

      if (empty(fans[adr])) fans[adr] = {
        name: name,
        twitter: item.twitter,
        wallet: adr,
        tokens: 0,
        editions: 0,
        first_token: token_date,
        list: [],
      };

      fans[adr].tokens += 1;
      fans[adr].editions += item.quantity;
      fans[adr].list.push(token.pk_id);
      if (token_date < fans[adr].first_token) fans[adr].first_token = token_date
    }

    for (let s of token.swaps) {
      if (s.seller.address == wallet) {
        if (s.platform == 'bid2' && s.amount_left > token.held) s.amount_left = token.held
        token.held -= s.amount_left
        continue;
      }
      if (s.platform == 'bid2') continue; // already included in token_holders
      let adr = s.seller.address;
      let date = new Date(s.timestamp)

      if (s.amount_left == 0) {
        if (!fans[adr]) continue
        if (!fans[adr].date || date < fans[adr].date) fans[adr].date = date
        continue;
      }

      if (empty(fans[adr])) fans[adr] = {
        name: empty(s.seller.name) ? null : s.seller.name,
        wallet: adr,
        tokens: 0,
        editions: 0,
        date: date,
        list: [],
      };
      if (!fans[adr].list.includes(token.pk_id)) fans[adr].tokens += 1;

      if (!fans[adr].date || date < fans[adr].date) fans[adr].date = date
      fans[adr].editions += s.amount_left;
    }

    summary.objkt += 1;
    summary.editions += token.total;
  }

  for (let adr of Object.keys(fans)) {
    if (fans[adr].date) continue
    fans[adr].date = fans[adr].first_token
  }
  await showFans()
}


async function showFans() {
  $("#loading").hide();
  $('#result').show();

  let full = urlParams.get("full")
  if (!empty(full)) full = 'all'
  else full = true

  $('#result').html(`<div id='tokens' class='block'></div>`);
  let nb_fans = await addFans(full);
  if (empty(nb_fans)) nb_fans = 0;
  let infos = $('<span></span>')

  let checked_full = (full == 'all')
  ReactDOM.render(
    <>
      <div className='block'>
        There are <b>{Object.keys(fans).length} collectors</b> (owning at least one edition)
        including <b>{nb_fans} fans (owning at least 2 differents tokens)
          of {artist_link(artistInfos)}</b><br />
        Tokens : {summary.objkt} - Editions : {summary.editions}
      </div>
      <div className='block'>
        <Form.Check
          inline
          type="switch"
          id="show_all"
          name="show_all"
          label="View all collectors"
          defaultChecked={checked_full}
          onChange={changeView}
        />
      </div>
      <p className='block'>Fans are sorted by number of tokens owned, then number of editions owned, and then first time they collected an objkt</p>
    </>
    , infos[0])

  $('#tokens').html(infos)

}

async function addSellers() {
  let list = Object.values(sellers);
  if (list.length == 0) return;
  list = list.sort(function (a, b) {
    let val = b.total - a.total;
    if (val == 0) val = a.editions - b.editions;
    return val;
  });
  if (list.length > MAX_FANS) list = list.slice(0, MAX_FANS);

  let div = document.createElement('div')
  div.className = 'inline_table'

  ReactDOM.render(
    <CopyTable id='sellers'>
      <table>
        <thead>
          <tr>
            <th colSpan='2'>Biggest sellers</th>
            <th className='right'>Editions</th>
            <th className='right'>Total</th>
            <th>Activity</th>
          </tr>
        </thead>
        <tbody>
          {list.map((entry, idx) => {
            let name = walletNames[entry.wallet]
            if (empty(name)) name = shorten_wallet(entry.wallet)
            return (
              <tr key={idx}>
                <td className='right'>{idx + 1}</td>
                <td>{gallery_link({ address: entry.wallet, name: name })}</td>
                <td className='right'>{entry.editions}</td>
                <td className='right currency'>{entry.total.round(2)}tz</td>
                <td><a href={`/activity?wallet=${entry.wallet}&creator=${artistWallet}`} target="_blank">Activity</a></td>
              </tr>
            )
          })}
        </tbody>
      </table >
    </CopyTable>, div)
  $("#tokens").after(div)
}

async function addBuyers() {
  let list = Object.values(buyers);
  if (list.length == 0) return;
  list = list.sort(function (a, b) {
    let val = b.total - a.total;
    if (val == 0) val = a.editions - b.editions;
    return val;
  });
  if (list.length > MAX_FANS) list = list.slice(0, MAX_FANS);

  let div = document.createElement('div')
  div.className = 'inline_table'

  ReactDOM.render(
    <CopyTable id='buyers'>
      <table>
        <thead>
          <tr>
            <th colSpan='2'>Biggest buyers</th>
            <th className='right'>Editions</th>
            <th className='right'>Total</th>
            <th>Activity</th>
          </tr>
        </thead>
        <tbody>
          {
            list.map((entry, idx) => {
              let name = walletNames[entry.wallet]
              if (empty(name)) name = shorten_wallet(entry.wallet)
              return (
                <tr key={idx}>
                  <td className='right'>{idx + 1}</td>
                  <td>{flex_link({ address: entry.wallet, name: name })}</td>
                  <td className='right'>{entry.editions}</td>
                  <td className='right currency'>{entry.total.round(2)} tz</td>
                  <td><a href={`/activity?wallet=${entry.wallet}&creator=${artistWallet}`} target="_blank">Activity</a></td>
                </tr>
              )
            })
          }
        </tbody>
      </table >
    </CopyTable>
    , div);
  document.getElementById("tokens").after(div)
}
