/**
    @external BaseClass
    @see https://github.com/d3plus/d3plus-common#BaseClass
*/

import {min} from "d3-array";
import {color} from "d3-color";
import {mouse, select, selectAll} from "d3-selection";
import {transition} from "d3-transition";

import {accessor, attrize, BaseClass, constant, elem} from "d3plus-common";
import {contrast} from "d3plus-color";
import {strip, TextBox} from "d3plus-text";

import {default as Image} from "../Image";
import {default as pointDistance} from "../pointDistance";

/**
    @class Shape
    @extends external:BaseClass
    @desc An abstracted class for generating shapes.
*/
export default class Shape extends BaseClass {

  /**
      @memberof Shape
      @desc Invoked when creating a new class instance, and sets any default parameters.
      @private
  */
  constructor(tagName = "g") {

    super();

    this._activeOpacity = 0.75;
    this._activeStyle = {
      "stroke": (d, i) => color(this._stroke(d, i)).darker(2),
      "stroke-width": (d, i) => {
        const s = this._strokeWidth(d, i);
        return s ? s * 2 : 1;
      }
    };
    this._backgroundImage = constant(false);
    this._data = [];
    this._duration = 600;
    this._fill = constant("black");

    this._fontColor = (d, i) => contrast(this._fill(d, i));
    this._fontFamily = constant("Verdana");
    this._fontResize = constant(false);
    this._fontSize = constant(12);

    this._hoverOpacity = 0.5;
    this._id = (d, i) => d.id !== void 0 ? d.id : i;
    this._label = constant(false);
    this._labelPadding = constant(5);
    this._name = "Shape";
    this._opacity = constant(1);
    this._scale = constant(1);
    this._shapeRendering = constant("geometricPrecision");
    this._stroke = (d, i) => color(this._fill(d, i)).darker(1);
    this._strokeWidth = constant(0);
    this._tagName = tagName;
    this._textAnchor = constant("start");
    this._vectorEffect = constant("non-scaling-stroke");
    this._verticalAlign = constant("top");

    this._x = accessor("x", 0);
    this._y = accessor("y", 0);

  }

  /**
      @memberof Shape
      @desc Given a specific data point and index, returns the aesthetic properties of the shape.
      @param {Object} *data point*
      @param {Number} *index*
      @private
  */
  _aes() {
    return {};
  }

  /**
      @memberof Shape
      @desc Adds event listeners to each shape group or hit area.
      @param {D3Selection} *update* The update cycle of the data binding.
      @private
  */
  _applyEvents(handler) {

    const events = Object.keys(this._on);
    for (let e = 0; e < events.length; e++) {
      handler.on(events[e], (d, i) => {
        if (!this._on[events[e]]) return;
        if (d.i !== void 0) i = d.i;
        if (d.nested && d.values) {
          const cursor = mouse(this._select.node()),
                values = d.values.map(d => pointDistance(cursor, [this._x(d, i), this._y(d, i)]));
          d = d.values[values.indexOf(min(values))];
        }
        this._on[events[e]].bind(this)(d, i);
      });
    }

  }

  /**
      @memberof Shape
      @desc Provides the default styling to the active shape elements.
      @param {HTMLElement} *elem*
      @private
  */
  _applyActive(elem) {

    const that = this;

    if (elem.size() && elem.node().tagName === "g") elem = elem.selectAll("*");

    /**
        @desc Determines whether a shape is a nested collection of data points, and uses the appropriate data and index for the given function context.
        @param {Object} *d* data point
        @param {Number} *i* index
        @private
    */
    function styleLogic(d, i) {
      return typeof this !== "function" ? this
           : d.nested && d.key && d.values
           ? this(d.values[0], that._data.indexOf(d.values[0]))
           : this(d, i);
    }

    const activeStyle = {};
    for (const key in this._activeStyle) {
      if ({}.hasOwnProperty.call(this._activeStyle, key)) {
        activeStyle[key] = styleLogic.bind(this._activeStyle[key]);
      }
    }

    elem.transition().duration(0).call(attrize, activeStyle);

  }

