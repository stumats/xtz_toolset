import React from 'react'

import { empty, can_mint } from '../../utils/utils'
import { activity_link, history_link, is_fxhash } from '../../utils/links'
import { operation_url } from '../../utils/links'
import { MediaTag } from '../media_tag'
import * as AppConst from '../../utils/constants'

export const Media = (props) => {
  let token = props.token
  let buy = props.buy

  let myid = token.uuid || token.id
  let fxhash = token.uuid ? is_fxhash(token.uuid) : (!empty(token.fxhash) && token.fxhash)
  let mintable = true
  let offer = props.offer

  if (fxhash) {
    if (offer) offer = 'na'
    mintable = can_mint(token)
    if (empty(buy) && mintable) buy = {
      swap_id: token.id,
      platform: 'fxhash',
      extended_price: token.price,
      amount_left: token.balance,
      style: 'primary',
      full: true
    }
  }

  let op_platform = token?.force_platform || buy?.force_platform || buy?.platform
  if (token.rarible && token.collection) {
    if (offer) offer = 'na'
    op_platform = 'rarible'
  }

  return (
    <>
      <div className='media_container'>
        {props.show_price && (
          <span className='owning small'>{props.show_price}tz</span>
        )}
        <span className='objkt_id'>{history_link(myid, `#${token.id}`)}</span>
        <a href={operation_url(myid, op_platform)} className='media_link' target='_blank'>
          <MediaTag token={token} />
        </a>
        {token.moderated ? (
          <div className='shopping'>
            <span className='flagged'>FLAGGED</span>
          </div>
        ) : (
          <>
            {!mintable && (
              <div className='shopping'>
                <span className='flagged'>COOL DOWN - {buy ? buy.amount_left : token.balance}x{token.price / AppConst.HEN_DECIMALS}tz </span>
              </div>
            )}
          </>
        )}

        {props.buyer && (
          <span className='buyer'>{activity_link(props.buyer)}</span>
        )}
      </div>
    </>
  )
}
