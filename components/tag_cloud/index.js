import React from 'react'
import { empty } from '../../utils/utils'
import styles from './styles.module.css'

function filterTagList(tags, exclude_tags) {
  if (empty(tags)) return []
  exclude_tags = exclude_tags.filter(t => !empty(t))

  let results = []
  for (let name of Object.keys(tags)) {
    if (exclude_tags.includes(name)) continue
    if (tags[name] <= 1) continue
    results.push({ name: name, count: tags[name] })
  }

  results = results.sort(function (a, b) {
    return b.count - a.count
  })
  let size = exclude_tags.length > 0 ? 20 : 100
  return weightedTags(results.slice(0, size))
}

function weightedTags(tags) {
  let list = tags.map(t => t.count)
  let min = Math.min(...list)
  let max = Math.max(...list)
  let step = Math.ceil((max - min) / 10)
  tags.map(t => {
    let val = parseInt(t.count)
    if (isNaN(val)) val = min
    t.weight = Math.floor((val - min) / step) + 1
  })
  tags = tags.sort(function (a, b) { return a.name.localeCompare(b.name) })
  return tags
}

export const TagCloud = (props) => {
  let tags = filterTagList(props.tags, props.exclude_tags)
  return (
    <div className={styles.tag_container}>
      {tags.map((tag, index) => {
        return (<a onClick={(e) => props.selectTag(tag.name)} className={styles.tag} key={index} href="#" data-weight={tag.weight} data-count={tag.count}>{tag.name}</a>)
      })}
    </div>
  )
}