  /**
      @memberof Shape
      @desc Provides the default styling to the shape elements.
      @param {HTMLElement} *elem*
      @private
  */
  _applyStyle(elem) {

    const that = this;

    if (elem.size() && elem.node().tagName === "g") elem = elem.selectAll("*");

    /**
        @desc Determines whether a shape is a nested collection of data points, and uses the appropriate data and index for the given function context.
        @param {Object} *d* data point
        @param {Number} *i* index
        @private
    */
    function styleLogic(d, i) {
      return typeof this !== "function" ? this
           : d.nested && d.key && d.values
           ? this(d.values[0], that._data.indexOf(d.values[0]))
           : this(d, i);
    }

    elem
      .attr("fill", styleLogic.bind(this._fill))
      .attr("stroke", styleLogic.bind(this._stroke))
      .attr("stroke-width", styleLogic.bind(this._strokeWidth))
      .attr("vector-effect", styleLogic.bind(this._vectorEffect));
  }

  /**
      @memberof Shape
      @desc Calculates the transform for the group elements.
      @param {HTMLElement} *elem*
      @private
  */
  _applyTransform(elem) {

    elem
      .attr("transform", (d, i) => `
        translate(${d.__d3plusShape__
                  ? d.translate ? d.translate
                  : `${this._x(d.data, d.i)},${this._y(d.data, d.i)}`
                  : `${this._x(d, i)},${this._y(d, i)}`})
        scale(${d.__d3plusShape__ ? d.scale || this._scale(d.data, d.i)
              : this._scale(d, i)})`);
  }

  /**
      @memberof Shape
      @desc Checks for nested data and uses the appropriate variables for accessor functions.
      @param {HTMLElement} *elem*
      @private
  */
  _nestWrapper(method) {
    return (d, i) => method(d.__d3plusShape__ ? d.data : d, d.__d3plusShape__ ? d.i : i);
  }

  /**
      @memberof Shape
      @desc Adds background image to each shape group.
      @private
  */
  _renderImage() {

    const imageData = [];

    this._update.merge(this._enter).data()
      .forEach((datum, i) => {

        const aes = this._aes(datum, i);

        if (aes.r || aes.width && aes.height) {

          let d = datum;
          if (datum.nested && datum.key && datum.values) {
            d = datum.values[0];
            i = this._data.indexOf(d);
          }

          const height = aes.r ? aes.r * 2 : aes.height,
                url = this._backgroundImage(d, i),
                width = aes.r ? aes.r * 2 : aes.width;

          if (url) {

            let x = d.__d3plusShape__ ? d.translate ? d.translate[0]
                  : this._x(d.data, d.i) : this._x(d, i),
                y = d.__d3plusShape__ ? d.translate ? d.translate[1]
                  : this._y(d.data, d.i) : this._y(d, i);

            if (aes.x) x += aes.x;
            if (aes.y) y += aes.y;

            if (d.__d3plusShape__) {
              d = d.data;
              i = d.i;
            }

            imageData.push({
              __d3plus__: true,
              data: d,
              height,
              i,
              id: this._id(d, i),
              url,
              width,
              x: x + -width / 2,
              y: y + -height / 2
            });

          }

        }

      });

    return new Image()
      .data(imageData)
      .duration(this._duration)
      .pointerEvents("none")
      .select(elem(`g.d3plus-${this._name}-image`, {parent: this._group, update: {opacity: this._active ? this._activeOpacity : 1}}).node())
      .render();

  }

