import ReactDOM from 'react-dom'
import * as Wallet from './wallet'
import { empty } from './utils'
import axios from 'axios'

function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

function writeMessage(msg, style) {
  document.querySelectorAll("#tx_infos .blink").forEach(e => e.remove())
  let div = document.getElementById("tx_infos")
  if (div) {
    let content = document.createElement('span')
    ReactDOM.render(
      <span dangerouslySetInnerHTML={{ __html: msg }} />
      , content)
    div.append(content)
    if (!empty(style)) div.classList.add(style)
  }
}

function removeInfo(evt) {
  if (evt) evt.preventDefault()
  let div = document.getElementById("tx_infos")
  if (div) div.remove()
}

async function getTransactionStatus(hash) {
  let url = `https://api.tzkt.io/v1/operations/${hash}`
  let response = await axios.get(url)
  let status = 'unknown'
  if (!empty(response.data)) {
    status = response.data.find(e => e['status'] != 'applied')
    if (empty(status)) status = 'applied'
  }
  return status
}

function statusMessage(status, method) {
  if (status === "applied") {
    writeMessage('... SUCCESS ...', 'success')
    return true
  } else {
    writeMessage(`!!! ERROR : ${status} !!! VERIFY with above link !!!`, 'error')
    return false
  }
}

export async function processTransaction(method, data, options) {
  if (empty(options)) options = { skip_scroll: false, buylog: null }
  if (empty(options.retried)) options.retried = false
  Wallet.initWallet()
  console.log(`Sending ${method} to wallet via ${Wallet.Tezos?._rpc}`)
  let div = document.getElementById("tx_infos")
  if (!empty(div)) div.remove()

  div = document.createElement("div")
  div.id = 'tx_infos'
  ReactDOM.render(
    <>
      <a href="#" onClick={e => removeInfo(e)} className='right'>Close</a>
      Sending transaction to your wallet.<br />
      <span className='blink' >... Waiting for your confirmation ...<br /></span>
    </>
    , div
  )
  if (document.getElementById("purchase")) document.getElementById("purchase").insertAdjacentElement("afterend", div)
  else if (document.getElementById("trx_container")) document.getElementById("trx_container").insertAdjacentElement("beforeend", div)
  else document.getElementById("loading").insertAdjacentElement("afterend", div)

  if (!options.skip_scroll) window.scrollTo(0, 0);
  let batchOp = await Wallet[method](data)
  if (!batchOp) {
    writeMessage("Operation cancelled<br/>", 'error')
    return false;
  }
  else if (!empty(batchOp.message) && empty(batchOp.opHash)) {
    if (!options.retried && !batchOp.message.match(/(abort|parameter.*invalid)/i)) {
      console.error('retrying transaction because of an error', batchOp.message)
      await sleep(2500) // wait a little before retrying
      options.retried = true
      return await processTransaction(method, data, options)
    }
    else {
      console.error('transaction failed', batchOp.message)
      writeMessage(`${batchOp.message}<br/>`, 'error')
      return false;
    }
  }
  let tx_link = empty(batchOp.opHash) ? '' : `Transaction infos : <a href="https://tzkt.io/${batchOp.opHash}" target="_blank">${batchOp.opHash}</a><br/>`
  if (typeof (options.buylog) != 'undefined' && options.buylog != null) {
    options.buylog(`Transaction infos: ${batchOp.opHash}`)
  }
  writeMessage(`Transaction sent to the blockchain.<br/>${tx_link}<span class='blink'>Stand by ... Waiting for transaction status ...<br/></span>`)

  try {
    let result = await batchOp.confirmation();
    console.debug(`${method} result`, result)
    if (result.completed) {
      let op_status = await batchOp.status()
      console.log(`${method} status`, op_status)
      return statusMessage(op_status, method)
    }
    else {
      writeMessage(`!!! Transaction failed, double check with above link !!!<br/>${result.message}`, 'error')
      return false
    }
  }
  catch (e) {
    console.error("error while waiting for confirmation")
    console.error(e)
    let status = await getTransactionStatus(batchOp.opHash)
    if (status != 'unknown') statusMessage(status, method)
    else writeMessage(`!!! Unable to get transaction status, VERIFY with above link !!!<br/>${e.message}`, 'warning')
    return false
  }
}
