import { d3 } from "./d3";
import { eventBus } from "../common"
import ResizeObserver from "resize-observer-polyfill";

/** The dot plot viewer. */
export class Plot {

  private eventBus;
  private container: any;
  private colors: any;
  private options: any;
  private data: any;
  private extent: any;
  private scale: any;
  private viewer: any;
  private brushSelection: any;
  private beginHoverTimeout: any;
  protected hoverTimeout: any;
  private resizeTimer: any;

  constructor(el, colors, plot, options) {
    this.container = el;
    this.colors = colors;
    this.parseOptions(options);
    this.parseData(plot);
    this.draw();
    if (this.options.autoResize) {
      this.autoResize();
    }
  }

  private parseOptions(options): void {
    this.options = options || {};
    this.options.autoResize = this.options.autoResize || false;
    this.options.resizeDelay = this.options.resizeDelay || 250;
    this.options.selectiveColoring = this.options.selectiveColoring;
    this.options.geneClick = this.options.geneClick || ((g, i) => { /* noop */ });
    this.options.geneOpen = this.options.geneOver || ((e, g, i) => { /* noop */ });
    this.options.plotClick = this.options.plotClick || ((plot) => {
        // noop
      });
    this.options.brushup = this.options.brushup || ((brushed) => {
        // noop
      });
    this.options.autoResize = this.options.autoResize || false;
    this.options.outlier  = this.options.outlier || undefined;
    this.options.hoverDelay = this.options.hoverDelay || 500;
  }

  private parseData(plot) {
    this.data = plot;
    this.extent = {
      x: d3.extent(this.data.genes, (d) => d.x),
      y: d3.extent(this.data.genes, (d) => d.y),
    };
    this.scale = {
      x: d3.scaleLinear().domain(this.extent.x),
      y: d3.scaleLinear().domain(this.extent.y),
    };
  }

  private draw() {
    this.eventBus = eventBus.subscribe(this.eventHandler.bind(this));

    const margin = { top: 20, right: 20, bottom: 30, left: 30 };
    const dim =
      Math.min(this.container.clientWidth, this.container.clientHeight);
    const width = Math.max(dim - margin.left - margin.right, 0);
    const height = Math.max(dim - margin.top - margin.bottom, 0);
    const radius = 4;

    this.scale.x.range([radius + 1, width - radius - 1]);
    this.scale.y.range([height - radius - 1, radius + 1]);

    // helper functions
    const yAxisLabels = (axis) => {
      axis.selectAll("text")
        .attr("x", 0)
        .attr("dy", 0)
        .style("text-anchor", (t, i) => ((i % 2 === 0) ? "start" : "end"))
        //.style("dominant-baseline", "ideographic")
        //.style("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("y", -yAxis.tickSizeOuter() - yAxis.tickPadding());
    }

    const xAxisLabels = (axis) => {
      axis.selectAll("text")
        .style("text-anchor", (t, i) => ((i % 2 === 0) ? "start" : "end"));
    }

    const brushended = () => {
      const s = d3.event.selection;
      if (!s) {
        if (!idleTimeout) {
          return idleTimeout = setTimeout(idled, idleDelay);
        }
        this.scale.x.domain(this.extent.x);
        this.scale.y.domain(this.extent.y);
      } else {
        this.scale.x.domain([s[0][0], s[1][0]].map(this.scale.x.invert, this.scale.x));
        this.scale.y.domain([s[1][1], s[0][1]].map(this.scale.y.invert, this.scale.y));
        scatter.select(".brush").call(brush.move, null);
      }
      zoom();
    }

    const idled = () => {
      idleTimeout = null;
    }

    const zoom = () => {
      const t = scatter.transition().duration(750);
      xAxis.tickValues(this.scale.x.domain());
      const zoomXAxisCall = plot.select("#axis--x").transition(t).call(xAxis);
      xAxisLabels(zoomXAxisCall);
      yAxis.tickValues(this.scale.y.domain());
      const zoomYAxisCall = plot.select("#axis--y").transition(t).call(yAxis);
      yAxisLabels(zoomYAxisCall);
      scatter.selectAll("circle").transition(t)
        .attr("cx", (d) => this.scale.x(d.x))
        .attr("cy", (d) => this.scale.y(d.y));
    }

    const publishGeneEvent = (type, gene) => {
      eventBus.publish({
        type,
        targets: {
          genes: [gene.name],
          family: gene.family,
        }
      });
    };

    // draw the plot

    const xAxis = d3.axisBottom(this.scale.x).tickValues(this.scale.x.domain());
    const yAxis = d3.axisLeft(this.scale.y).tickValues(this.scale.y.domain());

    const brush = d3.brush().extent([[0, 0], [width, height]]).on("end", brushended);
    let idleTimeout;
    const idleDelay = 350;

    this.viewer = d3.select(this.container).append("svg")
      .attr("class", "GCV")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    const plot = this.viewer
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    const clip = plot.append("defs").append("svg:clipPath")
      .attr("id", "clip")
      .append("svg:rect")
      .attr("width", width )
      .attr("height", height )
      .attr("x", 0)
      .attr("y", 0);

    const scatter = plot.append("g")
      .attr("id", "scatterplot")
      .attr("clip-path", "url(#clip)");

    const genes = scatter.selectAll("gene")
      .data(this.data.genes)
      .enter().append("g")
      .attr("class", "gene")
      .attr("data-gene", (g) => g.name)
      .attr("data-family", (g) => g.family)
      .style("cursor", "pointer")
      .on("mouseover", (g) => {
        publishGeneEvent("select", g);
        this.options.geneOver(d3.event, g);
      })
      .on("mouseout", (g) => publishGeneEvent("deselect", g))
      .on("click", (g, i) => this.options.geneClick(g, i));;

    const points = genes.append("circle")
      .attr("r", radius)
      .attr("cx", (d) => this.scale.x(d.x))
      .attr("cy", (d) => this.scale.y(d.y))
      .style("stroke", "#000")
      .style("fill", (g) => {
        if (g.family === "" ||
        (this.options.selectiveColoring !== undefined &&
        this.options.selectiveColoring[g.family] === 1)) {
          return "#ffffff";
        }
        return this.colors(g.family);
      });

    // x axis
    const xAxisCall = plot.append("g")
      .attr("class", "x axis")
      .attr('id', "axis--x")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis);
    xAxisLabels(xAxisCall);

