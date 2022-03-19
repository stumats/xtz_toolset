import React from 'react'
import { ShowTrade } from '../components/show_trade'

import {
  empty, urlParams, proper_value, update_current_href
} from '../utils/utils'

var transactions = [];

export function setTransactions(list) {
  transactions = list
}

export function sortTrades(sort) {

  if (empty(sort)) sort = urlParams.get("sort");
  else {
    urlParams.set("sort", sort)
    update_current_href()
  }
  if (empty(sort)) sort = 'date';

  if (sort == 'date') {
    transactions.sort(function (a, b) {
      return b.date - a.date;
    });
  } else if (sort == 'available') {
    transactions.sort(function (a, b) {
      // we return first obj without creator offers
      let a_val = a.token.offer_count // + a.token.held
      if (a_val < 2) a_val = 0
      let b_val = b.token.offer_count // + b.token.held
      if (b_val < 2) b_val = 0
      let val = a_val - b_val;
      if (val != 0) return val;

      // then we show obj without any swap
      a_val = proper_value(a.token.available) || 0
      b_val = proper_value(b.token.available) || 0
      val = a_val - b_val;
      if (val == 0) return compare_prices(a, b);
      else if (a_val == 0 && b_val > 0) return -1;
      else if (b_val == 0 && a_val > 0) return 1;

      return compare_prices(a, b);
    });
  } else if (sort == 'profit') {
    transactions.sort(function (a, b) {
      // we return first obj without creator offers
      let a_val = a.token.offer_count + a.token.held
      if (a_val < 2) a_val = 0
      let b_val = b.token.offer_count + b.token.held
      if (b_val < 2) b_val = 0
      let val = a_val - b_val;
      if (val != 0) return val;

      // then we retrieve best price
      return compare_prices(a, b);
    });

  } else if (sort == 'price') {
    transactions.sort(function (a, b) {
      let val = b.price - a.price;
      if (val == 0) val = b.date - a.date;
      return val;
    });
  }
  window.scrollTo(0, 0);
  return transactions
}

function compare_prices(a, b) {
  //  we show the highest resale prices
  let val = (proper_value(b.token.min_price) || 0) - (proper_value(a.token.min_price) || 0);
  if (val != 0) return val;

  // then we show the less editions
  val = (proper_value(a.token.supply) || 0) - (proper_value(b.token.supply) || 0);
  if (val != 0) return val;

  val = b.price - a.price;
  if (val != 0) return val;
  return b.date - a.date;
}

export const ShowToken = (props) => {
  let tx = props.tx
  let token = tx.token;

  if (token.swapped) return null; // we already have swapped one
  if (tx.platform == 'fxhash') tx.swap_id = `${token.id}_${tx.platform}`

  let id = tx.type == 'swap' ? "obj_" + token.pk_id : 'trade_' + tx.id;
  let class_name = `nft ${props.collection}`.trim()
  if (tx.secondary) class_name += ' secondary'
  if (tx.empty) class_name += ' empty'

  tx.token.show_platform = true

  return (
    <div id={id} className={class_name} data-token={token.pk_id} data-swap={tx.swap_id || 0}>
      <ShowTrade transaction={tx} token={tx.token} shopping={props.shopping} type={props.collection} />
    </div>
  )
}
