// // https://github.com/airbnb/enzyme/blob/master/docs/guides/jsdom.md

const { JSDOM } = require('jsdom')

// // setup the simplest document possible
const doc = new JSDOM('<!doctype html><html><body></body></html>')

// // get the window object out of the document
const { window } = doc

function copyProps (src, target) {
  const props = Object.getOwnPropertyNames(src)
    .filter(prop => typeof target[prop] === 'undefined')
    .map(prop => Object.getOwnPropertyDescriptor(src, prop))
  Object.defineProperties(target, props)
}

global.window = window
global.document = window.document
global.HTMLElement = window.HTMLElement
global.navigator = {
  userAgent: 'node.js',
}
// copyProps(window, global)

// // stub for react-slick
// // https://github.com/akiran/react-slick/issues/348
window.matchMedia = window.matchMedia || function () {
  return {
    matches: false,
    addListener: () => {},
    removeListener: () => {},
  }
}

window.localStorage = storageMock()

// https://stackoverflow.com/questions/11485420/how-to-mock-localstorage-in-javascript-unit-tests
function storageMock () {
  let storage = {}

  return {
    setItem: (key, value) => {
      storage[key] = value || ''
    },
    getItem: key => {
      return key in storage ? storage[key] : null
    },
    removeItem: key => {
      delete storage[key]
    },
    get length () {
      return Object.keys(storage).length
    },
    key: i => {
      const keys = Object.keys(storage)
      return keys[i] || null
    },
    clear: () => {
      storage = {}
    },
  }
}
