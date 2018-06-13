import expect from 'expect'
import rewire from 'rewire'
import { assert } from 'chai'
import {
  convertQueryToPointRadius,
  localeFind,
  localeFindRoot,
  topLevelLocales,
  degToRad,
  derivedLocale,
  getDistanceKm,
  getDistanceMi,
  pointIsInPolygon,
} from './geo'

const rewiredGeo = rewire('./geo')
const rewirePointIsInPolygon = pointIsInPolygon
let revert

describe('degToRad', () => {
  it('converts 60º to π/3', () => {
    expect(degToRad(60)).toBe(Math.PI / 3)
  })
  it('converts 90º to π/2', () => {
    expect(degToRad(90)).toBe(Math.PI / 2)
  })
  it('converts 360º to 2π', () => {
    expect(degToRad(360)).toBe(2 * Math.PI)
  })
})

describe('getDistanceKm', () => {
  it('calculates distance and rounds to 4 decimal places cutting off zeros', () => {
    var bnaToLax = 2887.26 // from https://rosettacode.org/wiki/Haversine_formula
    expect(getDistanceKm(36.12, -86.67, 33.94, -118.40)).toBe(bnaToLax)
  })
})
describe('getDistanceMi', () => {
  var bnaToLax = Math.round(2887.2599506071124 * 0.62137 * 1e4) / 1e4 // km to mi conversion
  expect(getDistanceMi(36.12, -86.67, 33.94, -118.40)).toBe(bnaToLax)
})

describe('derivedLocale', () => {
  it('returns false with null point', () => {
    const searchObject = {
      lat: null,
      lng: null,
      bounds: [[[0, 0], [0, 2], [2, 2], [2, 0]]],
    }
    const locales = []

    expect(derivedLocale(locales, searchObject)).toBe(null)
  })

  it('returns false with null locales', () => {
    const searchObject = {
      lat: 1.2,
      lng: 2.3,
      bounds: [[[0, 0], [0, 2], [2, 2], [2, 0]]],
    }
    const locales = null

    expect(derivedLocale(locales, searchObject)).toBe(null)
  })

  it('returns false with empty locales', () => {
    const searchObject = {
      lat: 1.2,
      lng: 2.3,
      bounds: [[[0, 0], [0, 2], [2, 2], [2, 0]]],
    }
    const locales = []

    expect(derivedLocale(locales, searchObject)).toBe(null)
  })

  describe.only('search object', () => {
    beforeEach(() => {
      console.log('rewiredGeo', rewiredGeo)
      revert = rewiredGeo.__set__('rewirePointIsInPolygon', expect.createSpy())
      // GeoRewireAPI.__Rewire__('pointIsInPolygon', expect.createSpy())
    })
    afterEach(() => {
      // GeoRewireAPI.__ResetDependency__('pointIsInPolygon')
      revert()
    })

    it('returns locale when cityStateSlug matches locale and locale has parent/is published', () => {
      const searchObject = {
        lat: 1.2,
        lng: 2.3,
        cityStateSlug: 'atlanta-ga',
      }
      const foundLocale = {
        slug: 'atlanta-ga',
        parent: 'some-locale',
        published: true,
      }
      const locales = [foundLocale, {}, {}]

      expect(derivedLocale(locales, searchObject)).toBe(foundLocale)
    })

    it('returns null when cityStateSlug matches locale but locale.published is false', () => {
      const searchObject = {
        lat: 1.2,
        lng: 2.3,
        cityStateSlug: 'atlanta-ga',
      }
      const foundLocale = {
        slug: 'atlanta-ga',
        parent: 'some-locale',
        published: false,
      }
      const locales = [foundLocale, {}, {}]

      expect(derivedLocale(locales, searchObject)).toBe(null)
    })
  })

  describe('listing object ', () => {
    it('returns locale if published and polygon intersects listing polygon', () => {
      const listingObject = {
        lat: 1.2,
        lng: 1.8,
      }
      const ourBounds = {
        type: 'Polygon',
        coordinates: [[[0, 0], [0, 2], [2, 2], [2, 0]]],
      }
      const foundLocale = { bounds: ourBounds, published: true }
      const locales = [foundLocale, {}, {}]
      expect(derivedLocale(locales, listingObject)).toBe(foundLocale)
    })

    it('returns null if locale is unpublished', () => {
      const listingObject = {
        lat: 1.2,
        lng: 1.8,
      }
      const ourBounds = {
        type: 'Polygon',
        coordinates: [[[0, 0], [0, 2], [2, 2], [2, 0]]],
      }
      const foundLocale = { bounds: ourBounds, published: false }
      const locales = [foundLocale, {}, {}]
      expect(derivedLocale(locales, listingObject)).toBe(null)
    })
  })
})

