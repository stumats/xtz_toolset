import React, { useEffect, useState } from 'react';
import Head from 'next/head'
import { Home } from '../../components/home';
import { Result } from '../../components/result'
import * as AppConst from '../../utils/constants'
import {
  empty, showError, fetchGraphQL, urlParams, update_current_href,
} from '../../utils/utils'
import Form from 'react-bootstrap/Form'
import { CopyTable } from '../../components/copy_table'
import { buildStatMenu } from '../../utils/menu';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const query_stats = `
query qryNftBiker($date: date!) {
  marketplace_stats(where: {buy_on: {_gte: $date}}, order_by: {buy_on: asc}) {
    buy_on
    platform
    primary_swap
    sales_total
    sales_count
  }
}
`

const MarketChart = (props) => {
  let data = props.data
  let max = empty(props.max) ? null : props.max
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      title: {
        display: true,
        text: props.title,
        font: {
          size: 24
        },
      },
    },
    scales: {
      x: {
        offset: true,
        stacked: true,
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        suggestedMax: max,
        ticks: { suggestedMin: 0 },
        title: {
          display: true,
          text: 'XTZ',
        }
      },
    },
  }

  const labels = data.map(e => e.date)
  const chart_data = {
    labels,
    datasets: [
      {
        type: 'line',
        label: 'Primary sales',
        data: data.map(e => e.primary_sales.round(0)),
        borderColor: '#1b9e77',
        backgroundColor: '#1b9e77',
        fill: false,
        yAxisID: 'y',
      },
      {
        type: 'line',
        label: 'Secondary sales',
        data: data.map(e => e.secondary_sales.round(0)),
        borderColor: '#d95f02',
        backgroundColor: '#d95f02',
        fill: false,
        yAxisID: 'y',
      },
    ],
  };


  return (
    <Line options={options} data={chart_data} />
  )
}

