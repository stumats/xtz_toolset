import { InMemorySigner } from '@taquito/signer';
import { TezosToolkit, OpKind } from "@taquito/taquito";
import { BeaconWallet } from "@taquito/beacon-wallet";
import { empty } from './utils'
import { tokenIdParam } from './contract';
import * as AppConst from './constants'

const default_node = AppConst.RPC_NODES[AppConst.DEFAULT_RPC_NODE]

export var Tezos = null
export var account;
var wallet = null;

function choose_rpc_node(with_node) {
  let val = null
  if (!empty(with_node)) val = AppConst.RPC_NODES[with_node]
  else if (typeof window !== 'undefined' && !empty(localStorage.getItem("rpc_node"))) {
    let node = localStorage.getItem("rpc_node")
    if (node.match(/^https?:/im)) val = node
    else val = AppConst.RPC_NODES[node]
  }
  if (!empty(val)) return val
  else return default_node
}

export function initWallet(with_node) {
  if (empty(Tezos)) {
    Tezos = new TezosToolkit(choose_rpc_node(with_node))
    Tezos.setProvider({ config: { confirmationPollingIntervalSecond: 5, confirmationPollingTimeoutSecond: 60 } })
    wallet = null
  }
  else {
    let node = choose_rpc_node(with_node)
    if (node != Tezos._rpc) {
      Tezos = new TezosToolkit(node)
      Tezos.setProvider({ config: { confirmationPollingIntervalSecond: 5, confirmationPollingTimeoutSecond: 60 } })
      wallet = null
    }
  }
  if (wallet) return;
  wallet = new BeaconWallet({
    name: 'nftbiker.xyz',
    preferredNetwork: 'mainnet',
  })
  Tezos.setWalletProvider(wallet)
}

export async function setAccount() {
  initWallet()
  if (empty(account)) account =
    Tezos !== undefined
      ? await wallet.client.getActiveAccount()
      : undefined

  return account
}

export async function connectedWalletAddress() {
  await setAccount()
  if (empty(account)) return null
  else return account.address
}

export async function syncTaquito() {
  initWallet()
  let rpc_node = choose_rpc_node()
  const network = {
    type: 'mainnet',
    rpcUrl: rpc_node,
  }

  // We check the storage and only do a permission request if we don't have an active account yet
  // This piece of code should be called on startup to "load" the current address from the user
  // If the activeAccount is present, no "permission request" is required again, unless the user "disconnects" first.
  const activeAccount = await wallet.client.getActiveAccount()
  if (activeAccount === undefined) {
    console.log('permissions')
    await wallet.requestPermissions({ network })
  }
  account = await wallet.client.getActiveAccount()
  console.log(`connected to ${rpc_node}`, account.address)
}

export async function disconnect() {
  initWallet()

  console.log('disconnect wallet')
  // This will clear the active account and the next "syncTaquito" will trigger a new sync
  await wallet.client.clearActiveAccount()
  account = undefined
}

export async function walletFromKey(private_key) {
  let signer = await InMemorySigner.fromSecretKey(private_key)
  return await signer.publicKeyHash()
}

export function getMarketFa2(platform) {
  let fa2_id = AppConst.HEN_MARKETPLACE
  if (platform == 'fxhash') fa2_id = AppConst.FXHASH_MARKETPLACE
  else if (platform == 'bid') fa2_id = AppConst.BID_MARKETPLACE
  else if (platform == 'bid2') fa2_id = AppConst.BID_MARKETPLACE2
  else if (platform == 'teia') fa2_id = AppConst.TEIA_MARKETPLACE
  else if (platform == 'versum') fa2_id = AppConst.VERSUM_MARKETPLACE
  return fa2_id
}

var marketContracts = {}
async function getMarketplaceContract(platform) {
  let fa2_id = getMarketFa2(platform)
  if (empty(marketContracts[fa2_id])) marketContracts[fa2_id] = await Tezos.wallet.at(fa2_id)
  return marketContracts[fa2_id]
}

var tokenContracts = {}
async function getTokenContract(platform, fa2_id) {
  if (platform == 'fxhash') fa2_id = AppConst.FXHASH_OBJKT
  else if (platform == 'versum') fa2_id = AppConst.VERSUM_MINTER
  else if (platform == 'hen' || platform == 'hen2') fa2_id = AppConst.HEN_OBJKT

  if (empty(tokenContracts[fa2_id])) tokenContracts[fa2_id] = await Tezos.wallet.at(fa2_id)
  return tokenContracts[fa2_id]
}

