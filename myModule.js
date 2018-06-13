import find from 'lodash.find'
import get from 'lodash.get'
import { setCookie, clearCookie } from './cookies'

var fs = require("fs"),
    path = "/to-read";

export function readSomethingFromFileSystem(cb) {
    console.log("Reading from file system ...");
    fs.readFile(path, "utf8", cb);
}


// LOCALES
// ------------------------------------------------------------

export function findCurrentNeighborhood (locale, pathname) {
  if (!locale || !pathname) return null

  const stripQueriesPathname = pathname.split('?')[0]
  const searchGeo = /geo\?/.test(pathname)

  const neighborhood = get(locale, 'featured_neighborhoods', []).find(neighborhood => {
    if (searchGeo) {
      const isGeoPath = /geo\?/.test(neighborhood.search_path)
      if (isGeoPath) {
        const obj = geoQueryStringToQuery(neighborhood.search_path)
        const newObj = convertQueryToPointRadius(obj)
        const newUrl = `/search/geo?lat=${newObj.lat}&lng=${newObj.lng}&radius=${newObj.radius}`

        if (newUrl === pathname.replace(/(^.*radius=[0-9]*\.[0-9]*)(.*)/, (a, b) => b)) {
          return true
        }
      }
    } else {
      if (stripQueriesPathname === neighborhood.search_path) {
        return true
      }
    }
  })

  return neighborhood || null
}

export function geoQueryStringToQuery (geoString) {
  let queryObj = {}
  let arr = geoString.split('?')
  arr = arr[1].split('&')
  arr.forEach(keyPair => {
    let a = keyPair.split('=')
    queryObj[a[0]] = a[1]
  })
  return queryObj
}

export function localeFind (slug, locales) {
  return find(locales, locale => slug === locale.slug) || null
}

export function localeFindRoot (locale, locales) {
  let rootLocale = locale

  if (locale && locale.parent) {
    rootLocale = find(locales, obj => obj.slug === locale.parent) || locale
  }

  return rootLocale
}

export function localeSlugFindRoot (localeSlug, locales) {
  let rootLocaleSlug = localeSlug

  locales.some(locale => {
    if (locale.children && locale.children.some(child => child === localeSlug)) {
      rootLocaleSlug = locale.slug
      return true
    } else {
      return false
    }
  })

  return rootLocaleSlug
}

export function setLocaleCookie (slug) {
  if (!ExEnv.canUseDOM) return

  if (slug) {
    setCookie('localeSlug', slug, Infinity)
  } else {
    clearCookie('localeSlug')
  }
}

export function topLevelLocales (locales) {
  return locales.filter(locale => locale.published && !locale.parent && locale.slug !== 'national')
}

// SEARCH
// ------------------------------------------------------------

export function convertQueryToPointRadius (query) {
  const { lat_n, lat_s, lng_e, lng_w } = query
  // string to number conversion
  const latN = +lat_n
  const latS = +lat_s
  const lngE = +lng_e
  const lngW = +lng_w

  let newQuery

  if (!isNaN(latN) && !isNaN(latS) && !isNaN(lngE) && !isNaN(lngW)) {
    const newLat = Math.round((latN + latS) / 2 * 1e4) / 1e4
    const newLng = Math.round((lngE + lngW) / 2 * 1e4) / 1e4
    const newRadius = getDistanceMi(newLat, newLng, latN, lngE)

    newQuery = Object.assign({}, query, {
      lat: newLat,
      lng: newLng,
      radius: newRadius,
    })

    delete newQuery.lat_n
    delete newQuery.lat_s
    delete newQuery.lng_e
    delete newQuery.lng_w
  } else {
    newQuery = query
  }

  return newQuery
}

// META URLs (ex: /usc)
// ------------------------------------------------------------

export function findGeoInMetaRedirects (pathname, metaLocationList) {
  // strips pathname and finds redirect url for meta locations (e.g. USC)
  let metaLocationName = null

  if (typeof pathname === 'string') {
    let splitPath = null
    splitPath = pathname.split('/')
    metaLocationName = splitPath[splitPath.length - 1].toUpperCase()
  } else {
    if (typeof pathname[0] === 'string') {
      metaLocationName = pathname[0].toUpperCase()
    }
  }

  const redirectMatch = metaLocationList.find(items => items.path === metaLocationName)

  return redirectMatch
}

