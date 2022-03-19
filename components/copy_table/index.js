
import React from 'react';
import { empty } from '../../utils/utils'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export class CopyTable extends React.Component {

  constructor(props) {
    super(props)
  }

  downloadCsv(csv, filename) {
    var csvFile;
    var downloadLink;

    // CSV FILE
    csvFile = new Blob([csv], { type: "text/csv" });
    // Download link
    downloadLink = document.createElement("a");
    // File name
    downloadLink.download = filename;
    // We have to create a link to the file
    downloadLink.href = window.URL.createObjectURL(csvFile);
    // Make sure that the link is not displayed
    downloadLink.style.display = "none";
    // Add the link to your DOM
    document.body.appendChild(downloadLink);
    // Lanzamos
    downloadLink.click();
  }

  prepareDataForCsv() {
    if (empty(this.props.data)) return
    let headers = null
    let results = []
    for (let entry of this.props.data) {
      if (!headers) headers = Object.keys(entry)
      results.push(Object.values(entry))
    }
    return [headers].concat(results)
  }

  exportTableToCsv(evt) {
    if (evt) evt.preventDefault()
    var csv = [];
    let table_id = empty(this.props.table_id) ? this.props.id : this.props.table_id
    let filename = empty(this.props.filename) ? table_id : this.props.filename

    if (this.props.data) {
      let data = this.prepareDataForCsv(this.props.data)
      csv = data.map(line => '"' + line.join('","') + '"')
    }
    else {

      var rows = document.querySelectorAll("#" + table_id + " tr:not([style='display:none'])")
      for (var i = 0; i < rows.length; i++) {
        var row = [], cols = rows[i].querySelectorAll("td,th")
        for (var j = 0; j < cols.length; j++) {
          let item = cols[j]
          if (item.classList.contains('nocsv')) continue

          let txt = null
          let time = item.querySelector(".timeago")
          if (time && !empty(time.title)) {
            txt = time.title.replace(/[,;]+/g, '')
          }
          if (empty(txt)) txt = item.textContent
          if (item.classList.contains('currency')) txt = txt.replace(/(tz\s*)$/i, '')

          row.push(txt.replace(/"/gi, '""').trim())
        }
        csv.push('"' + row.join('","') + '"');
      }
    }

    if (!filename.match(/\.csv$/i)) filename += '.csv'
    // Download CSV
    this.downloadCsv(csv.join("\n"), filename);
  }

  render() {
    let kls = empty(this.props.style) ? '' : this.props.style
    return (<>
      <div id={this.props.id} className={`with_csv ${kls}`.trim()}>
        <a href="#" className="download_csv" onClick={(e) => this.exportTableToCsv(e)}>
          <FontAwesomeIcon icon='download' />
          &nbsp; CSV
        </a>
        {this.props.children}
      </div>
    </>
    )
  }
}
