/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from 'react'
import { empty, getAddresses, urlParams, update_current_href } from '../../utils/utils'
import { connectedWalletAddress } from '../../utils/wallet';
import { buildBatchMenu, buildMenu } from '../../utils/menu'
import Form from 'react-bootstrap/Form'

var monitoring = {}

function artist_bookmarklet(title, url) {
  if (url.match(/[?]/)) url += '&wallet='
  else url += '?wallet='
  let txt = `
    javascript:(function() {
        m = window.location.href.match(/\\\/(tz[^\\\/]{34}|kt[^\\\/]{34})/im);
        if (m) { window.open('${url}' + m[1]); return };
        m = document.body.innerHTML.match(/(profile|tzkt\.io)\\\/(tz[0-9a-z]{34})/im);
        if (m) { window.open('${url}' + m[2]); return };
        m = document.body.innerHTML.match(/\\\/((tz|kt)[0-9a-z]{34}).+?editions/im);
        if (m) { window.open('${url}' + m[1]); return };
        m = document.body.innerHTML.match(/href\\\=.*?\\\/(tz[^\\\\(\\)\\?\\\/%22%27]+)[%22%27]/im);
        if (m) { window.open('${url}' + m[1]); return };
    })()
    `
  txt = txt.replace(/[\r\n\s]+/img, '');
  let div = document.getElementById("bookmarklet") || document.getElementById("bookmarklet_alt")
  if (div) {
    div.innerHTML = `
      Drag & Drop this <a href="${txt}" title="${title}">${title}</a> link on your bookmarks toolbar to access to this page from a profile or token page.
    `
    div.style.display = 'block'
    if (div.id == 'bookmarklet') {
      div = document.getElementById("bookmarklet_alt")
      if (div) {
        div.innerHTML = ''
        div.style.display = 'none'
      }
    }
  }
}

export const WalletField = (props) => {
  const [currentWallet, setCurrentWallet] = useState('')

  useEffect(() => {
    if (props.monitoring) initMonitoring(props.monitoring)
  }, [])

  useEffect(() => {
    if (!empty(currentWallet)) processWalletChange(currentWallet)
  }, [currentWallet])

  const handleChange = (e) => {
    let val = document.getElementById("wallet").value
    if (e.key == 'Enter' || e._reactName == 'onBlur') {
      processWalletChange(val)
    }
    else if (e._reactName == 'onChange' && val.match(/(tz|kt).{34}/i) && !monitoring.multiple) {
      processWalletChange(val)
    }
  }


  async function initMonitoring(data) {
    monitoring = data
    if (!monitoring.hide) {
      let bookmarklet = monitoring.bookmarklet
      if (!empty(bookmarklet)) {
        let path = bookmarklet.path.replace(/^\\/, '')
        artist_bookmarklet(bookmarklet.title, `https://nftbiker.xyz/${path}`);
      }
    }

    let wallet = urlParams.get("wallet");
    if (empty(wallet) && !monitoring.skip_default) wallet = await connectedWalletAddress()
    if (!empty(wallet)) setCurrentWallet(wallet)
    else {
      let menu = monitoring.batch_menu ? buildBatchMenu : buildMenu
      let item = document.getElementById("wallet")
      wallet = !empty(item?.value) ? item.value : null
      if (empty(wallet)) urlParams.delete("wallet")
      else urlParams.set("wallet", wallet)
      update_current_href()
      setCurrentWallet(wallet)
      menu(wallet)
    }
  }

  async function processWalletChange(new_wallet) {
    let menu = buildMenu
    if (monitoring.batch_menu === true) menu = buildBatchMenu
    else if (monitoring.batch_menu) menu = monitoring.batch_menu

    let addresses = await getAddresses(new_wallet)
    let val = null

    if (monitoring.multiple) val = addresses.join(',')
    else val = addresses[0]
    if (empty(val)) {
      val = ''
      setCurrentWallet(val)
    }

    if (!monitoring.hide) {
      document.getElementById("wallet").value = val
      if (empty(val)) urlParams.delete("wallet")
      else urlParams.set("wallet", val)
      update_current_href()
    }
    menu(addresses[0])
    if (monitoring['method']) monitoring.method()
    if (!empty(addresses) && !empty(monitoring['emptyFields'])) monitoring['emptyFields'].call()
  }

  let multiple = props.monitoring?.multiple || props.multiple
  let placeholder = multiple ? 'address1 (tz... or wallet.tez or username), address2, ..., addressN' : 'tz... or wallet.tez or HEN Username'

  let width = '80%'
  let bookmarklet = !empty(props.monitoring?.bookmarklet)
  if (props.skip_bookmarklet_div) bookmarklet = false

  let cls = "block"
  if (props.inline) {
    width = '40%'
    bookmarklet = false
    cls += ' inline'
  }
  else if (empty(props.inline)) cls += ' inline'

  if (!empty(props.width)) width = props.width

  if (props.monitoring?.hide) return (<p></p>)
  else {
    return (
      <>
        <div className={cls}>
          <Form.Label>
            {!empty(props.label) ? props.label : 'Wallet'}
          </Form.Label>
          <Form.Control
            id="wallet"
            name="wallet"
            type='text'
            placeholder={placeholder}
            onChange={e => handleChange(e)}
            onKeyPress={e => handleChange(e)}
            style={{ width: width }}>
          </Form.Control>
          {props.children}
        </div>
        {bookmarklet && (
          <div id="bookmarklet" className='block'></div>
        )}
      </>
    )
  }
}