// NEAR ME
// ------------------------------------------------------------

export function whereAmI () {
  return new Promise((resolve, reject) => {
    if (ExEnv.canUseDOM && navigator.geolocation) {
      // device can return its location
      navigator.geolocation.getCurrentPosition(position => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      }, positionError => {
        reject(positionError)
      })
    } else {
      reject('geolocation not available')
    }
  })
}

export function degToRad (degrees) {
  return degrees * Math.PI / 180
}

export function derivedLocale (locales, listingOrSearchResult = {}, subLocales = null) {
  const lat = listingOrSearchResult.lat || null
  const lng = listingOrSearchResult.lng || null
  let subLocale = null

  if (!lng || !lat || !locales || !locales.length) return null

  const point = [lng, lat]

  let cityStateMatchedLocale = find(locales, {slug: listingOrSearchResult.cityStateSlug})

  if (cityStateMatchedLocale && !cityStateMatchedLocale.children && cityStateMatchedLocale.published) {
    return cityStateMatchedLocale
  } else if (cityStateMatchedLocale && cityStateMatchedLocale.children && cityStateMatchedLocale.published) {
    const subs = subLocales || locales.filter(loc => {
      return loc.parent && (loc.parent === cityStateMatchedLocale.slug)
    })

    subLocale = findSublocaleByFeaturedNeighborhood(cityStateMatchedLocale, subs, listingOrSearchResult)
    if (subLocale) { return subLocale }
  } else {
    cityStateMatchedLocale = null
  }

  const geographicallyIntersectingLocale = find(locales, locale => {
    if (!locale.published) return null

    const polygon = locale.bounds ? locale.bounds.coordinates : []
    return pointIsInPolygon(point, polygon)
  })

  return cityStateMatchedLocale || geographicallyIntersectingLocale || null
}

export function getDistanceKm (lat1, lng1, lat2, lng2) {
  //
  // Haversine Formula - spherical distance between two points
  // from https://rosettacode.org/wiki/Haversine_formula
  //

  var R = 6372.8 // Earth’s mean radius in km

  var lat1Rad = degToRad(lat1)
  var lng1Rad = degToRad(lng1)
  var lat2Rad = degToRad(lat2)
  var lng2Rad = degToRad(lng2)

  var deltaLat = lat2Rad - lat1Rad
  var deltaLng = lng2Rad - lng1Rad

  var a = Math.pow(Math.sin(deltaLat / 2), 2) + Math.pow(Math.sin(deltaLng / 2), 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad)
  var c = 2 * Math.asin(Math.sqrt(a))

  return Math.round(R * c * 1e4) / 1e4 // distance in kilometers to 4 decimal places
}
export function getDistanceMi (lat1, lng1, lat2, lng2) {
  return Math.round(getDistanceKm(lat1, lng1, lat2, lng2) * 0.62137 * 1e4) / 1e4 // km to mi conversion to 4 decimal places
}

export function pointIsInPolygon (point, polygonCoords) {
  // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

  // arguments must be in geoJSON format
  // point => [lng, lat]
  // polygonCoords => [
  //   [[],[],[]] <= first array is the "external ring" of points
  //   [[],[],[]] <= subsequent arrays represent "internal rings" (holes)
  // ]

  const x = point[0]
  const y = point[1]
  const externalRing = polygonCoords[0]

  let isInside = false

  for (let i = 0, j = externalRing.length - 1; i < externalRing.length; j = i++) {
    const xi = externalRing[i][0], yi = externalRing[i][1]
    const xj = externalRing[j][0], yj = externalRing[j][1]

    const intersect = ((yi > y) != (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi)

    if (intersect) isInside = !isInside
  }

  return isInside
}

function findSublocaleByFeaturedNeighborhood (parentLocale, subs, searchListingObject) {
  const subLocale = subs.reduce((prev, item) => {
    if (!item.featured_neighborhoods) return null
    const foundNeighborhood = item.featured_neighborhoods.find(
      (neighborhood) => { return neighborhood.search_path === searchListingObject.doorstepsUrl }
    )
    return foundNeighborhood ? item : prev
  }, null)

  return subLocale
}
