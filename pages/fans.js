import React, { useEffect } from 'react';
import Head from 'next/head'
import { fetchFans } from '../utils/artist'
import { WalletField } from '../components/wallet_field';

export default function Fans() {
  return (
    <div id="input" className="block">
      <Head>
        <title>Fans - TEZOS NFTs</title>
      </Head>
      <h2>Artist's fans list</h2>
      <WalletField
        label="Wallet or Contract"
        monitoring={{
          bookmarklet: { title: 'Fans', path: 'fans' },
          method: fetchFans,
        }} />
    </div>
  )
}