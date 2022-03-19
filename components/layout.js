import { Footer } from './footer'
import { Result } from '../components/result'
import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

export default function Layout({ children, selected_layout }) {
  let with_result = selected_layout != 'skip_result'

  if (selected_layout == "wrapped") {
    return (
      <>
        <Container id="wrapper" fluid>
          {children}
        </Container>
        <div id="push"></div>
        <Footer />
      </>
    )
  }
  else {
    return (
      <>
        <Container id="wrapper" fluid>
          {children}
          {with_result && (<Result />)}
        </Container>
        <div id="push"></div>
        <Footer />
      </>
    )
  }
}
