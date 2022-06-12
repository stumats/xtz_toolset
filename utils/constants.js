// APIS
export const HICDEX_MAIN = "https://api.teia.art/v1/graphql"
export const OBJKT_API_URL = "https://data.objkt.com/v2/graphql"
export const FXHASH_API_URL = "https://api.fxhash.xyz/graphql"

// HEN
export const MINT_PROTOCOL = 'KT1Hkg5qeNhfwpKW4fXvq7HGZB9z2EnmCCA9'
export const HEN_OBJKT = 'KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton'
export const HEN_MARKETPLACE = 'KT1HbQepzV1nVGg8QVznG7z4RcHseD5kwqBn'

// TEIA
export const TEIA_MARKETPLACE = 'KT1PHubm9HtyQEJ4BBpMTVomq6mhbfNZ9z5w'

// objkt.com
export const BID_OLD_MARKET = 'KT1Dno3sQZwR5wUCWxzaohwuJwG3gX1VWj1Z'
export const BID_MINTER = 'KT1Aq4wWmVanpQhq4TTfjZXB5AjFpx15iQMM'

export const BID_MARKETPLACE = 'KT1FvqJwEDWb1Gwc55Jd1jjTHRVWbYKUUpyq'
export const BID_AUCTION = 'KT1XjcRq5MLAzMKQ3UHsrue2SeU2NbxUrzmU'
export const BID_DUTCH = 'KT1QJ71jypKGgyTNtXjkCAYJZNhCKWiHuT2r'

export const BID_MARKETPLACE2 = 'KT1WvzYHCNBvDSdwafTHv7nJ1dWmZ8GCYuuC'
export const BID_AUCTION2 = 'KT18p94vjkkHYY3nPmernmgVR7HdZFzE7NAk'
export const BID_DUTCH2 = 'KT1XXu88HkNzQRHNgAf7Mnq68LyS9MZJNoHP'

// fxhash
// export const FXHASH_MINTER = 'KT1AEVuykWeuuFX7QkEAMNtffzwhe1Z98hJS'
export const FXHASH_MINTER = 'KT1XCoGnfupWk7Sp8536EfrxcP73LmT68Nyr'
export const FXHASH_REPORT = 'KT1BQqRn7u4p1Z1nkRsGEGp8Pc92ftVFqNMg'
export const FXHASH_OBJKT = 'KT1KEa8z6vWXDJrVqtMrAeDVzsvxat3kHaCE'
export const FXHASH_MARKETPLACE = 'KT1Xo5B7PNBAeynZPmca4bRh6LQow4og1Zb9'

// versum
export const VERSUM_MINTER = 'KT1LjmAdYQCLBjwv4S2oFkEzyHVkomAf5MrW'
export const VERSUM_MARKETPLACE = 'KT1GyRAJNdizF1nojQz62uGYkx8WFRUJm9X5'
export const VERSUM_BAN = 'KT1NUrzs7tiT4VbNPqeTxgAFa4SXeV1f3xe9'

// rarible
export const RARIBLE_MINTER = 'KT18pVpRXKPY2c4U2yFEGSH3ZnhB2kL8kwXS'
export const RARIBLE_MARKETPLACE = 'KT1D2fZiUNo6RPj3zKofH8DqDDgoV7KoyEbb' // put
export const RARIBLE_EXCHANGE = 'KT198mqFKkiWerXLmMCw69YB1i6yzYtmGVrC'

// marketplaces
export const MARKETPLACE_CONTRACTS = [
  HEN_MARKETPLACE,
  TEIA_MARKETPLACE,
  BID_MARKETPLACE,
  BID_AUCTION,
  BID_DUTCH,
  BID_MARKETPLACE2,
  BID_AUCTION2,
  BID_DUTCH2,
  FXHASH_MARKETPLACE,
  VERSUM_MARKETPLACE,
  RARIBLE_MARKETPLACE
]

export const SKIP_CONTRACTS = [
  MINT_PROTOCOL,
  BID_OLD_MARKET,
].concat(MARKETPLACE_CONTRACTS)

export const LOCAL_OBJKT = [
  HEN_OBJKT,
  FXHASH_MINTER,
  VERSUM_MINTER,
]
export const EXCLUDE_SALES = LOCAL_OBJKT.concat([FXHASH_OBJKT])

export const ALLOWED_CLONE = ['hen', 'art', 'teia', 'bid']
export const DEFAULT_CLONE = 'teia'

export const BURN_ADDRESS = 'tz1burnburnburnburnburnburnburjAYjjX';

export const HEN_FEE = 25;
export const HEN_DECIMALS = 1000000;

export const FAKE_WARNING = "Artworks from wallets banned by HEN are not shown, but results can still include copymints or fake artworks not detected - Always double check that the artist is really the one you want to buy from."


export const RPC_NODES = {
  'Tezos Foundation': 'https://rpc.tzbeta.net/',
  'SmartPy': 'https://mainnet.smartpy.io',
  'ECAD Labs': 'https://mainnet.api.tez.ie',
  'LetzBake': 'https://teznode.letzbake.com',
  'Tzstats': 'https://rpc.tzstats.com'
}

export const DEFAULT_RPC_NODE = 'ECAD Labs'