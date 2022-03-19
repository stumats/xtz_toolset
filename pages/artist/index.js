import React, { useEffect } from 'react';
import Script from 'next/script'
import Head from 'next/head'

import {
  empty, update_current_href, urlParams,
} from '../../utils/utils'
import { fetchArtistWallet } from '../../utils/artist';
import { profileMonitoring } from '../../utils/profile'
import { WalletField } from '../../components/wallet_field'

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Form from 'react-bootstrap/Form'

async function fetchArtist() {
  fetchArtistWallet().then(() => {
    let tbl = document.getElementById("tokens_data");
    try { sorttable.makeSortable(tbl) } catch (e) { console.log(e) }
  })
}

export default function Artist() {
  useEffect(() => {
    profileMonitoring(true)
  }, []);

  return (
    <div id="input" className="block pb-0">
      <Head>
        <title>Artist - TEZOS NFTs</title>
      </Head>
      <Script src="/js/sorttable.js" />

      <h2>Retrieve artist collection</h2>
      <Row>
        <Col xs="12" lg="6">
          <WalletField
            label="Wallet/Contract"
            skip_bookmarklet_div="true"
            width="100%"
            inline={false}
            monitoring={{
              bookmarklet: { title: 'Artist', path: 'artist' },
              method: fetchArtist,
              skip_default: true,
              emptyFields: {
                call: function () {
                  let val = document.getElementById("search")
                  if (!empty(val)) val.value = '';
                  urlParams.delete('search')
                  update_current_href()
                }
              }
            }} />
        </Col>
        <Col xs="12" lg="6">
          <Form.Label>
            Search
          </Form.Label>
          <Form.Control
            id="search"
            name="search"
            type='text'
            placeholder="artist name or description"
          >
          </Form.Control>
        </Col>
      </Row >
    </div >
  )
}