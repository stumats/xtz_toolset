import React, { useEffect } from 'react';
import ReactDOM from 'react-dom'
import Head from 'next/head'
import axios from 'axios'
import Bottleneck from "bottleneck";
import * as AppConst from '../utils/constants'
import { WalletField } from '../components/wallet_field';

import {
  empty, fetchGraphQL, showError, get_wallet, formattedDate,
  urlParams, update_current_href, loading, done,
} from '../utils/utils'

import { buildBatchMenu } from '../utils/menu'
import Form from 'react-bootstrap/Form'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 500
});

const limiter_data = new Bottleneck({
  maxConcurrent: 1,
  minTime: 2000
});

const delay = ms => new Promise(res => setTimeout(res, ms));

const query_minted = `
query qryNftBiker($address: String = "") {
  token(where: {creator_id: {_eq: $address}, supply: {_gt: 0}}, order_by: {id: desc}) {
    id
    title
    supply
    artifact_uri
    display_uri
    metadata
    timestamp
  }
}
`

const query_collected = `
query qryNftBiker($address: String = "") {
  token(where: {supply: {_gt: 0}, token_holders: {holder_id: {_eq: $address}, quantity: {_gt: 0}}}, order_by: {id: desc}) {
    id
    title
    supply
    artifact_uri
    display_uri
    metadata
    timestamp
  }
}
`

const query_swapped = `
query qryNftBiker($address: String = "") {
  ask(where: { creator_id: {_eq: $address }, artist_id: { _neq: $address }, status: { _eq: "active" }, amount_left: {_gt: 0} }, order_by: { timestamp: desc }) {
    token_id
  }
}
`

const query_tokens = `
query qryNftBiker($tokens: [bigint!]) {
  token(where: {pk_id: { _in: $tokens }}) {
    id
    title
    supply
    artifact_uri
    display_uri
    metadata
    timestamp
  }
}
`
var pin_thumb = false
var pins = null
var pause_jobs = false
var jobs = null

const changePinThumb = () => {
  pin_thumb = document.getElementById("pin_thumb").checked
  pin_thumb ? urlParams.set("pin_thumb", 1) : urlParams.delete("pin_thumb");
  update_current_href();
}

async function pinToPinata(ipfs_path, name) {
  let api_key = pinata_key()
  let api_secret = pinata_secret()

  const url = 'https://api.pinata.cloud/pinning/pinByHash';
  const body = {
    hashToPin: ipfs_path.replace('ipfs://', ''),
    pinataMetadata: {
      name: name
    }
  }

  return axios
    .post(url, body, {
      headers: {
        pinata_api_key: api_key,
        pinata_secret_api_key: api_secret
      }
    })
    .then(function (response) {
      return { result: response.data }
    })
    .catch(function (error) {
      if (error.response) {
        console.error(error.response)
        if (error.response.status == 500) pause_jobs = true
      } else if (error.request) {
        return { error: { message: 'no response from server' } }
      } else {
        // Something happened in setting up the request and triggered an Error
        console.error(error.message)
      }
      return { error: error }
    });
}

async function pinata_request(url) {
  let api_key = pinata_key()
  let api_secret = pinata_secret()

  return axios
    .get(url, {
      headers: {
        pinata_api_key: api_key,
        pinata_secret_api_key: api_secret
      }
    })
    .then(function (response) {
      return { rows: response.data.rows }
    })
    .catch(function (error) {
      console.error(error)
      return { error: error }
    });
}

async function getLastPins(page) {
  const page_limit = 1000
  if (empty(page)) page = 0
  else page = parseInt(page)

  let url = `https://api.pinata.cloud/data/pinList?status=pinned&pageLimit=${page_limit}`;
  if (page > 0) url += `offset=${page * page_limit}`

  let data = await limiter_data.schedule(() => pinata_request(url))
  if (empty(data.rows)) return { pins: [] }

  let results = { pins: data.rows }
  if (results.pins.length < page_limit) return results

  let others = getLastPins(page + 1)
  if (others.rows) results.pins = results.pins.concat(others.rows)
  if (others.error) results.error = others.error
  return results
}

async function getJobs() {
  let url = "https://api.pinata.cloud/pinning/pinJobs?limit=1000"
  let results = await limiter_data.schedule(() => pinata_request(url))
  return (results.rows || [])
}

async function getMintedTokens(wallet) {
  let { errors, data } = await fetchGraphQL(query_minted, "qryNftBiker", { "address": wallet });
  if (errors) {
    showError(errors)
    return false
  }
  return data.token;
}

async function getCollectedTokens(wallet) {
  let { errors, data } = await fetchGraphQL(query_collected, "qryNftBiker", { "address": wallet });
  if (errors) {
    showError(errors)
    return false
  }
  return data.token;
}

