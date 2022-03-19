import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import Head from 'next/head'
import { empty, urlParams, getAddresses } from '../utils/utils'
import { buildMenu } from '../utils/menu'
import * as AppConst from '../utils/constants'
import Form from 'react-bootstrap/Form'
import { Home } from '../components/home'

const changeLinkTo = (evt) => {
  let val = evt.target.value
  if (empty(val)) localStorage.removeItem("hen_link")
  else if (AppConst.ALLOWED_CLONE.includes(val)) localStorage.setItem("hen_link", val)
  else localStorage.removeItem("hen_link")
}

const changeRpcNode = (evt) => {
  let val = evt.target.value
  if (val == 'custom') val = document.getElementById("custom_node").value

  if (empty(val)) localStorage.removeItem("rpc_node")
  else localStorage.setItem("rpc_node", val)
}

export default function Settings() {
  const [saveMessage, setSaveMessage] = useState(false)
  const [henClone, setHenClone] = useState(AppConst.DEFAULT_CLONE)
  const [rpcNode, setRpcNode] = useState(false)
  const [rpcCustomNode, setRpcCustomNode] = useState(false)

  const updateWallets = async (evt) => {
    if (evt) evt.preventDefault()
    let wallets = await getAddresses(document.getElementById("owned_wallets")?.value)
    if (empty(wallets)) localStorage.removeItem("owned_wallets")
    else localStorage.setItem("owned_wallets", wallets)
    document.getElementById("owned_wallets").value = getOwnedWallets()
    setSaveMessage("wallets list updated")
  }

  const getOwnedWallets = () => {
    try {
      let data = localStorage.getItem("owned_wallets")
      if (!empty(data)) data = String(data).split(/[\r\n,]+/).join("\n")
      return data
    }
    catch (e) {
      return ''
    }
  }

  useEffect(() => {
    let current = typeof (localStorage) != undefined && localStorage.getItem("hen_link")
    if (empty(current)) current = AppConst.DEFAULT_CLONE
    setHenClone(current)

    setRpcNode(localStorage.getItem("rpc_node"))

    setRpcCustomNode(String(localStorage.getItem("rpc_node")).match(/^https?:/i) ? true : false)
  }, []);


  let nodes = AppConst.RPC_NODES
  return (
    <>
      <Head>
        <title>Tools settings</title>
      </Head>

      <div id="input">
        <Home title="Tools settings" />

        <div className="block" onChange={event => changeLinkTo(event)}>
          <h4>Platform to use for tokens and artists pages :</h4>
          <div className="btn-group" role="group" onChange={event => changeLinkTo(event)}>
            <input id="link_to_default" className="btn-check" type="radio" name="link_to" value="" defaultChecked={empty(henClone)}></input>
            <label className="btn btn-outline-secondary" htmlFor="link_to_default">Default</label>

            <input id="link_to_teia" className="btn-check" type="radio" name="link_to" value="teia" defaultChecked={henClone == 'teia'}></input>
            <label className="btn btn-outline-secondary" htmlFor="link_to_teia">teia.art</label>

            <input id="link_to_bid" className="btn-check" type="radio" name="link_to" value="bid" defaultChecked={henClone == 'bid'}></input>
            <label className="btn btn-outline-secondary" htmlFor="link_to_bid">objkt.com</label>

            <input id="link_to_art" className="btn-check" type="radio" name="link_to" value="art" defaultChecked={henClone == 'art'}></input>
            <label className="btn btn-outline-secondary" htmlFor="link_to_art">hicetnunc.art</label>

            <input id="link_to_hen" className="btn-check" type="radio" name="link_to" value="hen" defaultChecked={henClone == 'hen'}></input>
            <label className="btn btn-outline-secondary" htmlFor="link_to_hen">hicetnunc.xyz</label>
          </div>
        </div>

        <div className="block" onChange={event => changeRpcNode(event)}>
          <h4>RPC Node to use</h4>
          <Form.Check
            type="radio"
            name="rpc_node"
            value=""
            id="rpc_node_default"
            defaultChecked={empty(rpcNode)}
            label={`Default (${AppConst.DEFAULT_RPC_NODE})`}
          />
          {Object.keys(nodes).map((key, index) => {
            let url = nodes[key]
            let checked = rpcNode == key
            return (
              <div key={index}>
                <Form.Check
                  type="radio"
                  name="rpc_node"
                  value={key}
                  id={`rpc_node_${key.replace(/\s+/, '_')}`}
                  defaultChecked={checked}
                  label={`${key} (${url})`}
                />
              </div>
            )
          })
          }
          <div>
            <Form.Check
              type="radio"
              inline="true"
            >
              <Form.Check.Input
                type="radio"
                name="rpc_node"
                value="custom"
                className="inline"
                defaultChecked={rpcCustomNode ? true : false}
              />

              <Form.Control
                type="text"
                className="inline"
                id="custom_node"
                placeholder="Custom node rpc url"
                defaultValue={rpcCustomNode ? rpcNode : ''}
                size="sm"
                style={{ width: '300px' }}
              />
            </Form.Check>

          </div>
        </div>

        <div className="block">
          <h4>Your wallets</h4>
          <p>If you own multiple wallets, you can set them here, and it will be used to show you what NFT you own when you check a gallery, an event, a search, ...</p>
          <textarea id="owned_wallets"
            style={{ display: 'block', width: '100%', height: '50px', margin: '10px 0px' }}
            defaultValue={getOwnedWallets()}
          ></textarea>
          <a href="#" className='btn btn-secondary' onClick={updateWallets}>SAVE WALLETS</a>
        </div>
        <div className="block">
          {saveMessage && (
            <>
              <b>{saveMessage}</b><br clear="all" />
            </>
          )}
        </div>
      </div>
    </>
  )
}