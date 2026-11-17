// creates the SVG for a pad flash
'use strict'

var util = require('./_util')
var shift = util.shift

module.exports = function flashPad(prefix, tool, x, y, element, rotation) {
  var toolId = '#' + prefix + '_pad-' + tool
  var attributes = {'xlink:href': toolId, x: shift(x), y: shift(y)}
  // Rotate the entire aperture (including macro clear regions) about its flash
  // point. The flash coordinates themselves are never rotated about the origin.
  if (rotation) {
    attributes.transform =
      'rotate(' + rotation + ' ' + shift(x) + ' ' + shift(y) + ')'
  }
  return element('use', attributes)
}
