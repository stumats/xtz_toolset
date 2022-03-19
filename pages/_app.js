/* eslint-disable react-hooks/exhaustive-deps */
// lux, simplex, litera
import "bootswatch/dist/darkly/bootstrap.min.css";
import '../styles/app.css'

import Layout from '../components/layout'

import { empty } from '../utils/utils'

import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'
library.add(fas)
import { fab } from '@fortawesome/free-brands-svg-icons'
library.add(fab)

// dark mode
function MyApp({ Component, pageProps }) {
  const selected_layout = empty(Component.layout) ? '' : Component.layout
  if (selected_layout == 'home') {
    return (
      <Component {...pageProps} />
    )
  }
  else {
    return (
      <Layout selected_layout={selected_layout}>
        <Component {...pageProps} />
      </Layout>
    )
  }
}

export default MyApp