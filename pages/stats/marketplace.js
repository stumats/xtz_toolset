import React, { useEffect, useState } from 'react';
import Head from 'next/head'
import { done, empty, fetchGraphQL, fetchObjQL, loading, sql_date, update_current_href, urlParams, format_number } from '../../utils/utils'

import * as AppConst from '../../utils/constants'
import { Result } from '../../components/result';
import { buildStatMenu } from '../../utils/menu';

const COLLECTIONS = [
  { name: 'Tezzardz', path: 'tez', contract: 'KT1LHHLso8zQWQWg1HUukajdxxbkGfNoHjh6' },
  { name: 'NEONZ', path: 'neon', contract: 'KT1MsdyBSAMQwzvDH4jt2mxUKJvBSWZuPoRJ' },
  { name: 'PRJKTNEON', path: 'prjkt', contract: 'KT1VbHpQmtkA3D4uEbbju26zS8C42M5AGNjZ' },
  { name: 'GOGOs', path: 'googo', contract: 'KT1SyPgtiXTaEfBuMZKviWGNHqVrBBEjvtfQ' },
  { name: 'Randomly common skeles', path: 'skele', contract: 'KT1HZVd9Cjc2CMe3sQvXgbxhpJkdena21pih' },
  { name: 'The Moments', path: 'moment', contract: 'KT1CNHwTyjFrKnCstRoMftyFVwoNzF6Xxhpy' },
]

const query_custom_contracts = `
query qryNftBiker {
  fa(where: {collection_type: {_in: ["generative", "custom"]}, live: {_eq: true}, items: { _gt: 0}, contract: {_neq: "${AppConst.HEN_OBJKT}"}}) {
    path
    name
    contract
    collection_id
    collection_type
    live
    items
  }
}
`
var contracts = null

function cleanPath(path) {
  if (empty(path)) return ''
  return path.replace(/[^a-z0-9]+/ig, '')
}
const query_stats = (fa2) => {
  let list = []
  let skip = [AppConst.HEN_OBJKT, AppConst.VERSUM_MINTER]
  fa2.forEach(c => {
    skip.push(c.contract)
    list.push(`
      bid_${c.path}:marketplace_bid_aggregate(where: {fa2_id: {_eq: "${c.contract}"}, timestamp: {_gte: $start}}) {
        aggregate {
          sum {
            amount
            price
          }
        }
      }
      ask_${c.path}:marketplace_ask_aggregate(where: {fa2_id:{_eq: "${c.contract}"}, timestamp: {_gte: $start}}) {
        aggregate {
          sum {
            amount
            price
          }
        }
      }
    `)
  })

  let query = `
query qryNftBiker($start: timestamptz!, $skip: [String!]) {
  hen:marketplace_ask_aggregate(where: {platform:{_eq: "hen2"}, fa2_id:{_eq: "${AppConst.HEN_OBJKT}"}, timestamp: {_gte: $start}}) {
    aggregate {
      sum {
        amount
        price
      }
    }
  }
  bid_hen:marketplace_bid_aggregate(where: {fa2_id:{_eq: "${AppConst.HEN_OBJKT}"}, timestamp: {_gte: $start}}) {
    aggregate {
      sum {
        amount
        price
      }
    }
  }
  ask_hen:marketplace_ask_aggregate(where: {platform:{_neq: "hen2"}, fa2_id:{_eq: "${AppConst.HEN_OBJKT}"}, timestamp: {_gte: $start}}) {
    aggregate {
      sum {
        amount
        price
      }
    }
  }
  bid_versum:marketplace_bid_aggregate(where: {fa2_id:{_eq: "${AppConst.VERSUM_MINTER}"}, timestamp: {_gte: $start}}) {
    aggregate {
      sum {
        amount
        price
      }
    }
  }
  ask_versum:marketplace_ask_aggregate(where: {fa2_id:{_eq: "${AppConst.VERSUM_MINTER}"}, timestamp: {_gte: $start}}) {
    aggregate {
      sum {
        amount
        price
      }
    }
  }
  bid_collection:marketplace_bid_aggregate(where: {fa2_id: {_nin: $skip}, timestamp: {_gte: $start}}) {
    aggregate {
      sum {
        amount
        price
      }
    }
  }
  ask_collection:marketplace_ask_aggregate(where: {fa2_id: {_nin: $skip}, timestamp: {_gte: $start}}) {
    aggregate {
      sum {
        amount
        price
      }
    }
  }
  ${list.join("\n")}
}
`
  return { query: query, skip: skip }
}


