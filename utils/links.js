import { empty, Artists } from './utils'
import { rewriteTokenId } from './contract';
import * as AppConst from './constants'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export const ipfs_img = [
  "https://ipfs.io/",
  "https://ipfs.infura.io/",
  "https://dweb.link/",
  "https://cloudflare-ipfs.com/",
];
export const ipfs_video = [
  "https://ipfs.io/",
  "https://infura-ipfs.io"
]


export function shorten_wallet(tz, max) {
  try {
    if (empty(tz)) return '';
    if (tz.match(/^(tz|kt)/im)) return tz.slice(0, 5) + ".." + tz.slice(-5);
    else return tz.slice(0, empty(max) ? 20 : max);
  } catch (e) {
    console.log("short wallet error", tz, e)
    return tz;
  }
}

export function history_url(token_id) {
  return `/history?token_id=${rewriteTokenId(token_id)}`
}

export function history_link(token_id, title) {
  if (empty(title)) title = 'History'
  return (<a href={history_url(token_id)} target="_blank">{title}</a>)
}

export function ipfs_link(url, title) {
  if (empty(url)) return null
  if (empty(title)) title = url
  let ipfs_url = `https://ipfs.io/ipfs/${url.replace('ipfs://', '').replace('/ipfs', '')}`
  return (<a href={ipfs_url} target="_blank">{url}</a>)
}

export function hen_host() {
  let val = localStorage.getItem("hen_link")
  if (empty(val)) val = AppConst.DEFAULT_CLONE
  if (val == 'teia') return 'https://teia.art'
  else if (val == 'art') return 'https://hicetnunc.art'
  else if (val == 'hen') return 'https://hicetnunc.xyz'
  else return 'https://teia.art'
}

export function wallet_link(data, options) {
  if (empty(options)) options = {}
  if (empty(data)) return '';
  if (empty(options.class_name)) options.class_name = ''
  if (empty(options.page)) options.page = "creations"
  let name = artist_link_name(data)
  let url = `https://objkt.com/profile/${data.address}/${options.page}`
  if (typeof window !== 'undefined' && localStorage.getItem("hen_link")) {
    url = `${hen_host()}/tz/${data.address}/${options.page}`
  }
  return (<a href={url} className={options.class_name} data-wallet={data.address} target="_blank">{shorten_wallet(name)}</a>)
}

export function activity_link(data, class_name) {
  if (empty(data)) return '';
  if (empty(class_name)) class_name = ''
  let name = artist_link_name(data)
  return (<a href={`/activity?wallet=${data.address}`} className={class_name} data-wallet={data.address} target="_blank">{shorten_wallet(name)}</a>)
}

export function artist_link(data, class_name) {
  if (empty(data)) return '';
  if (empty(class_name)) class_name = ''
  let name = artist_link_name(data)
  return (<a href={`/artist?wallet=${data.address}`} className={class_name} data-wallet={data.address} target="_blank">{shorten_wallet(name)}</a>)
}

export function gallery_link(data, options) {
  if (empty(data)) return '';
  if (empty(options)) options = { secondary: true, empty: false }
  let name = artist_link_name(data)
  let url = `/onsale?wallet=${data.address}`
  if (options.empty) url += '&empty=1'
  if (options.secondary) url += '&secondary=1'
  let title = empty(options.title) ? shorten_wallet(name) : options.title
  return (<a href={url} className={options.class_name} data-wallet={data.address} target="_blank">{title}</a>)
}

export function flex_link(data, options) {
  if (empty(data)) return '';
  if (empty(options)) options = {}
  let name = artist_link_name(data)
  let title = empty(options.title) ? shorten_wallet(name) : options.title
  return (<a href={`/flex?wallet=${data.address}`} className={options.class_name} data-wallet={data.address} target="_blank">{title}</a>)
}

export function operation_link(id, title, op) {
  if (empty(title)) {
    let data = String(id).split('_')
    let val = id
    if (data.length > 1) val = data[1].slice(0, 10)
    title = `#${String(val).slice(0, 15)}`;
  }
  if (normalized_operation(op) == 'bid') return bid_link(id, title)
  else return nft_link(id, title);
}

export function bid_link(id, title, class_name) {
  if (empty(title)) title = 'Bid';
  if (empty(class_name)) class_name = null;
  return (<a href={bid_url(id)} target="_blank" className={class_name}>{title}</a>)
}

