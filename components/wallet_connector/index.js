/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect } from 'react'
import Link from 'next/link'
import * as Wallet from '../../utils/wallet'
import { shorten_wallet } from '../../utils/links'
import { urlParams, changeInputWithTrigger } from '../../utils/utils'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export const WalletConnector = (props) => {
  useEffect(() => {
    try { syncButton() } catch (e) { console.log(e) }
  }, [])

  const ButtonName = () => {
    if (Wallet.account) return shorten_wallet(Wallet.account.address)
    else return 'Connect'
  }

  const syncButton = () => {
    Wallet.setAccount().then((ok) => {
      if (ok) {
        let div = document.getElementById("wallet_connector")
        if (div) div.innerHTML = ButtonName()
        div = document.getElementById("wallet_logout")
        if (div) div.style.display = Wallet.account ? 'inline-block' : 'none'
      }
      else return false
    })
  }

  const handleSyncUnsync = (e) => {
    e.preventDefault()
    if (Wallet.account) {
      changeInputWithTrigger("wallet", Wallet.account.address)
    } else {
      // connect wallet
      Wallet.syncTaquito().then(() => {
        let div = document.getElementById("wallet_connector")
        if (div) div.innerHTML = ButtonName()
        if (Wallet.account?.address) {
          div = document.getElementById("wallet_logout")
          if (div) div.style.display = 'inline-block'
        }
      })
    }
  }
  const handleDisconnect = (e) => {
    e.preventDefault()
    if (Wallet.account) {
      // disconnect wallet
      Wallet.disconnect().then(() => {
        let div = document.getElementById("wallet_connector")
        if (div) div.innerHTML = ButtonName()
        div = document.getElementById("wallet_logout")
        if (div) div.style.display = 'none'
      })
    }
  }

  return (
    <div id="wallet_connector_container" className="auth_wallet">
      {props.children}
      {!props.skip_settings && (
        <a href="/settings" className='btn btn-sm' title='Tools settings'><FontAwesomeIcon icon='cog' /></a>
      )}
      <a href="#" id='wallet_connector' onClick={e => handleSyncUnsync(e)} className='btn btn-sm'>{ButtonName()}</a>
      {!props.skip_logout && (
        <>
          <a href="#" id='wallet_logout'
            onClick={e => handleDisconnect(e)}
            className='btn btn-sm'
            style={{ display: Wallet.account ? 'inline-block' : 'none' }}
          >
            <FontAwesomeIcon icon='sign-out-alt' />
          </a>
        </>
      )}
    </div>
  )
}
