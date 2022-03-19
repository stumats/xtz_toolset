
import { empty, getAddress } from './utils'
import { processTransaction } from './transaction'
import { tokenIdParam } from './contract'

export const SendTokens = async (evt) => {
  if (evt) evt.preventDefault()
  let send_to = document.getElementById("send_to").value
  if (empty(send_to)) return

  let list = []
  document.querySelectorAll("input.migrate:checked").forEach((elem) => {
    let item = { amount: parseInt(elem.dataset.quantity) }
    let token = tokenIdParam(elem.dataset.tokenId)
    item.fa2_id = token.fa2_id
    item.token_id = token.id
    list.push(item)
  })
  if (empty(list)) return

  send_to = await getAddress(send_to)
  document.getElementById("send_to").value = send_to
  let ok = await processTransaction('transfer', { transfer_to: send_to, tokens: list })
  if (ok) {
    for (let t of list) {
      console.log(`migrated : ${t.token_id}`)
      let elem = document.getElementById(t.token_id)
      if (elem) elem.remove()
    }
  }
}
