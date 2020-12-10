import { d3 } from "./d3";
import ResizeObserver from "resize-observer-polyfill";

export abstract class Visualizer {
  // private
  protected eventBus;
  protected colors: any;
  protected container: HTMLElement;
  protected data: any;
  protected options: any;
  protected resizeObserver: any;
  protected resizeTimer: any;
  protected viewer: any;
  protected callbackTimeout;

  // constants
  protected readonly PAD;

  /**
   * The constructor.
   * @param {HTMLElement|string} el - ID of or the element itself where the
   * viewer will be drawn in.
   * @param {object} colors - D3 family-to-color map.
   * @param {object} data - The data the viewer will visualize.
   * @param {object} options - Optional parameters.
   */
  constructor(el, colors, data, options) {
    this.PAD = 2;
    this.init(el, colors, data, options);
    this.draw();
    if (this.options.onInit !== undefined) {
      this.options.onInit();
    }
  }

  /** Generates the raw SVG xml. */
  xml() {
    try {
      const isFileSaverSupported = !!new Blob();
    } catch (e) {
      alert("Your broswer does not support saving");
    }
    // create a clone of the viewer with all GCV styles inlined
    const clone = this.inlineCopy();
    // generate the data
    const xml = (new XMLSerializer()).serializeToString(clone.node());
    return xml;
  }

  /** Manually destroys the viewer. */
  destroy() {
    if (this.eventBus !== undefined) {
      this.eventBus.unsubscribe();
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.viewer.node().remove();
    this.container = this.viewer = this.resizeObserver = undefined;
  }

  /**
   * Adds a ResizeObserver to the viewer element to detect resize events.
   */
  protected autoResize() {
    this.resizeObserver = new ResizeObserver((entries) => {
      clearTimeout(this.resizeTimer);
      const id = this.resizeTimer = setTimeout(() => {
        if (this.container !== undefined && this.viewer !== undefined) {
          const width =
            Math.max(this.container.clientWidth, this.container.clientHeight);
          if (this.viewer.attr("width") !== width) {
            this.resize();
          }
        }
      }, this.options.resizeDelay);
    });
    this.resizeObserver.observe(this.container);
  }

  /**
   * Sets the timeout attribute to a timer with the given function.
   * @param {function} callback - The function to be executed when the timer
   * expires.
   */
  protected setTimeout(callback) {
    clearTimeout(this.callbackTimeout);
    this.callbackTimeout = setTimeout(callback, this.options.hoverDelay);
  }

  /**
   * Clears the timeout attribute and then calls the given function.
   * @param {function} callback - The function to be called.
   */
  protected clearTimeout(callback) {
    clearTimeout(this.callbackTimeout);
    callback();
  }

  protected abstract resize(): void;

  /**
   * Decorates the resize function with the given function.
   * @param {function} d - The decorator function.
   */
  protected decorateResize(d) {
    this.resize = function(resize) {
      resize();
      d();
    }.bind(this, this.resize);
  }

  protected initResize() {
    // make sure resize always has the right context
    this.resize = this.resize.bind(this);
    // initialize the viewer width/height and scale range
    this.resize();
  }

  /**
   * Parses parameters and initializes letiables.
   * @param {HTMLElement|string} el - ID of or the element itself where the
   * viewer will be drawn in.
   * @param {object} colors - Datum-to-color map.
   * @param {object} data - A list of objects with name and id attributes.
   * @param {object} options - Optional parameters.
   */
  protected init(el, colors, data, options?) {
    // parse positional parameters
    if (el instanceof HTMLElement) {
      this.container = el;
    } else {
      this.container = document.getElementById(el);
    }
    if (this.container === null) {
      throw new Error("'" + el + "' is not a valid element/ID");
    }
    this.colors = colors;
    if (this.colors === undefined) {
      throw new Error("'color' is undefined");
    }
    if (data === undefined) {
      throw new Error("'data' is undefined");
    }
    this.data = data;
    // create the viewer
    this.viewer = d3.select(this.container)
      .append("svg")
      .attr("class", "GCV");
  }

  protected abstract draw(): void;

  /** Makes a copy of the SVG and inlines external GCV styles. */
  protected inlineCopy(mod = (clone) => {/* noop */}) {
    // clone the current view node
    const clone = d3.select(this.viewer.node().cloneNode(true));
    mod(clone);
    // load the external styles
    const sheets: any = document.styleSheets;
    // inline GCV styles
    for (const sheet of sheets) {
      let rules: any;
        try {
          rules = sheet.rules || sheet.cssRules;
        } catch {
          continue;
        }
      for (const r of Object.keys(rules)) {
        const rule = rules[r];
        const selector = rule.selectorText;
        if (selector !== undefined && selector.startsWith(".GCV")) {
          const style = rule.style;
          const selection = clone.selectAll(selector);
          for (const prop of style) {
            selection.style(prop, style[prop]);
          }
        }
      }
    }
    return clone;
  }
}
