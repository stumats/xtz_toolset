import React from 'react'

import { empty, formattedDate } from '../../utils/utils'
import { gallery_link, history_link, is_hen, is_fxhash, is_versum, twitter_link } from '../../utils/links'
import { Media } from '../media'

const Quantity = ({ price, amount }) => {
  if (price == 'otc') return (<span className='qty' title="Trade made outside of a marketplace">OTC</span>)
  else return (
    <>
      <span className='qty'>
        {amount > 1 ? (
          <b>{amount}</b>
        ) : (
          <>{amount}</>
        )}
      </span>x{price}tz
    </>
  )
}

export const ShowTrade = (props) => {
  let token = props.token
  let tx = props.transaction
  let type = props.type
  let shopping = props.shopping

  let creator = token.creator
  let artist = gallery_link(creator, { empty: true, secondary: true });

  let marketplace = null
  if (token.show_platform || (tx && tx.full && tx.full != 'short')) {
    // show marketplace
    if (tx?.platform == 'fxhash' || is_fxhash(token.uuid)) marketplace = 'FxHash'
    else if (tx?.platform == 'rarible') marketplace = 'Rarible'
    else if (tx?.platform == 'versum' || is_versum(token.uuid)) marketplace = 'Versum'
    else if (!is_hen(token.uuid)) marketplace = 'Collections'
    else if (String(tx?.platform).match(/^bid/)) marketplace = 'Objkt.com'
    else marketplace = 'HicEtNunc'
  }

  let title = (empty(token.title) ? 'Untitled' : token.title).slice(0, 40)
  if (type == 'onsale') {
    if (tx.primary) tx.style = 'primary'
    else if (tx.secondary) tx.style = 'secondary'
    tx.full = true // full info on media button
    return (
      <>
        <div className='infos'>
          <b>{artist}</b><br />
          <span className='title'>{title}</span>
          <>
            Ed: {tx.amount_left}/{token.supply} - Held: {tx.token.held}
          </>
          {!shopping && !isNaN(tx.price) && (
            <>
              Price: {tx.price}tz< br />
            </>
          )}
          {marketplace && (
            <>
              <span className='platform'>Marketplace : {marketplace}</span>
            </>
          )}
        </div>
        <Media token={token} offer={shopping === 'offer'} buy={shopping ? tx : null} />
      </>
    )
  }
  else if (type == 'swap') {
    return (
      <>
        <div className='infos'>
          <b>{artist}</b> {twitter_link(creator.twitter, true)}<br />
          {token.supply} ed.
          {marketplace && (
            <>
              <span className='platform'>Marketplace : {marketplace}</span>
            </>
          )}
          <div className='transactions'>
            <div className='inner'>
              {props.swaps.map((swap, idx) => {
                return (<span className='trx' key={idx} dangerouslySetInnerHTML={{ __html: swap }} />)
              })}
            </div>
          </div>
        </div>
        <Media token={token} buy={tx} />
      </>
    )
  }
  else if (type == 'collect') {
    return (
      <>
        <div className='infos'>
          <b>{artist}</b> {twitter_link(creator.twitter, true)}<br />
          {token.supply} ed.

          {marketplace && (
            <>
              <span className='platform'>Marketplace : {marketplace}</span>
            </>
          )}

        </div>
        <Media token={token} buy={tx} />
      </>
    )
  }
  else if (type == 'flex') {
    let swap = token.swap
    if (swap) {
      if (token.creator.address == swap.seller_id) swap.style = 'primary'
      else swap.style = 'secondary'
      swap.full = true // full info on media button
    }

    return (
      <>
        <div className='infos'>
          <b>{artist}</b><br />
          {token.supply} Ed. - Roy.: {Number(token.royalties / 10).round(0)}%<br />
          <Quantity price={tx.price} amount={tx.amount} /> - {formattedDate(tx.date, "absolute")}<br />
        </div >
        <Media token={token} buy={swap} />
      </>
    )
  }
  else if (type == 'ban') {
    return (
      <div className='nft' id={token.id}>
        <div className='infos'>
          <b>{artist}</b> - {history_link(token.uuid, `#${token.id}`)}<br />
          <span className='title'>
            <input type="checkbox" name={token.id} data-id={token.id} data-amount={token.quantity} id={`token_${token.id}`}></input>
            <label htmlFor={`token_${token.id}`}>{token.quantity} x {title}</label>
          </span>
          <span className='reason'>{token.reason}</span>
        </div >
        <Media token={token} />
      </div >
    )
  }
  else if (type == 'feed') {
    let divCls = (tx?.following || token.following) ? 'nft following' : 'nft'
    return (
      <div className={divCls}>
        <div className='infos'>
          <b className='artist'>{artist}</b>
          <span className='right' title="[Number of sales by artist, Number of tokens created]">
            [{token.creator.sales},{token.creator.tokens}]
          </span>
          <br />
          <span className='title'>{title}</span>
          Ed: {token.supply} - {formattedDate(new Date(token.timestamp), 'short')}
          {marketplace && (
            <>
              <span className='platform'>Marketplace : {marketplace}</span>
            </>
          )}
        </div >
        <Media token={token} buy={tx} />
      </div>
    )
  }
  else return null
}
