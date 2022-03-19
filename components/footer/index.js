import React from 'react'
import { ThemeSelector } from '../theme_selector'

export const Footer = (props) => {
  return (
    <footer id="made_by">
      <div>
        Built by <a href="https://twitter.com/nftbiker" target="_blank" rel="noreferrer">@nftbiker</a> &bull; No guarantee provided - Use at your own risk - ! DYOR !
        <ThemeSelector />
      </div>
    </footer>
  )
}
