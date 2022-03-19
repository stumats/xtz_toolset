import React from 'react'
import Nav from 'react-bootstrap/Nav'
import Navbar from 'react-bootstrap/Navbar'
import Link from 'next/link'

import { WalletConnector } from '../../components/wallet_connector'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { empty } from '../../utils/utils';

const icon = (name) => {
  return (<FontAwesomeIcon icon={name} />)
}

export const home_link = () => {
  return (
    <Link href="/">
      <a className='nav-link'>
        {icon('home')}
      </a>
    </Link>
  )
}

export const MenuBar = (props) => {
  let data = props.menu
  let wallet = props.wallet
  return (
    <Navbar id="menu" expand="md">
      <Navbar.Toggle aria-controls="basic-navbar-nav" />
      <Navbar.Collapse id="basic-navbar-nav">
        <Nav className="me-auto">
          {home_link()}
          {data.map((item, idx) => {
            let path = item.href
            if (!empty(wallet)) path += '?wallet=' + wallet
            return (
              <Link href={path} key={idx}>
                <a className='nav-link'>
                  <>
                    {!empty(item.icon) && (
                      <FontAwesomeIcon icon={item.icon} />
                    )}
                    {!empty(item.img) && (
                      <>{item.img}</>
                    )}
                    <span>{item.title}</span>
                  </>
                </a>
              </Link>
            )
          })}
        </Nav>
      </Navbar.Collapse>
      <div id="wallet_connector_container">
        <Navbar.Text >
          <WalletConnector />
        </Navbar.Text>
      </div >
    </Navbar>
  )
}
