import React, { useEffect } from 'react';
import Script from 'next/script'
import Head from 'next/head'

import { profileMonitoring } from '../../utils/profile'
import { buildMenu } from '../../utils/menu';
import { connectedWalletAddress } from '../../utils/wallet';
import Form from 'react-bootstrap/Form'

export default function Artist() {
  useEffect(() => {
    async function processing() {
      let wallet = await connectedWalletAddress()
      buildMenu(wallet)
      profileMonitoring(false)
    }
    processing()
  }, []);

  return (
    <div id="input" className="block">
      <Head>
        <title>Search wallet - TEZOS NFTs</title>
      </Head>
      <Script src="/js/sorttable.js" />

      <h2>Search a wallet by name or from description</h2>
      <Form.Control id="search" placeholder="artist name or description" />
    </div>
  )
}