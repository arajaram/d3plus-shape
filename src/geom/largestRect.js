import {extent, range} from "d3-array";
import {polygonArea, polygonCentroid} from "d3-polygon";

import {default as pointInPoly} from "./pointInPoly";
import {default as polyInPoly} from "./polyInPoly";
import {default as rayIntersectsPoly} from "./rayIntersectsPoly";
import {default as rotatePoly} from "./rotatePoly";
import {default as simplify} from "./simplify";
import {default as squaredDistance} from "./squaredDistance";

// Algorithm constants
const aspectRatioStep = 0.5; // step size for the aspect ratio
const angleStep = 5; // step size for angles (in degrees); has linear impact on running time

/**
    @typedef {Object} LargestRect
    @desc The returned Object of the largestRect function.
    @property {Number} width The width of the rectangle
    @property {Number} height The height of the rectangle
    @property {Number} cx The x coordinate of the rectangle's center
    @property {Number} cy The y coordinate of the rectangle's center
    @property {Number} angle The rotation angle of the rectangle in degrees. The anchor of rotation is the center point.
    @property {Number} area The area of the largest rectangle.
    @property {Array} points An array of x/y coordinates for each point in the rectangle, useful for rendering paths.
*/

/**
    @function largestRect
    @desc An angle of zero means that the longer side of the polygon (the width) will be aligned with the x axis. An angle of 90 and/or -90 means that the longer side of the polygon (the width) will be aligned with the y axis. The value can be a number between -90 and 90 specifying the angle of rotation of the polygon, a string which is parsed to a number, or an array of numbers specifying the possible rotations of the polygon.
    @param {Array} poly An Array of points that represent a polygon.
    @param {Object} [options] An Object that allows for overriding various parameters of the algorithm.
    @param {Number|String|Array} [options.angle = d3.range(-90, 95, 5)] The allowed rotations of the final rectangle.
    @param {Number|String|Array} [options.aspectRatio] The ratio between the width and height of the rectangle. The value can be a number, a string which is parsed to a number, or an array of numbers specifying the possible aspect ratios of the final rectangle.
    @param {Number} [options.maxAspectRatio = 15] The maximum aspect ratio (width/height) allowed for the rectangle. This property should only be used if the aspectRatio is not provided.
    @param {Number} [options.minAspectRatio = 1] The minimum aspect ratio (width/height) allowed for the rectangle. This property should only be used if the aspectRatio is not provided.
    @param {Number} [options.nTries = 20] The number of randomly drawn points inside the polygon which the algorithm explores as possible center points of the maximal rectangle.
    @param {Number} [options.minHeight = 0] The minimum height of the rectangle.
    @param {Number} [options.minWidth = 0] The minimum width of the rectangle.
    @param {Number} [options.tolerance = 0.02] The simplification tolerance factor, between 0 and 1. A larger tolerance corresponds to more extensive simplification.
    @param {Array} [options.origin] The center point of the rectangle. If specified, the rectangle will be fixed at that point, otherwise the algorithm optimizes across all possible points. The given value can be either a two dimensional array specifying the x and y coordinate of the origin or an array of two dimensional points specifying multiple possible center points of the rectangle.
    @return {LargestRect}
*/
export default function(poly, options = {}) {

  if (poly.length < 3) {
    if (options.verbose) console.error("polygon has to have at least 3 points", poly);
    return null;
  }

  // For visualization debugging purposes
  const events = [];

  // User's input normalization
  options = Object.assign({
    angle: range(-90, 90 + angleStep, angleStep),
    maxAspectRatio: 15,
    minAspectRatio: 1,
    minHeight: 0,
    minWidth: 0,
    nTries: 20,
    tolerance: 0.02,
    verbose: false
  }, options);

  const angles = options.angle instanceof Array ? options.angle
               : typeof options.angle === "number" ? [options.angle]
               : typeof options.angle === "string" && !isNaN(options.angle) ? [Number(options.angle)]
               : [];

  const aspectRatios = options.aspectRatio instanceof Array ? options.aspectRatio
               : typeof options.aspectRatio === "number" ? [options.aspectRatio]
               : typeof options.aspectRatio === "string" && !isNaN(options.aspectRatio) ? [Number(options.aspectRatio)]
               : [];

  const origins = options.origin && options.origin instanceof Array
                ? options.origin[0] instanceof Array ? options.origin
                : [options.origin] : [];

  const area = Math.abs(polygonArea(poly)); // take absolute value of the signed area
  if (area === 0) {
    if (options.verbose) console.error("polygon has 0 area", poly);
    return null;
  }
  // get the width of the bounding box of the original polygon to determine tolerance
  let [minx, maxx] = extent(poly, d => d[0]);
  let [miny, maxy] = extent(poly, d => d[1]);

  // simplify polygon
  const tolerance = Math.min(maxx - minx, maxy - miny) * options.tolerance;

  if (tolerance > 0) poly = simplify(poly, tolerance);
  if (options.events) events.push({type: "simplify", poly});

  // get the width of the bounding box of the simplified polygon
  [minx, maxx] = extent(poly, d => d[0]);
  [miny, maxy] = extent(poly, d => d[1]);
  const [boxWidth, boxHeight] = [maxx - minx, maxy - miny];

  // discretize the binary search for optimal width to a resolution of this times the polygon width
  const widthStep = Math.min(boxWidth, boxHeight) / 50;

  // populate possible center points with random points inside the polygon
  if (!origins.length) {
    // get the centroid of the polygon
    const centroid = polygonCentroid(poly);
    if (pointInPoly(centroid, poly)) origins.push(centroid);
    // get few more points inside the polygon
    while (origins.length < options.nTries) {
      const rndX = Math.random() * boxWidth + minx;
      const rndY = Math.random() * boxHeight + miny;
      const rndPoint = [rndX, rndY];
      if (pointInPoly(rndPoint, poly)) origins.push(rndPoint);
    }
  }
  if (options.events) events.push({type: "origins", points: origins});
  let maxArea = 0;
  let maxRect = null;

  angles.forEach(angle => {

    const angleRad = -angle * Math.PI / 180;
    if (options.events) events.push({type: "angle", angle});
    origins.forEach((origOrigin, i) => {

      // generate improved origins
      const [p1W, p2W] = rayIntersectsPoly(poly, origOrigin, angleRad);
      const [p1H, p2H] = rayIntersectsPoly(poly, origOrigin, angleRad + Math.PI / 2);
      const modifOrigins = [];
      if (p1W && p2W) modifOrigins.push([(p1W[0] + p2W[0]) / 2, (p1W[1] + p2W[1]) / 2]); // average along with width axis
      if (p1H && p2H) modifOrigins.push([(p1H[0] + p2H[0]) / 2, (p1H[1] + p2H[1]) / 2]); // average along with height axis

      if (options.events) events.push({type: "modifOrigin", idx: i, p1W, p2W, p1H, p2H, modifOrigins});

      for (let i = 0; i < modifOrigins.length; i++) {

        const origin = modifOrigins[i];

        if (options.events) events.push({type: "origin", cx: origin[0], cy: origin[1]});

        const [p1W, p2W] = rayIntersectsPoly(poly, origin, angleRad);
        if (p1W === null || p2W === null) continue;
        const minSqDistW = Math.min(squaredDistance(origin, p1W), squaredDistance(origin, p2W));
        const maxWidth = 2 * Math.sqrt(minSqDistW);

        const [p1H, p2H] = rayIntersectsPoly(poly, origin, angleRad + Math.PI / 2);
        if (p1H === null || p2H === null) continue;
        const minSqDistH = Math.min(squaredDistance(origin, p1H), squaredDistance(origin, p2H));
        const maxHeight = 2 * Math.sqrt(minSqDistH);

        if (maxWidth * maxHeight < maxArea) continue;

        let aRatios = aspectRatios;
        if (!aRatios.length) {
          const minAspectRatio = Math.max(options.minAspectRatio, options.minWidth / maxHeight, maxArea / (maxHeight * maxHeight));
          const maxAspectRatio = Math.min(options.maxAspectRatio, maxWidth / options.minHeight, maxWidth * maxWidth / maxArea);
          aRatios = range(minAspectRatio, maxAspectRatio + aspectRatioStep, aspectRatioStep);
        }

        for (let a = 0; a < aRatios.length; a++) {

          const aRatio = aRatios[a];

          // do a binary search to find the max width that works
          let left = Math.max(options.minWidth, Math.sqrt(maxArea * aRatio));
          let right = Math.min(maxWidth, maxHeight * aRatio);
          if (right * maxHeight < maxArea) continue;

          if (options.events && right - left >= widthStep) events.push({type: "aRatio", aRatio});

          while (right - left >= widthStep) {
            const width = (left + right) / 2;
            const height = width / aRatio;
            const [cx, cy] = origin;
            let rectPoly = [
              [cx - width / 2, cy - height / 2],
              [cx + width / 2, cy - height / 2],
              [cx + width / 2, cy + height / 2],
              [cx - width / 2, cy + height / 2]
            ];
            rectPoly = rotatePoly(rectPoly, angleRad, origin);
            const insidePoly = polyInPoly(rectPoly, poly);
            if (insidePoly) {
              // we know that the area is already greater than the maxArea found so far
              maxArea = width * height;
              rectPoly.push(rectPoly[0]);
              maxRect = {area: maxArea, cx, cy, width, height, angle, points: rectPoly};
              left = width; // increase the width in the binary search
            }
            else {
              right = width; // decrease the width in the binary search
            }
            if (options.events) events.push({type: "rectangle", areaFraction: width * height / area, cx, cy, width, height, angle, insidePoly});

          }

        }

      }

    });

  });

  return options.events ? Object.assign(maxRect || {}, {events}) : maxRect;

}
