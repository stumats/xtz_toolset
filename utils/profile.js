import React, { useEffect } from 'react';
import ReactDOM from 'react-dom'
import $ from 'jquery'

import {
  empty, loading, done, fetchGraphQL, showError, urlParams, update_current_href,
  formattedDate, loadArtists, Artists,
} from './utils'
import { flex_link, gallery_link } from '../utils/links'

import { getBannedWallets } from '../utils/banned'

const profile_fields = `
  address
  description
  hdao_balance
  name
  metadata
  metadata_file
  tokens_aggregate(where: { supply: { _gt: 0 } }) {
    aggregate {
      count
      max {
        timestamp
      }
    }
  }
  sales_aggregate {
    aggregate {
      count
      max {
        timestamp
      }
    }
  }
  holders_token_aggregate {
    aggregate {
      count(columns: token_id, distinct: true)
    }
  }
  asks_aggregate(where: {status: {_eq: "active"}}) {
    aggregate {
      count(columns: objkt_id, distinct: true)
    }
  }
  purchases_aggregate {
    aggregate {
      max {
        timestamp
      }
    }
  }
`

const query_profiles = `
query qryNftBiker($search: String = "", $limit: Int) {
  names:holder(where: { name: { _ilike: $search } }, limit: $limit) {
    ${profile_fields}
  }
  descriptions:holder(where: { description: { _ilike: $search } }, limit: $limit) {
    ${profile_fields}
  }
}
`

const query_followed = `
query qryNftBiker($list: [String!]) {
  holder(where: { address: { _in: $list }}) {
    ${profile_fields}
  }
}
`

var profiles = {}

export async function profileMonitoring(redirection) {
  if (empty(redirection)) redirection = false
  $(document).on("change", "#search", function () {
    let term = $(this).val()
    if (!empty(term)) {
      if (redirection) window.location.href = '/search/artist?search=' + term
      else {
        let div = document.getElementById("wallet")
        if (div) div.value = ''
        urlParams.delete('wallet')
        urlParams.set("search", term)
        update_current_href();
        searchProfiles({ search: term })
      }
    }
  })
  let val = urlParams.get("search")
  if (empty(val)) return
  if (redirection) window.location.href = '/search/artist?search=' + val
  else $("#search").val(val).trigger('change')
}

export async function searchProfiles(options) {
  loading(true);
  let search = []
  if (!empty(options.search)) for (let term of options.search.split(/[,;\.\s]+/im)) {
    if (!empty(term) && term.length >= 3) search.push(term)
  }
  if (empty(search)) {
    done()
    $("#result").html(`<b>You must use words of at least 3 characters</>`);
    return;
  }

  let params = { "limit": options.limit || 1000, "search": `%${search.join('%')}%` }
  const { errors, data } = await fetchGraphQL(query_profiles, "qryNftBiker", params);
  if (errors) return showError(errors);
  profiles = {}
  retrieve_profiles(data.names, options)
  retrieve_profiles(data.descriptions, options)
  await searchSavedArtists(search.join('.*'))
  profiles = Object.values(profiles).sort(function (a, b) { return b.sales - a.sales })
  let bannedWallets = await getBannedWallets()
  let div = $("<div></div>")
  ReactDOM.render(<>
    <p>
      <b>Total artists found : {profiles.length}</b>
    </p>
    <table id='profiles'>
      <thead>
        <tr>
          <th rowSpan='2'>Name</th>
          <th colSpan='2' style={{ textAlign: 'center' }}>Minted</th>
          <th colSpan='2' style={{ textAlign: 'center' }}>Collected</th>
          <th colSpan='2' style={{ textAlign: 'center' }}>Sales</th>
          <th rowSpan='2'>Description</th>
          <th rowSpan='2'>Wallet</th>
          <th rowSpan='2'>Warning</th>
        </tr>
        <tr>
          <th style={{ textAlign: 'right' }}>Count</th>
          <th style={{ textAlign: 'center' }}>Last</th>
          <th style={{ textAlign: 'right' }}>Count</th>
          <th style={{ textAlign: 'center' }}>Last</th>
          <th style={{ textAlign: 'right' }}>Count</th>
          <th style={{ textAlign: 'center' }}>Last</th>
        </tr>
      </thead>
      <tbody>
        {profiles.map((profile, idx) => {
          if (profile.last_mint) profile.last_mint = new Date(profile.last_mint)
          if (profile.last_sale) profile.last_sale = new Date(profile.last_sale)
          if (profile.last_collected) profile.last_collected = new Date(profile.last_collected)
          let banned = bannedWallets.includes(profile.address) ? true : false
          return (
            <tr key={idx}>
              <td>{gallery_link({ address: profile.address, name: profile.name.slice(0, 40) })}</td>
              <td className='right'>{profile.tokens}</td>
              <td className='right'>{formattedDate(profile.last_mint)}</td>
              <td className='right'>{profile.collected}</td>
              <td className='right'>{formattedDate(profile.last_collected)}</td>
              <td className='right'>{profile.sales}</td>
              <td className='right'>{formattedDate(profile.last_sale)}</td>
              <td>{String(profile.description).slice(0, 250)}</td>
              <td>{flex_link({ address: profile.address, name: profile.addres })}</td>
              <td className={banned ? 'error' : null}>{banned ? 'Banned' : '--'}</td>
            </tr>
          )
        })}
      </tbody>
    </table >

    <p id="help"><b>Help</b></p>
    <ul>
      <li>Minted : number of NFTs created</li>
      <li>Sales : number of sales (primary or secondary) made</li>
    </ul>

  </>, div[0])
  $("#result").html(div.html());
  done();
}

function retrieve_profiles(list, options) {
  for (let profile of list) {
    if (profiles[profile.address]) continue; // already found
    let val = Artists.get(profile.address)
    if (!empty(val) && (empty(profile.name) || options.force_name)) profile.name = val

    profile.tokens = profile.tokens_aggregate.aggregate.count || 0
    profile.last_mint = profile.tokens_aggregate.aggregate.max.timestamp || null
    profile.sales = profile.sales_aggregate.aggregate.count || 0
    profile.last_sale = profile.sales_aggregate.aggregate.max.timestamp || null
    profile.collected = (profile.asks_aggregate.aggregate.count || 0) + (profile.holders_token_aggregate.aggregate.count || 0)
    profile.last_collected = (profile.purchases_aggregate.aggregate.max.timestamp || '')

    if (empty(profile.last_collected)) profile.last_collected = null
    profiles[profile.address] = profile
  }
}

async function searchSavedArtists(term) {
  await loadArtists({ storage_only: true })
  let search = new RegExp(term, 'gi')
  let list = []
  for (let key of Artists.getWallets()) {
    if (profiles[key]) continue
    let name = Artists.get(key)
    if (name.match(search)) list.push(key)
  }
  const { errors, data } = await fetchGraphQL(query_followed, "qryNftBiker", { "list": list })
  retrieve_profiles(data.holder, { force_name: true })
}
