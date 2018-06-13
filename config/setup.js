require('dotenv').config({silent: true})
require('./dom')

// const React = require('react').default
const { configure } = require('enzyme')
const Adapter = require('enzyme-adapter-react-16')

configure({ adapter: new Adapter() })