  /**
      @memberof Shape
      @desc Adds labels to each shape group.
      @private
  */
  _renderLabels() {

    const labelData = [];

    this._update.merge(this._enter).data()
      .forEach((datum, i) => {

        let d = datum;
        if (datum.nested && datum.key && datum.values) {
          d = datum.values[0];
          i = this._data.indexOf(d);
        }

        let labels = this._label(d, i);

        if (this._labelBounds && labels !== false && labels !== void 0) {

          const aes = this._aes(datum, i),
                bounds = this._labelBounds(d, i, aes);

          if (bounds) {

            if (labels.constructor !== Array) labels = [labels];

            let x = d.__d3plusShape__ ? d.translate ? d.translate[0]
                  : this._x(d.data, d.i) : this._x(d, i),
                y = d.__d3plusShape__ ? d.translate ? d.translate[1]
                  : this._y(d.data, d.i) : this._y(d, i);

            if (aes.x) x += aes.x;
            if (aes.y) y += aes.y;

            if (d.__d3plusShape__) {
              d = d.data;
              i = d.i;
            }

            const fC = this._fontColor(d, i),
                  fF = this._fontFamily(d, i),
                  fR = this._fontResize(d, i),
                  fS = this._fontSize(d, i),
                  lH = this._lineHeight(d, i),
                  padding = this._labelPadding(d, i),
                  tA = this._textAnchor(d, i),
                  vA = this._verticalAlign(d, i);

            for (let l = 0; l < labels.length; l++) {

              const b = bounds.constructor === Array ? bounds[l] : Object.assign({}, bounds),
                    p = padding.constructor === Array ? padding[l] : padding;

              labelData.push(Object.assign(b, {
                __d3plusShape__: true,
                data: d,
                fC: fC.constructor === Array ? fC[l] : fC,
                fF: fF.constructor === Array ? fF[l] : fF,
                fR: fR.constructor === Array ? fR[l] : fR,
                fS: fS.constructor === Array ? fS[l] : fS,
                height: b.height - p * 2,
                i,
                id: `${this._id(d, i)}_${l}`,
                lH: lH.constructor === Array ? lH[l] : lH,
                tA: tA.constructor === Array ? tA[l] : tA,
                text: labels[l],
                vA: vA.constructor === Array ? vA[l] : vA,
                width: b.width - p * 2,
                x: x + b.x + p,
                y: y + b.y + p
              }));

            }

          }

        }

      });

    return new TextBox()
      .data(labelData)
      .delay(this._duration / 2)
      .duration(this._duration)
      .fontColor(d => d.fC)
      .fontFamily(d => d.fF)
      .fontResize(d => d.fR)
      .fontSize(d => d.fS)
      .lineHeight(d => d.lH)
      .pointerEvents("none")
      .textAnchor(d => d.tA)
      .verticalAlign(d => d.vA)
      .select(elem(`g.d3plus-${this._name}-text`, {parent: this._group, update: {opacity: this._active ? this._activeOpacity : 1}}).node())
      .render();

  }