export function nft_link(id, title, force_platform) {
  if (empty(title)) {
    let data = String(id).split('_')
    let val = id
    if (data.length > 1) val = data[1].slice(0, 10)
    title = `#${String(val).slice(0, 15)}`;
  }
  return (<a href={nft_url(id, false, force_platform)} target="_blank">{title}</a>)
}

export function operation_url(id, op) {
  if (normalized_operation(op) == 'bid') return bid_url(id)
  else return nft_url(id, false, op);
}

function bid_url(id) {
  return nft_url(id, true)
}

export function is_hen(uuid) {
  let data = String(uuid).split('_')
  if (data.length < 2) return true
  return (data[0] == AppConst.HEN_OBJKT)
}

export function is_fxhash(uuid) {
  let data = String(uuid).split('_')
  if (data.length < 2) return false
  return (data[0] == AppConst.FXHASH_MINTER)
}

export function is_versum(uuid) {
  let data = String(uuid).split('_')
  if (data.length < 2) return false
  return (data[0] == AppConst.VERSUM_MINTER)
}

export function is_rarible(uuid) {
  let data = String(uuid).split('_')
  if (data.length < 2) return false
  return (data[0] == AppConst.RARIBLE_MINTER)
}

export function nft_url(id, ignore_pref, platform) {
  let data = String(id).split('_')
  if (data.length > 1 && (data[0] != AppConst.HEN_OBJKT || !empty(platform))) {
    if (data[0] == AppConst.FXHASH_MINTER)
      return `https://www.fxhash.xyz/generative/${data[1]}`
    else if (data[0] == AppConst.VERSUM_MINTER)
      return `https://versum.xyz/token/versum/${data[1]}`
    else if (data[0] == AppConst.FXHASH_OBJKT)
      return `https://www.fxhash.xyz/gentk/${data[1]}`
    else if (data[0] == AppConst.RARIBLE_MINTER || platform == 'rarible')
      return `https://rarible.com/token/tezos/${data[0]}:${data[1]}?tab=owners`
    else
      return `https://objkt.com/asset/${data[0]}/${data[1]}`
  }
  else {
    let token_id = data.pop()
    if (empty(ignore_pref)) ignore_pref = false
    if (ignore_pref == 'shill') return `https://hic.art/${token_id}`

    if (!ignore_pref && !empty(localStorage.getItem("hen_link"))) {
      if (localStorage.getItem("hen_link") != 'bid') return `${hen_host()}/objkt/${token_id}`
    }
    return `https://objkt.com/o/${token_id}`
  }
}

export function get_artwork_link(obj) {
  let artwork_link = obj.mime;
  if (!empty(obj.mime) && obj.mime.match(/image|video/)) {
    artwork_link = empty(obj.display_uri) ? obj.artifact_uri : obj.display_uri;
    artwork_link = artwork_url(artwork_link, obj.mime);
    return (<a href={artwork_link} target="_blank">{obj.mime.split('/').pop()}</a>)
  }
  else return String(artwork_link).split('/').pop();
}

export function asset_host(str, hostsArray) {
  // retrieve a random host, but always the same one for an str
  if (hostsArray.length <= 1) return str
  let result = 0;
  for (let i = 0; i < str.length; i++) {
    result += str.charCodeAt(i);
  }
  let host = hostsArray[result % hostsArray.length];
  return host;
}


function artwork_url(uri, mime) {
  if (empty(mime)) mime = '';
  let host = asset_host(uri, mime.match(/video/) ? ipfs_video : ipfs_img);
  if (!host.match(/\/$/)) host += '/';
  return uri.replace('ipfs://', host + 'ipfs/');
}

export function artist_link_name(data) {
  let name = data.name
  if (empty(name)) name = data.alias
  if (empty(name)) name = Artists.get(data.address);
  if (empty(name)) name = data.address;
  return name
}

export function normalized_operation(op) {
  if (empty(op)) return 'hen'
  else if (op == 'ask' || op == 'fulfill_ask' || op == 'bid' || op == 'bid2') return 'bid'
  else return 'hen'
}

export function twitter_link(name, icon) {
  if (empty(name)) return '';
  name = name.split('?')[0]
  let url = `https://twitter.com/${name}`;
  if (!empty(icon) && icon) {
    return (<a href={url} target="_blank" className="social_icon"><FontAwesomeIcon icon={['fab', 'twitter']} /></a>)
  } else {
    return (<a href={url} target="_blank">@{name}</a>)
  }
}
