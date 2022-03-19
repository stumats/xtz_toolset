import React from 'react'
import ReactDOM from 'react-dom'
import { empty, urlParams, add_timeago } from './utils'
import { connectedWalletAddress } from './wallet'
import { MenuBar } from '../components/menu_bar'

import Router from 'next/router';
import { RouterContext } from "next/dist/shared/lib/router-context"

function render_menu(wallet, links) {
  let div = document.getElementById("menu_container")
  if (!div) {
    div = document.createElement("div")
    div.id = 'menu_container'
    document.getElementById('wrapper').insertAdjacentElement('afterbegin', div)
  }
  ReactDOM.render(
    <RouterContext.Provider value={Router}>
      <MenuBar menu={links} wallet={wallet} />
    </RouterContext.Provider>
    , div)
}

export async function buildBatchMenu() {
  let links = []
  links.push({ title: 'Giveway', href: '/giveaway', icon: 'gift' })
  links.push({ title: 'Migrate', href: '/migrate', icon: 'paper-plane' })
  links.push({ title: 'Transfer', href: '/migrate/transfer', icon: 'share' })
  return render_menu('', links)
}

export async function buildStatMenu() {
  let links = []
  links.push({ title: 'Top sales', href: '/stats/topsales', icon: 'medal' })
  links.push({ title: 'Sales volume', href: '/stats', icon: 'chart-line' })
  links.push({ title: 'Marketplaces stats', href: '/stats/marketplace', icon: 'coins' })
  return render_menu('', links)
}

export async function buildMenu(wallet, absolute_time) {
  let hide = urlParams.get("hide");
  if (empty(hide) || hide != '1') {
    let connected = await connectedWalletAddress()
    let links = []
    if (empty(wallet)) wallet = '';
    links.push({ title: 'Gallery', href: '/onsale', icon: 'palette' })
    links.push({ title: 'Artist', href: '/artist', icon: 'chart-bar' })
    links.push({ title: 'Collector', href: '/collector', icon: 'chart-pie' })
    links.push({ title: 'Fans', href: '/fans', icon: 'users' })
    links.push({ title: 'Royalties', href: '/royalties', icon: 'money-bill' })
    links.push({ title: 'Gifted', href: '/gifted', icon: 'gifts' })
    links.push({ title: 'Flex', href: '/flex', icon: 'grin-stars' })
    links.push({ title: 'Buy/Sale', href: '/activity', icon: 'file-invoice-dollar' })
    links.push({ title: 'Offers', href: '/tokens/offers', icon: 'comment-dollar' })
    links.push({ title: 'Ban', href: '/ban', icon: 'ban' })
    render_menu(wallet, links)
  }
  if (empty(absolute_time) || !absolute_time) add_timeago()
}