export async function mint(data) {
  initWallet(data.node)
  let contract = data.contract
  let quantity = empty(data.quantity) ? 1 : 0
  let price = parseFloart(data.price) * AppConst.HEN_DECIMALS

  let params = {
    amount: quantity * price,
    mutez: true,
    storageLimit: 400,
  }

  return await api.wallet.at(contract)
    .then((c) =>
      c.methods
        .mint(swap_id)
        .send(params)
    )
    .catch((e) => e)
}

export async function transfer(data, api) {
  let from = null
  if (empty(api)) {
    initWallet()
    api = Tezos
    from = await connectedWalletAddress()
  }
  else {
    from = data.from
  }

  const { tokens, transfer_to } = data
  let storage_limit = 70

  // transfer a list of token {token_id: , amount:, fa2_id: } to transfer_to
  let contracts = {}
  for (let item of tokens) {
    let fa2_id = empty(item.fa2_id) ? AppConst.HEN_OBJKT : item.fa2_id
    if (empty(contracts[fa2_id])) contracts[fa2_id] = {
      txs: [],
      contract: await api.wallet.at(fa2_id)
    }
    contracts[fa2_id].txs.push({ to_: transfer_to, token_id: item.token_id, amount: parseInt(item.amount) })
  }

  let list = []
  for (let item of Object.values(contracts)) {
    let market = item.contract
    let params = { amount: 0, mutez: true, storageLimit: storage_limit * item.txs.length }
    list.push({
      kind: OpKind.TRANSACTION,
      ...market.methods.transfer([{ from_: from, txs: item.txs }]).toTransferParams(params)
    })
  }
  console.log('transfer', list)
  let batch = await api.wallet.batch(list);
  return await batch.send().catch((e) => e)
}

export async function giveaway(data, api) {
  let from = null
  if (empty(api)) {
    initWallet()
    api = Tezos
    from = await connectedWalletAddress()
  }
  else {
    from = data.from
  }

  let { tokens, fa2_id } = data
  if (empty(fa2_id)) fa2_id = AppConst.HEN_OBJKT
  let storage_limit = 70

  // transfer a list of token {token_id: , transfer_to: }
  let txs = []
  for (let item of tokens) {
    txs.push({ to_: item.transfer_to, token_id: item.token_id, amount: 1 })
  }
  console.log('giveaway contract', fa2_id)
  console.log('giveway txs', txs)

  let params = { amount: 0, mutez: true }

  return await api.wallet.at(fa2_id)
    .then((c) =>
      c.methods
        .transfer([{ from_: from, txs: txs }])
        .send(params)
    )
    .catch((e) => e)
}


export async function batch_cancel_bids(data) {
  // cancel current swap
  let bids = data.bids
  let limits = { cancel: 50 }
  let list = []

  for (let bid of bids) {
    let val = parseInt(bid.id)
    let market = await getMarketplaceContract(bid.platform)
    if (val > 0) {
      if (bid.platform == 'bid') list.push({
        kind: OpKind.TRANSACTION,
        ...market.methods.retract_bid(val).toTransferParams({ amount: 0, mutez: true, storageLimit: limits.cancel })
      })
      else if (bid.platform == 'bid2') list.push({
        kind: OpKind.TRANSACTION,
        ...market.methods.retract_offer(val).toTransferParams({ amount: 0, mutez: true, storageLimit: limits.cancel })
      })
      else if (bid.platform == 'versum') list.push({
        kind: OpKind.TRANSACTION,
        ...market.methods.cancel_offer(val).toTransferParams({ amount: 0, mutez: true, storageLimit: limits.cancel })
      })
      else console.error('ignore invalid bid', bid)
    }
  }
  console.log('cancel bids', list)
  let batch = await Tezos.wallet.batch(list);
  return await batch.send().catch((e) => e)
}

export async function revoke_operators(data) {
  initWallet()

  let objkts = await Tezos.wallet.at(AppConst.HEN_OBJKT)

  let owner = data.owner
  let operators = data.operators

  let list = []
  for (let entry of operators) {
    list.push({ remove_operator: { operator: entry.operator, token_id: parseInt(entry.token_id), owner: owner } })
  }

  return await objkts.methods.update_operators(list).send({ amount: 0, mutez: true }).catch((e) => e)
}