  /**
      @memberof Shape
      @desc Renders the current Shape to the page. If a *callback* is specified, it will be called once the shapes are done drawing.
      @param {Function} [*callback*]
      @chainable
  */
  render(callback) {

    if (this._select === void 0) {
      this.select(select("body").append("svg")
        .style("width", `${window.innerWidth}px`)
        .style("height", `${window.innerHeight}px`)
        .style("display", "block").node());
    }

    if (this._lineHeight === void 0) {
      this.lineHeight((d, i) => this._fontSize(d, i) * 1.1);
    }

    this._transition = transition().duration(this._duration);

    let data = this._data, key = this._id;
    if (this._dataFilter) {
      data = this._dataFilter(data);
      if (data.key) key = data.key;
    }

    if (this._sort) data = data.sort((a, b) => this._sort(a.__d3plusShape__ ? a.data : a, b.__d3plusShape__ ? b.data : b));

    selectAll(`g.d3plus-${this._name}-hover > *, g.d3plus-${this._name}-active > *`).each(function(d) {
      if (d && d.parentNode) d.parentNode.appendChild(this);
      else this.parentNode.removeChild(this);
    });

    // Makes the update state of the group selection accessible.
    this._group = elem(`g.d3plus-${this._name}-group`, {parent: this._select});
    const update = this._update = elem(`g.d3plus-${this._name}-shape`, {parent: this._group, update: {opacity: this._active ? this._activeOpacity : 1}})
      .selectAll(`.d3plus-${this._name}`)
        .data(data, key);

    // Orders and transforms the updating Shapes.
    update.order().transition(this._transition)
      .call(this._applyTransform.bind(this));

    // Makes the enter state of the group selection accessible.
    const enter = this._enter = update.enter().append(this._tagName)
        .attr("class", (d, i) => `d3plus-Shape d3plus-${this._name} d3plus-id-${strip(this._nestWrapper(this._id)(d, i))}`)
      .call(this._applyTransform.bind(this))
        .attr("opacity", this._nestWrapper(this._opacity));

    const enterUpdate = enter.merge(update);

    enterUpdate
        .attr("shape-rendering", this._nestWrapper(this._shapeRendering))
        .attr("pointer-events", "none")
      .transition(this._transition)
        .attr("opacity", this._nestWrapper(this._opacity))
      .transition()
        .attr("pointer-events", "all");

    // Makes the exit state of the group selection accessible.
    const exit = this._exit = update.exit();
    exit.transition().delay(this._duration).remove();

    this._renderImage();
    this._renderLabels();

    this._hoverGroup = elem(`g.d3plus-${this._name}-hover`, {parent: this._group});
    this._activeGroup = elem(`g.d3plus-${this._name}-active`, {parent: this._group});

    const that = this;

    const hitAreas = this._group.selectAll(".d3plus-HitArea")
      .data(this._hitArea ? data : [], key);

    hitAreas.order().transition(this._transition)
      .call(this._applyTransform.bind(this));

    const hitEnter = hitAreas.enter().append("rect")
        .attr("class", (d, i) => `d3plus-HitArea d3plus-id-${strip(this._nestWrapper(this._id)(d, i))}`)
        .attr("fill", "transparent")
      .call(this._applyTransform.bind(this));

    const hitUpdates = hitAreas.merge(hitEnter)
      .each(function(d) {
        const h = that._hitArea(d, that._data.indexOf(d), that._aes(d, that._data.indexOf(d)));
        return h ? select(this).call(attrize, h) : select(this).remove();
      });

    hitAreas.exit().remove();

    this._applyEvents(this._hitArea ? hitUpdates : enterUpdate);
    this.active(this._active);

    if (callback) setTimeout(callback, this._duration + 100);

    return this;

  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the highlight accessor to the specified function and returns the current class instance. If *value* is not specified, returns the current highlight accessor.
      @param {Function} [*value*]
      @chainable
  */
  active(_) {

    if (!arguments.length || _ === void 0) return this._active;
    this._active = _;

    const that = this;

    this._group.selectAll(".d3plus-Shape, .d3plus-Image, .d3plus-textBox")
      .each(function(d, i) {

        if (!d.parentNode) d.parentNode = this.parentNode;
        const parent = d.parentNode;

        if (this.tagName === "text") d = d.data;
        if (d.__d3plusShape__ || d.__d3plus__) {
          i = d.i;
          d = d.data;
        }
        else i = that._data.indexOf(d);

        const group = !_ || typeof _ !== "function" || !_(d, i) ? parent : that._activeGroup.node();
        if (group !== this.parentNode) {
          group.appendChild(this);
          if (this.className.baseVal.includes("d3plus-Shape")) {
            if (parent === group) select(this).call(that._applyStyle.bind(that));
            else select(this).call(that._applyActive.bind(that));
          }
        }

      });

    this._group.selectAll(`g.d3plus-${this._name}-shape, g.d3plus-${this._name}-image, g.d3plus-${this._name}-text`)
      .attr("opacity", this._hover ? this._hoverOpacity : this._active ? this._activeOpacity : 1);

    return this;

  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the active opacity to the specified function and returns the current class instance. If *value* is not specified, returns the current active opacity.
      @param {Number} [*value* = 0.75]
      @chainable
  */
  activeOpacity(_) {
    return arguments.length ? (this._activeOpacity = _, this) : this._activeOpacity;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the background-image accessor to the specified function or string and returns the current class instance. If *value* is not specified, returns the current background-image accessor.
      @param {Function|String} [*value* = false]
      @chainable
  */
  backgroundImage(_) {
    return arguments.length
         ? (this._backgroundImage = typeof _ === "function" ? _ : constant(_), this)
         : this._backgroundImage;
  }

  /**
      @memberof Shape
      @desc If *data* is specified, sets the data array to the specified array and returns the current class instance. If *data* is not specified, returns the current data array. A shape will be drawn for each object in the array.
      @param {Array} [*data* = []]
      @chainable
  */
  data(_) {
    return arguments.length
         ? (this._data = _, this)
         : this._data;
  }

  /**
      @memberof Shape
      @desc If *ms* is specified, sets the animation duration to the specified number and returns the current class instance. If *ms* is not specified, returns the current animation duration.
      @param {Number} [*ms* = 600]
      @chainable
  */
  duration(_) {
    return arguments.length
         ? (this._duration = _, this)
         : this._duration;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the fill accessor to the specified function or string and returns the current class instance. If *value* is not specified, returns the current fill accessor.
      @param {Function|String} [*value* = "black"]
      @chainable
  */
  fill(_) {
    return arguments.length
         ? (this._fill = typeof _ === "function" ? _ : constant(_), this)
         : this._fill;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the font-color accessor to the specified function or string and returns the current class instance. If *value* is not specified, returns the current font-color accessor, which by default returns a color that contrasts the fill color. If an array is passed or returned from the function, each value will be used in conjunction with each label.
      @param {Function|String|Array} [*value*]
      @chainable
  */
  fontColor(_) {
    return arguments.length
         ? (this._fontColor = typeof _ === "function" ? _ : constant(_), this)
         : this._fontColor;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the font-family accessor to the specified function or string and returns the current class instance. If *value* is not specified, returns the current font-family accessor. If an array is passed or returned from the function, each value will be used in conjunction with each label.
      @param {Function|String|Array} [*value* = "Verdana"]
      @chainable
  */
  fontFamily(_) {
    return arguments.length
         ? (this._fontFamily = typeof _ === "function" ? _ : constant(_), this)
         : this._fontFamily;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the font resizing accessor to the specified function or boolean and returns the current class instance. If *value* is not specified, returns the current font resizing accessor. When font resizing is enabled, the font-size of the value returned by [label](#label) will be resized the best fit the shape. If an array is passed or returned from the function, each value will be used in conjunction with each label.
      @param {Function|Boolean|Array} [*value*]
      @chainable
  */
  fontResize(_) {
    return arguments.length
         ? (this._fontResize = typeof _ === "function" ? _ : constant(_), this)
         : this._fontResize;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the font-size accessor to the specified function or string and returns the current class instance. If *value* is not specified, returns the current font-size accessor. If an array is passed or returned from the function, each value will be used in conjunction with each label.
      @param {Function|String|Array} [*value* = 12]
      @chainable
  */
  fontSize(_) {
    return arguments.length
         ? (this._fontSize = typeof _ === "function" ? _ : constant(_), this)
         : this._fontSize;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the highlight accessor to the specified function and returns the current class instance. If *value* is not specified, returns the current highlight accessor.
      @param {Function} [*value*]
      @chainable
  */
  hover(_) {

    if (!arguments.length || _ === void 0) return this._hover;
    this._hover = _;

    const that = this;

    this._group.selectAll(`g.d3plus-${this._name}-shape, g.d3plus-${this._name}-image, g.d3plus-${this._name}-text, g.d3plus-${this._name}-hover`)
      .selectAll(".d3plus-Shape, .d3plus-Image, .d3plus-textBox")
      .each(function(d, i) {

        if (!d.parentNode) d.parentNode = this.parentNode;
        const parent = d.parentNode;

        if (this.tagName === "text") d = d.data;
        if (d.__d3plusShape__ || d.__d3plus__) {
          i = d.i;
          d = d.data;
        }
        else i = that._data.indexOf(d);

        const group = !_ || typeof _ !== "function" || !_(d, i) ? parent : that._hoverGroup.node();
        if (group !== this.parentNode) group.appendChild(this);

      });

    this._group.selectAll(`g.d3plus-${this._name}-shape, g.d3plus-${this._name}-image, g.d3plus-${this._name}-text`)
      .attr("opacity", this._hover ? this._hoverOpacity : this._active ? this._activeOpacity : 1);

    return this;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the hover opacity to the specified function and returns the current class instance. If *value* is not specified, returns the current hover opacity.
      @param {Number} [*value* = 0.5]
      @chainable
  */
  hoverOpacity(_) {
    return arguments.length ? (this._hoverOpacity = _, this) : this._hoverOpacity;
  }

  /**
      @memberof Shape
      @desc If *bounds* is specified, sets the mouse hit area to the specified function and returns the current class instance. If *bounds* is not specified, returns the current mouse hit area accessor.
      @param {Function} [*bounds*] The given function is passed the data point, index, and internally defined properties of the shape and should return an object containing the following values: `width`, `height`, `x`, `y`.
      @chainable
      @example
function(d, i, shape) {
  return {
    "width": shape.width,
    "height": shape.height,
    "x": -shape.width / 2,
    "y": -shape.height / 2
  };
}
  */
  hitArea(_) {
    return arguments.length
         ? (this._hitArea = typeof _ === "function" ? _ : constant(_), this)
         : this._hitArea;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the id accessor to the specified function and returns the current class instance. If *value* is not specified, returns the current id accessor.
      @param {Function} [*value*]
      @chainable
  */
  id(_) {
    return arguments.length
         ? (this._id = _, this)
         : this._id;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the label accessor to the specified function or string and returns the current class instance. If *value* is not specified, returns the current text accessor, which is `undefined` by default. If an array is passed or returned from the function, each value will be rendered as an individual label.
      @param {Function|String|Array} [*value*]
      @chainable
  */
  label(_) {
    return arguments.length
         ? (this._label = typeof _ === "function" ? _ : constant(_), this)
         : this._label;
  }

  /**
      @memberof Shape
      @desc If *bounds* is specified, sets the label bounds to the specified function and returns the current class instance. If *bounds* is not specified, returns the current inner bounds accessor.
      @param {Function} [*bounds*] The given function is passed the data point, index, and internally defined properties of the shape and should return an object containing the following values: `width`, `height`, `x`, `y`. If an array is returned from the function, each value will be used in conjunction with each label.
      @chainable
      @example
function(d, i, shape) {
  return {
    "width": shape.width,
    "height": shape.height,
    "x": -shape.width / 2,
    "y": -shape.height / 2
  };
}
  */
  labelBounds(_) {
    return arguments.length
         ? (this._labelBounds = typeof _ === "function" ? _ : constant(_), this)
         : this._labelBounds;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the label padding to the specified number and returns the current class instance. If *value* is not specified, returns the current label padding. If an array is passed or returned from the function, each value will be used in conjunction with each label.
      @param {Function|Number|Array} [*value* = 10]
      @chainable
  */
  labelPadding(_) {
    return arguments.length
         ? (this._labelPadding = typeof _ === "function" ? _ : constant(_), this)
         : this._labelPadding;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the line-height accessor to the specified function or string and returns the current class instance. If *value* is not specified, returns the current line-height accessor. If an array is passed or returned from the function, each value will be used in conjunction with each label.
      @param {Function|String|Array} [*value*]
      @chainable
  */
  lineHeight(_) {
    return arguments.length
         ? (this._lineHeight = typeof _ === "function" ? _ : constant(_), this)
         : this._lineHeight;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the opacity accessor to the specified function or number and returns the current class instance. If *value* is not specified, returns the current opacity accessor.
      @param {Number} [*value* = 1]
      @chainable
  */
  opacity(_) {
    return arguments.length
         ? (this._opacity = typeof _ === "function" ? _ : constant(_), this)
         : this._opacity;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the scale accessor to the specified function or string and returns the current class instance. If *value* is not specified, returns the current scale accessor.
      @param {Function|Number} [*value* = 1]
      @chainable
  */
  scale(_) {
    return arguments.length
         ? (this._scale = typeof _ === "function" ? _ : constant(_), this)
         : this._scale;
  }

  /**
      @memberof Shape
      @desc If *selector* is specified, sets the SVG container element to the specified d3 selector or DOM element and returns the current class instance. If *selector* is not specified, returns the current SVG container element.
      @param {String|HTMLElement} [*selector* = d3.select("body").append("svg")]
      @chainable
  */
  select(_) {
    return arguments.length
         ? (this._select = select(_), this)
         : this._select;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the shape-rendering accessor to the specified function or string and returns the current class instance. If *value* is not specified, returns the current shape-rendering accessor.
      @param {Function|String} [*value* = "geometricPrecision"]
      @chainable
      @example
function(d) {
  return d.x;
}
  */
  shapeRendering(_) {
    return arguments.length
         ? (this._shapeRendering = typeof _ === "function" ? _ : constant(_), this)
         : this._shapeRendering;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the sort comparator to the specified function and returns the current class instance. If *value* is not specified, returns the current sort comparator.
      @param {false|Function} [*value* = []]
      @chainable
  */
  sort(_) {
    return arguments.length
         ? (this._sort = _, this)
         : this._sort;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the stroke accessor to the specified function or string and returns the current class instance. If *value* is not specified, returns the current stroke accessor.
      @param {Function|String} [*value* = "black"]
      @chainable
  */
  stroke(_) {
    return arguments.length
         ? (this._stroke = typeof _ === "function" ? _ : constant(_), this)
         : this._stroke;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the stroke-width accessor to the specified function or string and returns the current class instance. If *value* is not specified, returns the current stroke-width accessor.
      @param {Function|Number} [*value* = 0]
      @chainable
  */
  strokeWidth(_) {
    return arguments.length
         ? (this._strokeWidth = typeof _ === "function" ? _ : constant(_), this)
         : this._strokeWidth;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the text-anchor accessor to the specified function or string and returns the current class instance. If *value* is not specified, returns the current text-anchor accessor, which is `"start"` by default. Accepted values are `"start"`, `"middle"`, and `"end"`. If an array is passed or returned from the function, each value will be used in conjunction with each label.
      @param {Function|String|Array} [*value* = "start"]
      @chainable
  */
  textAnchor(_) {
    return arguments.length
         ? (this._textAnchor = typeof _ === "function" ? _ : constant(_), this)
         : this._textAnchor;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the vector-effect accessor to the specified function or string and returns the current class instance. If *value* is not specified, returns the current vector-effect accessor.
      @param {Function|String} [*value* = "non-scaling-stroke"]
      @chainable
  */
  vectorEffect(_) {
    return arguments.length
         ? (this._vectorEffect = typeof _ === "function" ? _ : constant(_), this)
         : this._vectorEffect;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the vertical alignment accessor to the specified function or string and returns the current class instance. If *value* is not specified, returns the current vertical alignment accessor, which is `"top"` by default. Accepted values are `"top"`, `"middle"`, and `"bottom"`. If an array is passed or returned from the function, each value will be used in conjunction with each label.
      @param {Function|String|Array} [*value* = "start"]
      @chainable
  */
  verticalAlign(_) {
    return arguments.length
         ? (this._verticalAlign = typeof _ === "function" ? _ : constant(_), this)
         : this._verticalAlign;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the x accessor to the specified function or number and returns the current class instance. If *value* is not specified, returns the current x accessor.
      @param {Function|Number} [*value*]
      @chainable
      @example
function(d) {
  return d.x;
}
  */
  x(_) {
    return arguments.length
         ? (this._x = typeof _ === "function" ? _ : constant(_), this)
         : this._x;
  }

  /**
      @memberof Shape
      @desc If *value* is specified, sets the y accessor to the specified function or number and returns the current class instance. If *value* is not specified, returns the current y accessor.
      @param {Function|Number} [*value*]
      @chainable
      @example
function(d) {
  return d.y;
}
  */
  y(_) {
    return arguments.length
         ? (this._y = typeof _ === "function" ? _ : constant(_), this)
         : this._y;
  }

}
