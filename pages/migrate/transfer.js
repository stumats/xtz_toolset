import React, { Component } from 'react'
import Script from 'next/script'
import Head from 'next/head'
import { TagCloud } from '../../components/tag_cloud'
import { WalletField } from '../../components/wallet_field'
import {
  empty, done, loading, Artists, fa2_to_platform, platform_name,
  loadArtists, fetchGraphQL, showError, get_wallet, urlParams, update_current_href,
} from '../../utils/utils'
import { nft_link, gallery_link, history_link } from '../../utils/links'
import { SendTokens } from '../../utils/migrate'
import { buildBatchMenu } from '../../utils/menu';
import { Result } from '../../components/result'
import Form from 'react-bootstrap/Form'
import Button from 'react-bootstrap/Button'

const query_owned = `
query qryNftBiker($address: String!) {
  token(where: {token_holders: {holder_id: {_eq: $address}, quantity: {_gt: 0}}}, order_by: {id: desc}) {
    id
    uuid
    fa2_id
    title
    supply
    creator {
      name
      address
    }
    token_holders(where: {holder_id: {_eq: $address}}) {
      quantity
    }
    token_tags {
      tag {
        name
      }
    }
  }
}
`

// select when clicking on td cell
const selectCheckbox = (evt, token_id) => {
  if (evt.target?.nodeName == 'TD') {
    evt.preventDefault()
    let chk = document.getElementById(`migrate_${token_id}`)
    chk.checked = !chk.checked
  }
}

