
import React from 'react'
import { Loading } from '../loading'

export const Result = (props) => {
  return (
    <>
      <Loading />
      <div id="result" className='block'>
        {props.children}
      </div>
    </>
  )
}
