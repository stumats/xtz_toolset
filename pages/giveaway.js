import React, { useEffect, useState } from 'react';

import Head from 'next/head'
import { empty, loading, done, isTezosDomain, resolveTezosDomains } from '../utils/utils'
import { buildBatchMenu } from '../utils/menu'
import { processTransaction } from '../utils/transaction';
import { Result } from '../components/result'
import { urlToToken } from '../utils/contract'

import Form from 'react-bootstrap/Form'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

const handleFocus = (event) => event.target.select();

async function buildTransfers(token_url, wallets) {
  let addresses = []
  let convert = []
  for (let wallet of wallets.split(/[,;:\s]+/)) {
    if (empty(wallet)) continue
    else if (isTezosDomain(wallet)) convert.push(wallet)
    else addresses.push(wallet)
  }
  if (!empty(convert)) {
    let data = await resolveTezosDomains(convert)
    for (let item of data) addresses.push(item.address)
  }
  let token = await urlToToken(token_url)

  let list = []
  for (let wallet of addresses) list.push({ transfer_to: wallet, fa2_id: token.fa2_id, token_id: token.id, amount: 1 })
  return list
}

export default function PageContent() {
  const [transfers, setTransfers] = useState(false)
  const [csvContent, setCsvContent] = useState("")

  useEffect(() => { buildBatchMenu() }, []);

  async function buildCSV(list) {
    if (empty(list)) return;
    let txt = []
    for (let item of list) txt.push(`${item.transfer_to},${item.token_id},1`)
    setCsvContent(txt.join("\n"))
    return txt.join("\n")
  }

  async function prepareSend(e) {
    e.preventDefault();
    let token_url = document.querySelector('#token_url').value;
    if (token_url == null || token_url == '') return;

    let wallets = document.getElementById("wallets").value;
    if (wallets == null || wallets == '') return;

    let list = await buildTransfers(token_url, wallets)
    setTransfers(list)
    buildCSV(list)
  }

  async function doTransfer() {
    let contract = transfers[0].fa2_id
    await processTransaction('giveaway', { tokens: transfers, fa2_id: contract })
  }

  return (
    <>
      <Head>
        <title>Batch Giveway - TEZOS NFTs</title>
      </Head>
      <div id="input" className="block">
        <h2>Send a token to multiple wallets</h2>
        <Row>
          <Col xs="12">
            <Form.Group controlId="token_url">
              <Form.Label>ANY NFT URL or HEN OBJKT ID</Form.Label>
              <Form.Control type='text' />
              <Form.Text muted>
                As long as the url is from an HEN clone, Teia, OBJKT, FxHash, Versum, Rarible, or is any URL containing CONTRACT/TOKEN_ID, it will be accepted.
              </Form.Text>
            </Form.Group>
          </Col>
        </Row>
        <Row>
          <Col xs="12">
            <Form.Group controlId="wallets">
              <Form.Label>Wallets list</Form.Label>
              <Form.Control
                as="textarea"
                rows="7"
                placeholder={`tz...1 or domain1.tez\ntz...2 or domain2.tez\netc`}
              >
              </Form.Control>
            </Form.Group>
          </Col>
        </Row>
        <a onClick={prepareSend} id="prepare_it" className='btn btn-secondary'>PREPARE</a>
      </div>

      <Result>
        {!empty(transfers) && transfers ? (
          <>
            <p className="block"></p>
            <Row>
              <Col xs="12">
                <Form.Group controlId="csv">
                  <Form.Label>Here is a CSV for the transfers, to use in <a href="https://batch.xtz.tools/" target="_blank" rel="noreferrer">FA2 Token Batch Sender</a> if you need to make some manual adjustment.</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows="10"
                    readOnly={true}
                    onFocus={handleFocus}
                    onClick={handleFocus}
                    defaultValue={csvContent}
                    placeholder={`tz...1 or domain1.tez\ntz...2 or domain2.tez\netc`}
                  >
                  </Form.Control>
                </Form.Group>
              </Col>
            </Row>

            <p>If everything is OK, you can initiate the transfer by clicking the button below</p>
            <a onClick={doTransfer} id="send_it" className='btn btn-secondary'>SEND TOKENS</a>
          </>
        ) : (
          <p className="block">
            This tool allow you to transfer 1 edition of a token you own in your wallet to multiples wallets.<br />
            <b>WARNING : </b> make sure to only do the send by <b>batch of at most 500 wallets</b> to be sure to not hit the hard limit of tezos storage needed to do such batch transfers.
          </p>
        )}
        <div id="trx_container"></div>
      </Result>
    </>
  )
}

PageContent.layout = 'skip_result'