    plot.append("text")
      .attr("class", "label plot-label")
      .style("text-anchor", "end")
      .attr("x", width)
      .attr("y", height - 8)
      .text(this.data.chromosome_name);

    // y axis
    const yAxisCall = plot.append("g")
      .attr("class", "y axis")
      .attr('id', "axis--y")
      .call(yAxis);
    yAxisLabels(yAxisCall);

    plot.append("text")
      .attr("class", "label plot-label")
      .style("text-anchor", "end")
      .style("dominant-baseline", "hanging")
      .attr("x", 0)
      .attr("y", 8)
      .attr("transform", "rotate(-90)")
      .text(this.data.reference_name);

    scatter.append("g")
      .attr("class", "brush")
      .call(brush);

    genes.moveToFront();
  }

  private beginHover(selection) {
    clearTimeout(this.beginHoverTimeout);
    this.beginHoverTimeout = setTimeout(() => {
      d3.selectAll(".GCV").classed("hovering", true);
      selection.classed("active", true);
    }, this.options.hoverDelay);
  }

  private endHover(selection) {
    selection.classed("active", false);
    // delay unfading for smoother mouse dragging
    clearTimeout(this.beginHoverTimeout);
    clearTimeout(this.hoverTimeout);
    this.hoverTimeout = setTimeout(function() {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = undefined;
      // make sure nothing is being hovered
      if (d3.selectAll(".GCV .active").empty()) {
        d3.selectAll(".GCV").classed("hovering", false);
      }
    }, 125);
  }

  // TODO: clearTimeout doesn't appear to be working due to a scoping issue
  // NOTE: is there a more efficient way to resize other than redrawing?
  // NOTE: does the observer need to be disconnected?
  private autoResize() {
    const ro = new ResizeObserver((entries) => {
      clearTimeout(this.resizeTimer);
      const id = this.resizeTimer = setTimeout(() => {
        const width = Math.max(this.container.clientWidth, this.container.clientHeight);
        // NOTE: shouldn't have to check if circos is undefined if scope is correct...
        if (this.viewer !== undefined && this.viewer.attr("width") !== width) {
          this.destroy();
          this.draw();
        }
      }, this.options.resizeDelay);
    });
    ro.observe(this.container);
  }

  /** Handles events that come from the GCV eventBus.
   * @param {GCVevent} event - A GCV event containing a type and targets attributes.
   */
  protected eventHandler(event) {
    // select the relevant elements in the viewer
    let selection;
    if (event.targets.hasOwnProperty("genes")) {
      const selectors = event.targets.genes.map(g => "[data-gene='" + g + "']");
      const selector = selectors.join(",");
      selection = this.viewer.selectAll(selector);
    } else if (event.targets.hasOwnProperty("family")) {
      const selectors = [];
      event.targets.family.split(",").forEach((f) => {
        selectors.push("[data-family='" + f + "']");
      });
      selection = this.viewer.selectAll(selectors.join(", "));
    }
    // (un)fade the (un)selected elements
    switch(event.type) {
      case "select":
        this.viewer.classed("hovering", true);
        if (selection !== undefined) {
          selection.classed("active", true);
        }
        break;
      case "deselect":
        if (selection !== undefined) {
          selection.classed("active", false);
        }
        this.viewer.classed("hovering", false);
        break;
    }
  }

  destroy() {
    if (this.eventBus !== undefined) {
      this.eventBus.unsubscribe();
    }
    this.viewer.node().remove();
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
