export function objkt_bookmarklet(title, url) {
  if (url.match(/[?]/)) url += '&token_id='
  else url += '?token_id='
  let txt = `
  javascript:(function(){
    m = window.location.href.match(/(o|objkt|hicetnunc)\\/([0-9]+)/im);
    if (m) { window.open('${url}'+m[2]); return}
    m = window.location.href.match(/asset\\/([^\\/]+)\\/([0-9]+)/im);
    if (m) { window.open('${url}'+m[1]+'_'+m[2])}
    m = window.location.href.match(/versum\\/([0-9]+)/im);
    if (m) { window.open('${url}versum_'+m[1])}
  })()
  `
  txt = txt.replace(/[\r\n\s]+/img, '');
  let div = document.getElementById("bookmarklet") || document.getElementById("bookmarklet_alt")
  if (div) {
    div.innerHTML = `
      Drag & Drop this <a href="${txt}" title="${title}">${title}</a> link on your bookmarks toolbar to access to this page from a marketplace token display page.
    `
    div.style.display = 'block'
    if (div.id == 'bookmarklet') {
      div = document.getElementById("bookmarklet_alt")
      if (div) {
        div.innerHTML = ''
        div.style.display = 'none'
      }
    }
  }
}
