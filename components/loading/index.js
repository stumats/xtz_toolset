import React from 'react'

export const Loading = () => {
  return (
    <>
      <div id="bookmarklet_alt" className='block' style={{ display: 'none' }}></div>
      <div id="loading" className='block blink hidden'>
        <b>Loading infos ... can take a few seconds if there are a lot of data to process</b>
      </div>
      <div id="error" className='block' style={{ display: 'none' }}></div>
    </>
  )
}
