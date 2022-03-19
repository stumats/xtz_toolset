import React, { useEffect } from 'react';
import ReactDOM from 'react-dom'
import Script from 'next/script'

import Head from 'next/head'
import * as Wallet from '../utils/wallet'
import { WalletConnector } from '../components/wallet_connector'
import { empty } from '../utils/utils'
import Link from 'next/link'

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Form from 'react-bootstrap/Form'
import Button from 'react-bootstrap/Button'

export default function PageContent() {
  useEffect(() => {
    let div = document.getElementById("menu_container")
    if (div) div.remove()

    Wallet.connectedWalletAddress().then((wallet) => {
      if (!empty(wallet)) return
      let div = document.getElementById("wallet_placeholder")
      ReactDOM.render(
        <>
          <h3 style={{ marginTop: '20px' }}>For a better experience, connect your wallet</h3>
          <WalletConnector skip_logout={true} />
        </>,
        div)
    })
  }, [])

  const LinksBlock = (props) => {
    return (
      <>
        <h3>{props.title}</h3>
        <div className="d-grid gap-2">
          {props.links.map((entry, idx) => (
            <Link href={entry.path} key={idx}>
              <a className="btn btn-lg btn-secondary" target={entry.target}>{entry.title}</a>
            </Link>
          ))}
        </div>
      </>
    )
  }

  let collectors = [
    { path: '/follow', title: 'Follow' },
    { path: '/artist/follow', title: 'Following analysis' },
    { path: '/feed', title: 'Latest mints' },
    { path: '/fxhash', title: 'Last Fxhash mints' },
    { path: '/onsale', title: 'Gallery' },
    { path: '/flex', title: 'Flex collection' },
    { path: '/collector', title: 'Collecting stats' },
    { path: '/artist', title: 'Artist summary' },
    { path: '/paperhand', title: 'Paperhand offers' },
    { path: '/multieditions', title: 'Multiple ed.' },
    { path: '/tokens/offers', title: 'Offers received' },
    { path: '/tokens/cancel', title: 'Manage you offers' },
    { path: '/tokens/bids', title: 'Following bids' },
  ]

  let artists = [
    { path: '/artist', title: 'Artist summary' },
    { path: "/royalties", title: "Royalties" },
    { path: "/fans", title: "Fans" },
    { path: "/onsale", title: "Gallery" },
    { path: "/giveaway", title: "Giveaway" },
    { path: "/offer", title: "Drop manager" },
    { path: "/pin", title: "Pin your creations" },
  ]

  let anybody = [
    { path: "https://barter.nftbiker.xyz", title: "NFT4NFT (barter)", target: 'blank' },
    { path: "/history", title: 'Objkt history' },
    { path: "/activity", title: 'Wallet Activity' },
    { path: "/gifted", title: 'Gifted' },
    { path: "/stats/topsales", title: 'Top sales' },
    { path: "/stats", title: 'Sales volume' },
    { path: "/stats/marketplace", title: 'Marketplaces statistics' },
    { path: "/migrate", title: 'Migrate wallet' },
    { path: "/migrate/transfer", title: 'Transfer tokens' },
    { path: "/ban", title: 'Ban detector' },
    { path: "/swap/operator", title: 'Remove operators' },
  ]

  return (
    <>
      <Head>
        <title>Nftbiker's tools for TEZOS NFTs</title>
      </Head>


      <div className="profile_block">
        <Row>
          <Col xs="12" md="10">
            <div className="bio">
              <h1>The Multitool for Tezos Marketplaces</h1>
              <div className="social">
                <b>Built by a collector, for Collectors & Artists</b>
                &bull;
                <a href="https://objkt.com/profile/tz1hvfkpf7HbnE1Rroi7JbyegVjZzu97Yqw6/creations" target="_blank" rel="noreferrer">nftbiker.tez</a>&nbsp;&nbsp;
                &bull;&nbsp;
                <a href="https://twitter.com/nftbiker" target="_blank" className="social_icon" rel="noopener noreferrer">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M5.026 15c6.038 0 9.341-5.003 9.341-9.334 0-.14 0-.282-.006-.422A6.685 6.685 0 0 0 16 3.542a6.658 6.658 0 0 1-1.889.518 3.301 3.301 0 0 0 1.447-1.817 6.533 6.533 0 0 1-2.087.793A3.286 3.286 0 0 0 7.875 6.03a9.325 9.325 0 0 1-6.767-3.429 3.289 3.289 0 0 0 1.018 4.382A3.323 3.323 0 0 1 .64 6.575v.045a3.288 3.288 0 0 0 2.632 3.218 3.203 3.203 0 0 1-.865.115 3.23 3.23 0 0 1-.614-.057 3.283 3.283 0 0 0 3.067 2.277A6.588 6.588 0 0 1 .78 13.58a6.32 6.32 0 0 1-.78-.045A9.344 9.344 0 0 0 5.026 15z" />
                  </svg>
                </a>
              </div>
            </div>
          </Col>
          <Col xs="12 d-none d-sm-none d-md-block d-lg-block" md="2">
            <a href="https://objkt.com/profile/tz1hvfkpf7HbnE1Rroi7JbyegVjZzu97Yqw6/creations" target="_blank" rel="noreferrer"><img src="/images/nftbiker.jpg" className="profile_pic" alt="NftBiker" height="90" width="90" /></a>
          </Col>
        </Row>

        <div id="wallet_placeholder"></div>

        <Form action="/search/artist" method='get'>
          <h3>Search a wallet</h3>
          <Row>
            <Col xs="12" md="8" className='mb-2'>
              <div className="block inline">
                <Form.Control name='search' type='text' style={{ width: '400px' }} className='mb-2' placeholder='Artist or collector name' />
                <Button variant="secondary" type="submit">
                  Search
                </Button>
              </div>
            </Col>
          </Row>
        </Form>

        <Row>
          <Col xs="12" md="6" lg="3" className="tools">
            <LinksBlock title="Collectors" links={collectors} />
          </Col>
          <Col xs="12" md="6" lg="3" className="tools">
            <LinksBlock title="Artists" links={artists} />
          </Col>
          <Col xs="12" md="6" lg="3" className="tools">
            <LinksBlock title="Anyone" links={anybody} />
          </Col>
        </Row>

        <div>
          <div className='others'>
            <h3>Other tools</h3>
            Here is a list of tools made by other talented developers that can help you
            <ul className='bullet'>
              <li>
                <a href="https://glry.xyz/value" target='_blank' rel="nofollow noopener noreferrer">Collection Appraisal</a> : evaluate your HEN collection and get a lot of stats about it
              </li>
              <li>
                <a href="https://dono.xtz.tools/" target='_blank' rel="nofollow noopener noreferrer">hic et dono</a> : giveaway your art, while preventing freebie hoarding.
              </li>
              <li>
                <a href="https://henstorefront.xyz/mint" target='_blank' rel="nofollow noopener noreferrer">Batch minting</a> : batch mint on HEN contract
              </li>

            </ul>
          </div>
        </div>
      </div>
    </>
  )
}

PageContent.layout = 'skip_result'