import React from 'react'
import { ipfs_img, ipfs_video, asset_host } from '../../utils/links'
import { empty } from '../../utils/utils'
import * as AppConst from '../../utils/constants'
import 'lazysizes'

export const MediaTag = (props) => {
  let token = props.token
  if (empty(token)) {
    console.log(`No token provided to mediatag`);
    console.log(props)
    return null
  }

  let src = null
  let video = false
  let className = "lazyload media"
  if (props.full) {
    className += " full"
    src = token.artifact_uri
    if (token.mime.match(/video/i)) {
      video = true
      className = "media full"
    }
    else if (!token.mime.match(/image/)) {
      src = empty(token.display_uri) ? token.thumbnail_uri : token.display_uri;
    }
  }
  else {
    src = empty(token.display_uri) ? token.thumbnail_uri : token.display_uri;
  }

  if (!empty(token.mime)) {
    if (empty(src) && token.mime.match(/image/i)) src = token.artifact_uri
    else if (String(src).match('QmNrhZHUaEqxhyLfqoq1mtHSipkWHeT31LNHb1QEbDHgnc') && token.mime.match(/image/i) && !empty(token.artifact_uri)) src = token.artifact_uri;
  }

  if (empty(src)) {
    console.log(`img not found for #${token.uuid}`);
    console.log(token)
    return null;
  }

  if (token.fa2_id == AppConst.VERSUM_MINTER && !props.full && String(token.mime).match(/(video|gif)/)) {
    src = token.thumbnail_uri
  }

  let host = asset_host(src, video ? ipfs_video : ipfs_img);
  if (!host.match(/\/$/)) host += '/';
  src = src.replace('ipfs://', host + 'ipfs/');
  src = src.replace('/ipfs/ipfs', '/ipfs')

  const playOrPause = (evt, method) => {
    if (props.full) return
    if (method == 'play') evt.target.play()
    else evt.target.pause()
  }
  return (
    <>
      {video ? (
        <video
          src={src}
          className={className}
          autoPlay={props.full}
          loop={true}
          muted={true}
          controls={props.full}
          onMouseOver={event => playOrPause(event, 'play')}
          onMouseOut={event => playOrPause(event, 'pause')}
        ></video>
      ) : (
        <img data-src={src} className={className} alt={token.title} />
      )}
    </>
  )
}
