import React, { useEffect, useState } from 'react';
import Head from 'next/head'

import { Result } from '../../components/result'
import { empty, loading, done, showError, apiAsyncRequest } from '../../utils/utils'
import * as Wallet from '../../utils/wallet'
import * as AppConst from '../../utils/constants'
import { processTransaction } from '../../utils/transaction'
import { buildMenu } from '../../utils/menu'

import Form from 'react-bootstrap/Form'

const query_operators = `
query qryNftBiker($address: String!) {
  hic_et_nunc_token_operator(where: {owner_id: {_eq: $address}}, order_by: {id: asc}) {
    id
    operator
    owner_id
    token_id
  }
}
`

const query_hen_operators = `
query qryNftBiker($address: String!) {
  hic_et_nunc_token_operator(where: {owner_id: {_eq: $address}, operator:{ _eq: "${AppConst.HEN_MARKETPLACE}"}}, order_by: {id: asc}) {
    id
    operator
    owner_id
    token_id
  }
}
`

const QUERY_LIMIT = 1000
const MAX_SWAPS = 75

async function getOperators(wallet, hen_only) {
  let url = `https://api.tzkt.io/v1/bigmaps/513/keys?&active=true&limit=${QUERY_LIMIT}&key.owner=${wallet}`
  if (hen_only) url += `&key.operator=${AppConst.HEN_MARKETPLACE}`
  else url += `&key.operator.ne=${AppConst.BID_MARKETPLACE2}` // we must keep bid v2
  const data = await apiAsyncRequest(url);
  let operators = data.map(e => {
    let key = e.key
    key.id = e.id
    return key
  })
  return operators
}

export default function PageContent() {
  const [operators, setOperators] = useState({ loaded: false, list: [] })
  const [revokeAll, setRevokeAll] = useState(true)

  useEffect(() => {
    buildMenu()
    Wallet.connectedWalletAddress().then(wallet => {
      if (!empty(wallet)) loadOperators()
      buildMenu(wallet)
    })
  }, []);

  const distinctOperators = () => {
    let list = [...new Set(operators.list.map(e => e.operator))]
    return list.length
  }

  const changeRevokeAll = (evt) => {
    let val = evt.target.value == 'hen'
    if (val != revokeAll) {
      setRevokeAll(val)
      loadOperators(val)
    }
  }

  async function loadOperators(force) {
    if (!Wallet.account) await Wallet.syncTaquito()
    if (!Wallet.account) {
      showError({ message: 'You must first connect your wallet with the upper right CONNECT button to use this tool, then reload the page.' }, { raw: true })
      return
    }
    loading(true)
    document.getElementById("error").style.display = 'none'

    let div = document.getElementById("load_op")
    if (div) div.remove()

    let wallet = Wallet.account.address
    buildMenu(wallet)

    if (typeof (force) == 'undefined') force = revokeAll
    let list = await getOperators(wallet, force ? false : true)
    const results = { loaded: true, list: list, has_more: false }
    setOperators(results)
    done()
  }

  const removeOperators = async () => {
    let processed = {}
    let remove = []
    let keep = []
    for (let op of operators.list) {
      if (processed[op.token_id]) keep.push(op)
      else if (remove.length < MAX_SWAPS) {
        processed[op.token_id] = true
        remove.push(op)
      }
      else keep.push(op)
    }
    let data = {
      owner: Wallet.account.address,
      operators: remove
    }
    let ok = await processTransaction('revoke_operators', data)
    if (ok) setOperators({ loaded: true, list: keep, has_more: true })
    done()
  }

  let remove_title = operators.has_more ? 'CONTINUE TO REVOKE OPERATORS' : 'REVOKE OPERATORS'
  return (
    <>
      <Head>
        <title>Remove operators - TEZOS NFTs</title>
      </Head>
      <div id="input">
        <h2>Remove operators</h2>
        <blockquote>
          <b>
            Unrevoked operator permissions could enable a contract to control a user's NFT
          </b>
          <br />
          When a contract interact with your tokens, it need a temporary operator permission on the token to manipulate. At the end of the operation, the contract should revoke this temporary operator permission, otherwise the contract can still manipulate your token without asking anymore for your permission to do so.<br />
          HEN and some other contract don't properly remove this permission.
        </blockquote>
        <p>
          This tool allow you to batch remove the operator permissions on all your tokens were such permission still exist. The only exception is for objktcom marketplace v2, which need operator right to manage the non custodial swap of your tokens. So this tool will not remove them as operators.
        </p>
        <p>The tool work in batch of maximum {MAX_SWAPS} operations. It can take up to 1 minute for your wallet to receive the request, and 1 more minute for the confirmation request to appear on your hardware wallet (if you use one).</p>
      </div>
      <Result>
        <div>
          <div className="block" onChange={e => changeRevokeAll(e)}>
            <label className="form-label me-3">Revoke permissions</label>
            <Form.Check
              inline
              type="radio"
              name="revoke_all"
              value="all"
              id="revoke_all"
              defaultChecked={revokeAll}
              label="for all operators (except Objktcom v2)"
            />

            <Form.Check
              inline
              type="radio"
              name="revoke_all"
              value="hen"
              id="revoke_hen"
              defaultChecked={!revokeAll}
              label="only for HEN marketplace"
            />
          </div>

          {operators.loaded ? (
            <>
              <p>
                There is {operators.length} permissions for {distinctOperators()} operator that need to be removed.<br />
              </p>
              {operators.list.length > 0 && (
                <>
                  <p>Revoke operators for {MAX_SWAPS} tokens, starting with permission ID {operators.list[0].id} :</p>
                  <div id="swap_form">
                    <a href="#" onClick={removeOperators} id="cancel_op" className='btn btn-secondary'>{remove_title}</a>
                  </div>
                </>
              )}
            </>
          ) : (
            <div id="swap_form">
              <a href="#" onClick={loadOperators} id="load_op" className='btn btn-secondary'>CONNECT & LOAD OPERATORS</a>
            </div>
          )}
        </div>
      </Result>
    </>
  )
}

PageContent.layout = 'skip_result'