export default function PageContent() {
  const [globalData, setGlobalData] = useState()
  const [globalSales, setGlobalSales] = useState(false)
  const [henSales, setHenSales] = useState(false)
  const [objSales, setObjSales] = useState(false)
  const [customObjSales, setCustomObjSales] = useState(false)
  const [versumSales, setVersumSales] = useState(false)
  const [customVersumSales, setCustomVersumSales] = useState(false)
  const [maxY, setMaxY] = useState(null)
  const [filters, setFilters] = useState({
    normalizedY: false,
    excludeToday: false
  })

  const ToggleNormalizedAxis = () => {
    let checkbox = document.getElementById("normalize_axis")
    let val = checkbox && checkbox.checked ? maxY : null
    val ? urlParams.set("normalize_axis", true) : urlParams.delete("normalize_axis")
    update_current_href()
    setFilters({ normalizedY: val, excludeToday: filters.excludeToday })
  }

  const ToggleToday = () => {
    let checkbox = document.getElementById("exclude_today")
    let val = checkbox && checkbox.checked ? true : false
    val ? urlParams.set("exclude_today", true) : urlParams.delete("exclude_today")
    update_current_href()
    setFilters({ excludeToday: val, normalizedY: filters.normalizedY })
  }

  function buildResults(data, platform) {
    let result = {}
    let skip = true
    let min_date = new Date()
    min_date.setMonth(min_date.getMonth() - 6)
    min_date.setDate(1)
    min_date.setHours(0)
    min_date.setMinutes(0)
    min_date.setSeconds(0)
    min_date.setMilliseconds(0)

    for (let entry of data) {
      if (skip) {
        if (entry.sales_count == 0) continue
        if (platform != 'all' && new Date(entry.buy_on) < min_date) continue
      }

      skip = false
      if (empty(result[entry.buy_on])) result[entry.buy_on] = {
        date: entry.buy_on,
        primary_sales: 0,
        primary_count: 0,
        secondary_sales: 0,
        secondary_count: 0,
      }

      if (platform == 'all' || platform == entry.platform) {
        if (entry.primary_swap) {
          result[entry.buy_on].primary_count += entry.sales_count
          result[entry.buy_on].primary_sales += entry.sales_total / AppConst.HEN_DECIMALS
        }
        else {
          result[entry.buy_on].secondary_count += entry.sales_count
          result[entry.buy_on].secondary_sales += entry.sales_total / AppConst.HEN_DECIMALS
        }
      }
    }
    result = Object.values(result)
    if (filters.excludeToday) result.pop()
    return result
  }

  async function loadData() {
    let d = new Date();
    let min_date = `${d.getFullYear() - 1}-${d.getMonth() + 1}-${d.getDate()}`

    const { errors, data } = await fetchGraphQL(query_stats, "qryNftBiker", { "date": min_date });
    if (errors) return showError(errors);
    setGlobalData(data.marketplace_stats)
  }

  useEffect(() => {
    let data = filters
    let val = urlParams.get("normalize_axis")
    if (val) {
      document.getElementById("normalize_axis").checked = true
      data.normalizedY = true
    }

    val = urlParams.get("exclude_today")
    if (val) {
      document.getElementById("exclude_today").checked = true
      data.excludeToday = true
    }
    setFilters(data)
    loadData()
    buildStatMenu()
  }, [])

  useEffect(() => {
    if (empty(globalData)) return

    let result = buildResults(globalData, 'all')
    setGlobalSales(result)

    let values = []

    result = buildResults(globalData, 'hen')
    values = values.concat(result.map(e => e.primary_sales).concat(result.map(e => e.secondary_sales)).filter(e => e))
    setHenSales(result)

    result = buildResults(globalData, 'bid')
    values = values.concat(result.map(e => e.primary_sales).concat(result.map(e => e.secondary_sales)).filter(e => e))
    setObjSales(result)

    result = buildResults(globalData, 'custom_bid')
    values = values.concat(result.map(e => e.primary_sales).concat(result.map(e => e.secondary_sales)).filter(e => e))
    setCustomObjSales(result)

    result = buildResults(globalData, 'versum')
    values = values.concat(result.map(e => e.primary_sales).concat(result.map(e => e.secondary_sales)).filter(e => e))
    setVersumSales(result)

    result = buildResults(globalData, 'custom_versum')
    values = values.concat(result.map(e => e.primary_sales).concat(result.map(e => e.secondary_sales)).filter(e => e))
    setCustomVersumSales(result)

    let max = Math.max(...values)
    setMaxY(max)
    if (filters.normalizedY === true) setFilters({ normalizedY: max, excludeToday: filters.excludeToday })
  }, [globalData, filters])

  return (
    <div id="input" className='block'>
      <Head>
        <title>Markets stats</title>
      </Head>
      <h2>Markets stats</h2>

      <Result>

        <div className='sticky block pt-3'>
          <Form.Check
            inline
            type="switch"
            id="normalize_axis"
            label="Normalize Y Axis for the charts below (i.e. use the same Y maximum for all graphs)"
            className="secondary"
            onClick={ToggleNormalizedAxis}
          />

          <Form.Check
            inline
            type="switch"
            id="exclude_today"
            label="Exclude partial data for today"
            className="secondary"
            onClick={ToggleToday}
          />
        </div>


        {globalSales && (
          <>
            {globalData && (
              <CopyTable id="sales" filename='sales' data={globalData} />
            )}

            <div style={{ height: '500px' }}>
              <MarketChart data={globalSales} title="All Tezos NFT sales (last 12 months)" />
            </div>
          </>
        )}
        {henSales && (
          <div style={{ height: '500px' }}>
            <MarketChart data={henSales} max={filters.normalizedY} title="HEN minted NFT sales (last 6 months)" />
          </div>
        )}
        {objSales && (
          <div style={{ height: '500px' }}>
            <MarketChart data={objSales} max={filters.normalizedY} title="OBJKT collections sales (last 6 months)" />
          </div>
        )}
        {customObjSales && (
          <div style={{ height: '500px' }}>
            <MarketChart data={customObjSales} max={filters.normalizedY} title="OBJKT custom contracts sales (last 6 months)" />
          </div>
        )}
        {versumSales && (
          <div style={{ height: '500px' }}>
            <MarketChart data={versumSales} max={filters.normalizedY} title="VERSUM minted NFT sales (last 6 months)" />
          </div>
        )}
        {customVersumSales && (
          <div style={{ height: '500px' }}>
            <MarketChart data={customVersumSales} max={filters.normalizedY} title="VERSUM custom contracts sales (last 6 months)" />
          </div>
        )}
      </Result>
    </div >
  )
}

PageContent.layout = 'skip_result'