describe('pointIsInPolygon', () => {
  describe('simple polygon with no interior rings (holes)', () => {
    it('returns true for interior point', () => {
      const point = [1, 1]
      const poly = [[[0, 0], [0, 2], [2, 2], [2, 0]]]

      expect(pointIsInPolygon(point, poly)).toBe(true)
    })

    it('returns false for exterior point', () => {
      const point = [3, 3]
      const poly = [[[0, 0], [0, 2], [2, 2], [2, 0]]]

      expect(pointIsInPolygon(point, poly)).toBe(false)
    })
  })
})

describe('localeFind', () => {
  it('finds an object in an array where its slug attribute matches a given string', () => {
    const objArray = [{}, {slug: 'foo'}, {slug: 'bar'}]
    const foundObj = localeFind('foo', objArray)

    assert.deepEqual(foundObj, objArray[1], 'expected object not found')
  })

  it('returns null if object with matching slug is not found', () => {
    const objArray = [{}, {slug: 'foo'}, {slug: 'bar'}]
    const foundObj = localeFind('baz', objArray)

    assert.isNull(foundObj)
  })
})

describe('localeFindRoot', () => {
  it("finds an object in an array where its slug attribute matches given object's parent", () => {
    const obj = {parent: 'bar'}
    const objArray = [{}, {slug: 'foo'}, {slug: 'bar'}]
    const foundObj = localeFindRoot(obj, objArray)

    assert.equal(foundObj, objArray[2], 'expected object not found')
  })

  it('returns obj if parent is null', () => {
    const obj = {parent: null}
    const objArray = [{}, {slug: 'foo'}, {slug: 'bar'}]
    const foundObj = localeFindRoot(obj, objArray)

    assert.equal(obj, foundObj)
  })

  it('returns obj if slug matching parent is not found', () => {
    const obj = {parent: 'baz'}
    const objArray = [{}, {slug: 'foo'}, {slug: 'bar'}]
    const foundObj = localeFindRoot(obj, objArray)

    assert.equal(obj, foundObj)
  })

  it('returns null if given object is null', () => {
    const objArray = [{}, {slug: 'foo'}, {slug: 'bar'}]
    const foundObj = localeFindRoot(null, objArray)

    assert.isNull(foundObj)
  })
})

describe('topLevelLocales', () => {
  it('removes locales with parents', () => {
    const allLocales = [{published: true}, {published: true}, {published: true, parent: 'foo'}]
    const expectedLocales = [{published: true}, {published: true}]

    assert.deepEqual(expectedLocales, topLevelLocales(allLocales))
  })

  it('removes unpublished locales', () => {
    const allLocales = [{published: true}, {published: false}, {published: true, parent: 'foo'}]
    const expectedLocales = [{published: true}]

    assert.deepEqual(expectedLocales, topLevelLocales(allLocales))
  })
})

describe('convertQueryToPointRadius', () => {
  it('return a new object with old params converted to lat, lng, and radius', () => {
    const queryParams = {
      lat_n: '6',
      lat_s: '0',
      lng_e: '0',
      lng_w: '8',
    }

    const convertedQuery = convertQueryToPointRadius(queryParams)

    assert.deepEqual(convertedQuery, {lat: 3, lng: 4, radius: 344.8562})
  })

  it('correctly converts negative lng values (west of the prime meridian)', () => {
    // lat_n=32.04001299672086&lng_w=-101.48406077392576&lat_s=27.087776222809286&lng_e=-95.43608714111326
    const queryParams = {
      lat_n: '80',
      lat_s: '20',
      lng_e: '-20',
      lng_w: '-100',
    }
    const convertedQuery = convertQueryToPointRadius(queryParams)
    assert.deepEqual(convertedQuery, {lat: 50, lng: -60, radius: 2271.6809})
  })

  it('returns same query object if old geo params are not present', () => {
    const queryParams = {}
    const convertedQuery = convertQueryToPointRadius(queryParams)
    assert.deepEqual(convertedQuery, queryParams)
  })
})
