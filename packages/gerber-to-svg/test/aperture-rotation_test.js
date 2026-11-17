/* eslint-env es2017 */
'use strict'

var expect = require('chai').expect
var parser = require('../../gerber-parser')
var plotter = require('../../gerber-plotter')
var gerberToSvg = require('..')

var header = '%FSLAX26Y26*%\n%MOMM*%\n'
var rectangle = '%ADD10R,2X0.4*%\nD10*\n'

function collect(stream, input) {
  return new Promise(function(resolve, reject) {
    var chunks = []
    stream.on('data', function(chunk) {
      chunks.push(chunk)
    })
    stream.on('error', reject)
    stream.on('end', function() {
      resolve(chunks)
    })
    stream.end(input)
  })
}

function plotSource(source) {
  return new Promise(function(resolve, reject) {
    var chunks = []
    var p = parser()
    var output = plotter()
    p.on('error', reject)
    output.on('error', reject)
    output.on('data', function(chunk) {
      chunks.push(chunk)
    })
    output.on('end', function() {
      resolve(chunks)
    })
    p.pipe(output)
    p.end(source)
  })
}

function svg(source) {
  return new Promise(function(resolve, reject) {
    gerberToSvg(source, {id: 'rotation'}, function(error, result) {
      if (error) reject(error)
      else resolve(result)
    })
  })
}

describe('Gerber LR aperture rotation', function() {
  it('parses signed and fractional rotation and an explicit reset', async function() {
    var chunks = await collect(
      parser({filetype: 'gerber'}),
      '%LR45*%%LR-30.5*%%LR.25*%%LR+360*%%LR0*%'
    )
    expect(
      chunks.map(function(c) {
        return [c.type, c.prop, c.value]
      })
    ).to.eql([
      ['set', 'rotation', 45],
      ['set', 'rotation', -30.5],
      ['set', 'rotation', 0.25],
      ['set', 'rotation', 360],
      ['set', 'rotation', 0],
    ])
  })

  it('persists across flashes and tool changes, then resets without moving coordinates', async function() {
    var source =
      header +
      rectangle +
      '%ADD11O,2X0.4*%\nD10*\n' +
      '%LR45*%\nX2000000Y3000000D03*\nX4000000Y3000000D03*\n' +
      'D11*\nX6000000Y3000000D03*\n%LR0*%\nX8000000Y3000000D03*\nM02*'
    var chunks = await plotSource(source)
    var pads = chunks.filter(function(c) {
      return c.type === 'pad'
    })
    expect(
      pads.map(function(p) {
        return [p.x, p.y, p.rotation || 0]
      })
    ).to.eql([
      [2, 3, 45],
      [4, 3, 45],
      [6, 3, 45],
      [8, 3, 0],
    ])
    var rendered = await svg(source)
    expect(rendered).to.contain('rotate(45 2000 3000)')
    expect(rendered).to.contain('rotate(45 4000 3000)')
    expect(rendered).to.contain('rotate(45 6000 3000)')
    expect(rendered).not.to.contain('rotate(45 8000 3000)')
  })
  ;[45, 90, -30, 450].forEach(function(rotation) {
    it(
      'bounds a translated aperture at ' + rotation + ' degrees',
      async function() {
        var chunks = await plotSource(
          header +
            rectangle +
            '%LR' +
            rotation +
            '*%\nX2000000Y3000000D03*\nM02*'
        )
        var box = chunks.find(function(c) {
          return c.type === 'size'
        }).box
        var angle = (rotation * Math.PI) / 180
        var dx = Math.abs(Math.cos(angle)) + 0.2 * Math.abs(Math.sin(angle))
        var dy = Math.abs(Math.sin(angle)) + 0.2 * Math.abs(Math.cos(angle))
        ;[2 - dx, 3 - dy, 2 + dx, 3 + dy].forEach(function(value, i) {
          expect(box[i]).to.be.closeTo(value, 1e-10)
        })
      }
    )
  })

  it('rotates a macro as a whole, including its clear primitive', async function() {
    var macro =
      '%AMHOLED*21,1,2,0.4,0,0,0*1,0,0.2,0.5,0,0*%\n%ADD10HOLED*%\nD10*\n'
    var rendered = await svg(
      header + macro + '%LR45*%\nX2000000Y3000000D03*\nM02*'
    )
    expect(rendered).to.contain('rotate(45 2000 3000)')
    expect(rendered).to.contain('mask=')
    expect(rendered).to.contain('cx="500"')
  })

  it('does not rotate region coordinates or circular interpolation paths', async function() {
    var source =
      header +
      '%ADD10C,0.2*%\nD10*\n%LR45*%\nG01*\n' +
      'X1000000Y1000000D02*\nX2000000Y1000000D01*\nG36*\n' +
      'X3000000Y3000000D02*\nX4000000Y3000000D01*\nX4000000Y4000000D01*\nX3000000Y3000000D01*\nG37*\nM02*'
    var chunks = await plotSource(source)
    var stroke = chunks.find(function(c) {
      return c.type === 'stroke'
    })
    expect(stroke.path[0]).to.eql({type: 'line', start: [1, 1], end: [2, 1]})
    var fill = chunks.find(function(c) {
      return c.type === 'fill'
    })
    expect(fill.path[0].start).to.eql([3, 3])
  })

  it('rotates the rectangular interpolation aperture while keeping the path fixed', async function() {
    var source =
      header +
      rectangle +
      '%LR90*%\nG01*\nX1000000Y2000000D02*\nX3000000Y2000000D01*\nM02*'
    var chunks = await plotSource(source)
    var box = chunks.find(function(c) {
      return c.type === 'size'
    }).box
    ;[0.8, 1, 3.2, 3].forEach(function(value, i) {
      expect(box[i]).to.be.closeTo(value, 1e-10)
    })
    expect(
      chunks.find(function(c) {
        return c.type === 'fill'
      }).path.length
    ).to.be.at.least(4)
  })
})
