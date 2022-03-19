import React, { useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { WalletConnector } from '../wallet_connector'
import Link from 'next/link'

export const Home = (props) => {
  useEffect(() => {
    let div = document.getElementById("menu_container")
    if (div) div.remove()
  }, [])

  return (
    <>
      {!props.skip_connect && (
        <WalletConnector>
          {props.children}
        </WalletConnector>
      )}
      <h2 id="page_title">
        <Link href="/">
          <a title="Home"><FontAwesomeIcon icon="home" /></a>
        </Link>
        &gt;
        {props.title}
      </h2>
    </>
  )
}