async function retrieveUnswapped(wallet) {
  const { errors, data } = await fetchGraphQL(query_owned, "qryNftBiker", { "address": wallet })
  if (errors) {
    showError(errors);
    return []
  }
  let results = data.token
  results.map((token) => {
    token.tags = token.token_tags.map(t => t.tag.name.replace(/^#+/, '').toLowerCase())
    delete (token.token_tags)
  })
  return [...new Set(results)]
}

const TokenRow = ({ token }) => {
  if (empty(token)) return;
  let creator = token.creator
  if (empty(creator.name)) creator.name = Artists.get(creator.address)

  let checkbox_id = `migrate_${token.id}`
  let quantity = (token.token_holders[0] || {}).quantity

  let wallet_sort = (empty(creator.name) ? `xxx_${creator.address}` : `name_${creator.name}`).toLowerCase()

  return (
    <tr data-id={token.id}>
      <td sorttable_customkey={token.id}>{nft_link(token.uuid)}</td>
      <td>{token.title.slice(0, 40)}</td>
      <td sorttable_customkey={wallet_sort}>{gallery_link(token.creator)}</td>
      <td className="right">{platform_name(fa2_to_platform(token.uuid))}</td>
      <td className="right">{token.supply}</td>
      <td className="right" sorttable_customkey={quantity}>{quantity}x</td>
      <td>{history_link(token.uuid)}</td>
      <td onClick={e => selectCheckbox(e, token.id)}>
        <input type="checkbox"
          name={checkbox_id}
          id={checkbox_id}
          data-token-id={token.uuid}
          data-quantity={quantity}
          className='migrate' >
        </input>
      </td>
    </tr>
  )
}

class Transfer extends Component {
  state = {
    tags: [],
    tokens: []
  }

  getTagList = (tokens) => {
    let list = {}
    for (let token of tokens) {
      token.tags.map(tag => {
        if (empty(list[tag])) list[tag] = 1
        else list[tag] += 1
      })
    }
    return list
  }

  selectAllTokens = (e) => {
    let new_value = document.getElementById("check_all").checked
    let nb = 0
    for (let e of document.querySelectorAll("input[type='checkbox']")) {
      if (e.id != 'check_all') {
        e.checked = new_value
        nb += 1
        if (new_value && nb >= 500) return
      }
    }
  }

  filterTokens = () => {
    if (empty(this.state.tokens)) return []
    if (empty(this.state.tags)) return this.state.tokens

    let tags = [...this.state.tags]
    let results = [...this.state.tokens].filter(function (token) {
      for (let name of tags) {
        if (!token.tags.includes(name)) return false
      }
      return true
    })
    return results
  }

  fetchTokens = async () => {
    let wallet = get_wallet()
    if (empty(wallet)) {
      this.setState({ tokens: [] })
      return;
    }

    loading(true)
    await loadArtists({ storage_only: true })
    let tokens = await retrieveUnswapped(wallet)
    let tags = (urlParams.get("tags") || '').split(/[\s,;]+/).filter(t => !empty(t)).map(t => t.replace(/^#+/, '').toLowerCase())
    this.setState({ tokens: tokens, tags: tags })
    done()
  }

  setTag = (tags) => {
    let list = (tags || '').split(/[\s,;]+/).filter(t => !empty(t)).map(t => t.replace(/^#+/, '').toLowerCase())
    this.setState({ tags: list })
    if (!empty(list)) {
      urlParams.set("tags", list.join(','))
      document.getElementById("tags").value = list.join(',')
    }
    else {
      urlParams.delete('tags')
      document.getElementById("tags").value = ''
    }
    update_current_href()
  }

  changeTag = (evt) => {
    if (evt && (evt.key === 'Enter' || evt._reactName == 'onBlur')) {
      let tags = document.getElementById("tags").value
      this.setTag(tags)
    }
  }

  addTag = (tag) => {
    let tags = document.getElementById("tags").value || ''
    tags += ', ' + tag
    this.setTag(tags)
  }

  showTokens = async () => {
    this.fetchTokens().then(() => {
      var tbl = document.getElementById("tokens")
      if (tbl) sorttable.makeSortable(tbl)
      done()
    })
  }

  componentDidMount = async () => {
    buildBatchMenu()
  }

  render() {
    let tokens = this.filterTokens()
    return (
      <>
        <div id="input" className="block">
          <Head>
            <title>Transfer NFTS - TEZOS NFTs</title>
          </Head>
          <Script src="/js/sorttable.js" />
          <h2>Transfer selected NFT to another wallet</h2>
          <p>
            This tool allow you to select tokens among your unswapped tokens (HEN, OBJKT minted tokens), and transfer them to another wallet.<br />
            For each selected token, it will transfer ALL editions to the new wallet.<br />
            <b>WARNING : </b> make sure to move less than 500 objkts at once, or the transfer could fail.
          </p>

          <WalletField monitoring={{ method: this.showTokens, batch_menu: true }} width="80%" />
        </div>

        <Result>
          {this.state.tokens.length > 0 && (
            <>
              <div className='block inline'>
                <Form.Label>Transfer to</Form.Label>
                <Form.Control
                  id="send_to"
                  name="send_to"
                  type='text'
                  placeholder='tz... or wallet.tez or HEN Username'
                  style={{ width: '300px' }}
                >
                </Form.Control>
                <a href="#" className='btn btn-secondary' onClick={e => SendTokens(e)}>Send</a>
              </div>

              <div className='block inline'>
                <Form.Label>Tags</Form.Label>
                <Form.Control
                  id="tags"
                  name="tags"
                  type='text'
                  placeholder='tag1, tag2, ... tagN'
                  defaultValue={this.state.tags.join(',')}
                  onBlur={e => this.changeTag(e)}
                  onKeyPress={e => this.changeTag(e)}
                  style={{ width: '300px' }}
                >
                </Form.Control>
              </div>

              <TagCloud tags={this.getTagList(tokens)} exclude_tags={this.state.tags} selectTag={this.addTag} />

              <table id="tokens" className='sortable'>
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Title</th>
                    <th>Creator</th>
                    <th>Platform</th>
                    <th className='right'>Supply</th>
                    <th className='right'>Qty</th>
                    <th className='sorttable_nosort'>History</th>
                    <th className='sorttable_nosort'>
                      <input type="checkbox" id="check_all" onClick={e => this.selectAllTokens(e)}></input>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token, index) => {
                    return (<TokenRow key={index} token={token} />)
                  })}
                </tbody>
              </table>
            </>
          )}
        </Result>
      </>
    )
  }
}

export default Transfer
Transfer.layout = 'skip_result'