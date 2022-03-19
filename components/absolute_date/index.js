
import React from 'react'
import $ from 'jquery'
import { add_timeago } from '../../utils/utils';
import Form from 'react-bootstrap/Form'
var absoluteTime = false

export const isAbsoluteDate = () => {
  return absoluteTime ? true : false
}

export const AbsoluteDate = () => {
  const handleClick = (e) => {
    absoluteTime = !absoluteTime;
    if (absoluteTime) {
      $(".timeago").each(function () {
        let txt = $(this).attr("title");
        let ago = $(this).html();
        $(this).html(`<span title="${ago}">${txt}</span>`);
      })
      $("tr").off('mouseenter mouseleave');
    }
    else {
      $(".timeago").each(function () {
        $(this).removeClass('disabled')
        let txt = $(this).find("span").last().attr('title')
        $(this).find("span").last().remove();
        $(this).html(txt);
      })
      add_timeago();
    }
  }

  return (
    <Form.Check
      inline
      type="switch"
      id="absolute_date"
      label="Show absolute date"
      className="secondary"
      onClick={handleClick}
    />
  )
}