export default function Marketplace() {
  const [recent, setRecent] = useState({})
  const [weekly, setWeekly] = useState({})
  const [monthly, setMonthly] = useState({})
  const [current, setCurrent] = useState(1)

  useEffect(() => {
    let type = urlParams.get('type')
    type = empty(type) ? 1 : parseInt(type)
    buildStatMenu()
    fetchStats(type)
  }, []);

  function addResult(result, data, obj) {
    result.price += data.price
    result.amount += data.amount
    return Object.assign(obj, data)
  }

  function buildResult(data) {
    let collections = {
      price: 0,
      amount: 0,
    }
    let hen = {
      price: 0,
      amount: 0,
    }
    let versum = {
      price: 0,
      amount: 0,
    }

    let results = []
    results.push(addResult(hen, data.hen.aggregate.sum, { name: 'Main HEN trades', type: 'regular' }))
    results.push(addResult(hen, mergeStats(data.ask_hen.aggregate.sum, data.bid_hen.aggregate.sum), { name: 'Objkt HEN trades', type: 'regular' }))
    results.push(addResult(versum, mergeStats(data.ask_versum.aggregate.sum, data.bid_versum.aggregate.sum), { name: 'Versum', type: 'regular' }))

    results.push(addResult(collections, mergeStats(data.ask_collection.aggregate.sum, data.bid_collection.aggregate.sum), { name: 'Objkt Collections', type: 'regular' }))

    let price = 0
    let amount = 0
    let list = []
    contracts.forEach(c => {
      let stats = mergeStats(data[`ask_${c.path}`].aggregate.sum, data[`bid_${c.path}`].aggregate.sum)
      if (stats.amount > 0) {
        price += stats.price
        amount += stats.amount
        list.push(Object.assign({ name: c.name, type: 'custom' }, stats))
      }
    })
    list.sort((a, b) => b.price - a.price)

    results.push(addResult(collections, { price: price, amount: amount }, { name: 'External Collections', type: 'regular' }))

    price = results.map(e => parseInt(e.price)).reduce((a, b) => a + b, 0)
    amount = results.map(e => parseInt(e.amount)).reduce((a, b) => a + b, 0)

    results = results.concat(list)
    results.forEach(e => {
      e.price_percent = price > 0 ? ((e.price / price) * 100).round(2) : 0
      e.amount_percent = amount > 0 ? ((e.amount / amount) * 100).round(2) : 0
    })

    list = [
      Object.assign({ name: 'HEN trades', type: 'summary' }, hen),
      Object.assign({ name: 'Collections trades', type: 'summary' }, collections),
      Object.assign({ name: 'Versum trades', type: 'summary' }, versum),
    ]
    list.forEach(e => {
      e.price_percent = price > 0 ? ((e.price / price) * 100).round(2) : 0
      e.amount_percent = amount > 0 ? ((e.amount / amount) * 100).round(2) : 0
    })

    return results.concat(list)
  }

  const ShowStats = (props) => {
    let results = buildResult(props.data)

    let regular = results.filter(e => e.type != 'custom' && e.type != 'summary')
    let summary = results.filter(e => e.type == 'summary')
    let custom = results.filter(e => e.type == 'custom')

    let total_count = 0
    let total_price = 0
    regular.forEach(e => {
      total_count += e.amount
      total_price += e.price
    })

    let custom_count = 0
    let custom_price = 0
    custom.forEach(e => {
      custom_count += e.amount
      custom_price += e.price
    })
    return (
      <>
        <h2>{props.title}</h2>
        {props.children}
        <table>
          <thead>
            <tr>
              <th>
                Type
              </th>
              <th>
                Count
              </th>
              <th>
                Percentage
              </th>
              <th>
                Total
              </th>
              <th>
                Percentage
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.map((line, index) => (
              <tr key={index}>
                <td>{line.name}</td>
                <td className='right'>{format_number(line.amount)}</td>
                <td className='right'>{format_number(line.amount_percent)} %</td>
                <td className='right'>{format_number((line.price / AppConst.HEN_DECIMALS).round(0))} tz</td>
                <td className='right'>{format_number(line.price_percent)} %</td>
              </tr>
            )
            )}
          </tbody>
          <tfoot>
            <tr>
              <th>TOTAL</th>
              <th className='right'>{format_number(total_count)}</th>
              <th></th>
              <th className='right'>{format_number((total_price / AppConst.HEN_DECIMALS).round(0))} tz</th>
              <th></th>
            </tr>
          </tfoot>
        </table>


        <table>
          <thead>
            <tr>
              <th>
                Type
              </th>
              <th>
                Count
              </th>
              <th>
                Percentage
              </th>
              <th>
                Total
              </th>
              <th>
                Percentage
              </th>
            </tr>
          </thead>
          <tbody>
            {regular.map((line, index) => (
              <tr key={index}>
                <td>{line.name}</td>
                <td className='right'>{format_number(line.amount)}</td>
                <td className='right'>{format_number(line.amount_percent)} %</td>
                <td className='right'>{format_number((line.price / AppConst.HEN_DECIMALS).round(0))} tz</td>
                <td className='right'>{format_number(line.price_percent)} %</td>
              </tr>
            )
            )}
          </tbody>
          <tfoot>
            <tr>
              <th>TOTAL</th>
              <th className='right'>{format_number(total_count)}</th>
              <th></th>
              <th className='right'>{format_number((total_price / AppConst.HEN_DECIMALS).round(0))} tz</th>
              <th></th>
            </tr>
          </tfoot>
        </table>

        <table>
          <thead>
            <tr>
              <th>
                External Collections
              </th>
              <th>
                Count
              </th>
              <th>
                Percent
              </th>
              <th>
                Total
              </th>
              <th>
                Percent
              </th>
            </tr>
          </thead>
          <tbody>
            {custom.map((line, index) => (
              <tr key={index}>
                <td>{line.name}</td>
                <td className='right'>{format_number(line.amount)}</td>
                <td className='right'>{format_number(line.amount_percent)} %</td>
                <td className='right'>{format_number((line.price / AppConst.HEN_DECIMALS).round(0))} tz</td>
                <td className='right'>{format_number(line.price_percent)} %</td>
              </tr>
            )
            )}
          </tbody>
          <tfoot>
            <tr>
              <th>TOTAL</th>
              <th className='right'>{format_number(custom_count)}</th>
              <th></th>
              <th className='right'>{format_number((custom_price / AppConst.HEN_DECIMALS).round(0))} tz</th>
              <th></th>
            </tr>
          </tfoot>
        </table>
      </>

    )
  }

  function mergeStats(stat1, stat2) {
    return {
      amount: parseInt(stat1.amount || 0) + parseInt(stat2.amount || 0),
      price: parseInt(stat1.price || 0) + parseInt(stat2.price || 0),
    }
  }

  async function getContracts() {
    if (!empty(contracts)) return contracts
    const { errors, data } = await fetchObjQL(query_custom_contracts, "qryNftBiker")
    if (empty(errors) && !empty(data?.fa)) {
      contracts = data.fa
      contracts.forEach(e => e.path = cleanPath(e.path))
    }
    else contracts = COLLECTIONS
  }

  async function fetchData(days, memoize) {
    if (days != 30 && days != 7) days = 1
    let d = new Date();
    d.setDate(d.getDate() - days);
    const { query, skip } = query_stats(contracts)
    const { errors, data } = await fetchGraphQL(query, "qryNftBiker", { "start": sql_date(d), "skip": skip })
    memoize(data)
  }

  function getStats(type) {
    if (type == 30) return monthly
    else if (type == 7) return weekly
    else return recent
  }

  async function fetchStats(type, evt) {
    if (evt) evt.preventDefault()
    loading(true)
    await getContracts()
    setCurrent(type)
    urlParams.set('type', type)
    update_current_href()
    let memoize = type == 30 ? setMonthly : (type == 7 ? setWeekly : setRecent)
    if (empty(getStats(type))) await fetchData(type, memoize)
    done()
  }

  return (
    <>
      <Head>
        <title>Marketplaces statistics</title>
      </Head>
      <div id="input">
        <h2>Marketplaces statistics</h2>
        <p>
          This tool provide some basic statistics about sales on tezos marketplaces. It only look at trades to compare the same operations on each platform (auctions data are excluded)
        </p>
      </div>
      <Result>
        <div className='block multi-btn'>
          <a href="#" onClick={e => fetchStats(1, e)} className='btn btn-secondary'>Last 24 hours</a>
          <a href="#" onClick={e => fetchStats(7, e)} className='btn btn-secondary'>Last 7 days</a>
          <a href="#" onClick={e => fetchStats(30, e)} className='btn btn-secondary'>Last 30 days</a>
        </div>
        {!empty(recent) && current == 1 && (
          <ShowStats data={recent} title='Last 24 hours' />
        )}
        {!empty(weekly) && current == 7 && (
          <ShowStats data={weekly} title='Last 7 days' />
        )}
        {!empty(monthly) && current == 30 && (
          <ShowStats data={monthly} title='Last 30 days' />
        )}
      </Result>
    </>
  )
}

Marketplace.layout = 'skip_result'