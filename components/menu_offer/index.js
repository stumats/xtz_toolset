
import React from 'react'
import Nav from 'react-bootstrap/Nav'
import Link from 'next/link'
import { useRouter } from 'next/router'

export const MenuOffer = () => {
  const router = useRouter()
  return (
    <Nav variant="pills" defaultActiveKey={router.pathname}>
      <Nav.Item>
        <Link href="/tokens/offers"><a className='btn btn-secondary'>Offers received</a></Link>
      </Nav.Item >
      <Nav.Item>
        <Link href="/tokens/cancel"><a className='btn btn-secondary'>Cancel offers</a></Link>
      </Nav.Item>
      <Nav.Item>
        <Link href="/tokens/bids"><a className='btn btn-secondary'>Friends offers</a></Link>
      </Nav.Item>
    </Nav>
  )
}