async function getSwappedTokens(wallet) {
  let { errors, data } = await fetchGraphQL(query_swapped, "qryNftBiker", { "address": wallet });
  if (errors) {
    showError(errors)
    return false
  }
  let list = []
  list = data.swap.reduce((pV, cV) => [...pV, cV.token_id], list);
  list = data.ask.reduce((pV, cV) => [...pV, cV.token_id], list);
  if (empty(list)) return []

  data = await fetchGraphQL(query_tokens, "qryNftBiker", { "tokens": list });
  if (data.errors) {
    showError(errors)
    return false
  }
  return data.data.token
}

function verifyInputs(wallet) {
  if (empty(wallet)) {
    showError({ message: 'You must provide a wallet' }, { raw: true })
    return false
  }
  if (empty(pinata_key(true))) {
    showError({ message: 'You must provide your pinata API Key' }, { raw: true })
    return false
  }
  if (empty(pinata_secret(true))) {
    showError({ message: 'You must provide your pinata API secret' }, { raw: true })
    return false
  }
  return true
}

async function retrievePinned() {
  loading()
  if (!empty(pins)) return true
  let data = await getLastPins()
  if (data.error) {
    pins = []
    showError({ message: 'Unable to retrieve pinned content from your account. It can be because of a network error, or because you are overquota (if so, add a credit card to your account and generate a new API key) - ' + data.error.status }, { raw: true })
    return false
  }
  pins = data.pins
  console.log(`${pins.length} artworks already pinned`)

  jobs = await getJobs()
  if (empty(jobs)) jobs = []
  console.log(`${jobs.length} artworks jobs in queue`)

  return true
}

async function doPin(title, name, url) {
  let ipfs_hash = null
  let pin = null
  let job = null
  let data = null

  ipfs_hash = url.replace('ipfs://', '')
  pin = pins.find(p => p.ipfs_pin_hash == ipfs_hash)
  job = jobs.find(p => p.ipfs_pin_hash == ipfs_hash)
  if (pin) return `${title} pinned (${formattedDate(new Date(pin.date_pinned), 'date')})`
  else if (job) return `${title} in queue (${job.status})`
  else {
    data = await limiter.schedule(() => pinToPinata(ipfs_hash, name))
    if (data.error) return `${title} error (${data.error.message})`
    else return `${title} sent (${data.result.status})`
  }
}

async function pinToken(token, pinned) {
  let div = document.createElement("div")
  let txt = `#${token.id} - ${token.title}`
  let infos = []
  let result = null

  infos.push(await doPin('artwork', `Minted #${token.id}`, token.artifact_uri))
  infos.push(await doPin('metas', `Metas #${token.id}`, token.metadata))
  if (pin_thumb) infos.push(await doPin('thumbnail', `Thumbnail #${token.id}`, token.display_uri))

  ReactDOM.render(<>
    {txt} - {infos.join(' - ')}
  </>, div)
  pinned.append(div)
  if (pause_jobs) {
    // there was an error we wait
    div = document.createElement("p")
    div.innerHTML = 'Error - cooling down and will continue automatically in 5 minutes. Exit/Reload the page to abort.'
    pinned.append(div)
    await delay(300000);
    // redo it
    pause_jobs = false
    pinToken(token, pinned)
  }
}

async function pinCollected(skip_reset) {
  let pinned = document.getElementById("pin_results")
  if (skip_reset) pinned.innerHTML = '<br/>'
  else pinned.innerHTML = ''
  let wallet = get_wallet(true)
  if (!verifyInputs(wallet)) return

  let ok = await retrievePinned()
  if (!ok) return

  let tokens = await getCollectedTokens(wallet)
  done()
  pinned.innerHTML += `<b>Start pinning collected artworks: ${tokens.length} tokens found</b><br/>`
  if (empty(tokens)) {
    let txt = document.createElement("p")
    txt.innerHTML = "We can't find any artwork collected by this wallet"
    pinned.append(txt)
    return
  }
  for (let token of tokens) await pinToken(token, pinned)

  let txt = document.createElement("p")
  txt.innerHTML = "<b>Pinning done</b>"
  pinned.append(txt)
}

async function pinSwapped(skip_reset) {
  let pinned = document.getElementById("pin_results")
  if (skip_reset) pinned.innerHTML = '<br/>'
  else pinned.innerHTML = ''
  let wallet = get_wallet(true)
  if (!verifyInputs(wallet)) return

  let ok = await retrievePinned()
  if (!ok) return

  let tokens = await getSwappedTokens(wallet)
  done()
  pinned.innerHTML += `<b>Start pinning swapped artworks : ${tokens.length} tokens found</b><br/>`
  if (empty(tokens)) {
    let txt = document.createElement("p")
    txt.innerHTML = "We can't find any artwork swapped by this wallet"
    pinned.append(txt)
    return
  }
  for (let token of tokens) await pinToken(token, pinned)

  let txt = document.createElement("p")
  txt.innerHTML = "<b>Pinning done</b>"
  pinned.append(txt)
}

async function pinMinted(skip_reset) {
  let pinned = document.getElementById("pin_results")
  if (skip_reset) pinned.innerHTML = '<br/>'
  else pinned.innerHTML = ''
  let wallet = get_wallet(true)
  if (!verifyInputs(wallet)) return false

  let ok = await retrievePinned()
  if (!ok) return

  let tokens = await getMintedTokens(wallet)
  done()
  pinned.innerHTML = `<b>Start pinning minted artworks : ${tokens.length} tokens found</b><br/>`
  if (empty(tokens)) {
    let txt = document.createElement("p")
    txt.innerHTML = "We can't find any artwork minted by this wallet"
    pinned.append(txt)
    return true
  }

  for (let token of tokens) await pinToken(token, pinned)

  let txt = document.createElement("p")
  txt.innerHTML = "<b>Pinning done</b>"
  pinned.append(txt)
  return true
}

async function pinAll() {
  let ok = await pinMinted(true)
  if (!ok) return
  await pinCollected(true)
  await pinSwapped(true)
}

function set_api_info(key, save) {
  let input = document.getElementById(key)
  let val = input ? input.value : null
  if (empty(val)) val = localStorage.getItem(key)
  if (!empty(val)) {
    document.getElementById(key).value = val
    if (save) localStorage.setItem(key, val)
  }
  return val
}

function pinata_key(save) {
  return set_api_info("pinata_key", save)
}
function pinata_secret(save) {
  return set_api_info("pinata_secret", save)
}

export default function Pin() {
  useEffect(() => {
    buildBatchMenu()
    pinata_key(true)
    pinata_secret(true)

    if (!empty(urlParams.get("pin_thumb"))) {
      pin_thumb = true
      document.getElementById('pin_thumb').checked = true
    }

  }, []);
  return (
    <>
      <Head>
        <title>Pin artworks - TEZOS NFTs</title>
      </Head>
      <div id="input">
        <h2>Pin artworks from a wallet</h2>
        <p>
          This tool allow you to pin the creations or the collected artworks from a wallet to <a href="https://pinata.cloud" target="_blank">Pinata</a>. You can register for a free account, and you need to <a href="https://app.pinata.cloud/keys" target="_blank">generate an api key</a> with the following api endpoint access activated:
        </p>
        <ul>
          <li>Pinning : pinByHash, pinJobs, unpin</li>
          <li>Data : pinList, userPinnedDataTotal</li>
          <li>Key name : whatever helps you to remember that the api key is for use on this pin tool</li>
        </ul>
        <p>You can use this tool as many time as you wish, only unpinned artworks will be added. The tool always pin the artwork and the metadata associated. You can also ask to pin the thumbnail associated with your artwork to speed up showing your artwork in listing pages.</p>
        <p><b>IMPORTANT: if you are going to pin a lot of artworks, make sure to first add a credit card in your pinata account, otherwise, pinning will fail with error 403 if you go above your free quota of 1Gb of storage</b></p>

        <WalletField monitoring={{ noop: true }} />

        <Row>
          <Col xs="12" md="6" className='mb-1'>
            <label htmlFor="pinata_key" style={{ fontSize: '1.2em' }}>Pinata API Key</label><br />
            <input id='pinata_key' name='pinata_key' style={{
              fontSize: '1.2em',
              width: '100%'
            }}></input>
          </Col>
          <Col xs="12" md="6" className='mb-1'>
            <label htmlFor="pinata_secret" style={{ fontSize: '1.2em' }}>Pinata API Secret</label><br />
            <input id='pinata_secret' name='pinata_secret' style={{
              fontSize: '1.2em',
              width: '100%'
            }}></input>
          </Col>
        </Row>
        <Row>
          <Col xs="12" className='mb-1'>
            <Form.Check
              inline
              type="switch"
              id="pin_thumb"
              label="Pin thumbnails (it may speed up pages showing list of artworks)"
              className="secondary"
              onChange={changePinThumb}
            />
          </Col>
        </Row>
        <Row>
          <Col xs="12">
            <div className='multi-btn block'>
              <a href="#" onClick={pinMinted} className='btn btn-secondary'>PIN CREATIONS</a>
              <a href="#" onClick={pinCollected} className='btn btn-secondary'>PIN COLLECTED</a>
              <a href="#" onClick={pinSwapped} className='btn btn-secondary'>PIN SWAPPED</a>
              <a href="#" onClick={pinAll} className='btn btn-secondary'>PIN ALL</a>
            </div>
            <p>For your collection you can pin either what you have COLLECTED but not swapped (ie what you hold in your wallet) or what you SWAPPED (ie what you are resaling).</p>
          </Col>
        </Row>
      </div>
      <div id="pin_results"></div>
    </>
  )
}