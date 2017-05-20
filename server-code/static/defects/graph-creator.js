document.onload = (function(d3, saveAs, Blob, undefined){
  "use strict";
alert("oi");
  // define graphcreator object
  var GraphCreator = function(svg, nodes, edges){
    var thisGraph = this;
        thisGraph.idct = 0;

    thisGraph.nodes = nodes || [];
    thisGraph.edges = edges || [];

    thisGraph.state = {
      selectedNode: null,
      selectedEdge: null,
      mouseDownNode: null,
      mouseDownLink: null,
      justDragged: false,
      justScaleTransGraph: false,
      lastKeyDown: -1,
      shiftNodeDrag: false,
      selectedText: null
    };

    // define arrow markers for graph links
    var defs = svg.append('svg:defs');
    defs.append('svg:marker')
      .attr('id', 'end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', "32")
      .attr('markerWidth', 3.5)
      .attr('markerHeight', 3.5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    // define arrow markers for leading arrow
    defs.append('svg:marker')
      .attr('id', 'mark-end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 7)
      .attr('markerWidth', 3.5)
      .attr('markerHeight', 3.5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    thisGraph.svg = svg;
    thisGraph.svgG = svg.append("g")
          .classed(thisGraph.consts.graphClass, true);
    var svgG = thisGraph.svgG;

    // displayed when dragging between nodes
    thisGraph.dragLine = svgG.append('svg:path')
          .attr('class', 'link dragline hidden')
          .attr('d', 'M0,0L0,0')
          .style('marker-end', 'url(#mark-end-arrow)');

    // svg nodes and edges
    thisGraph.paths = svgG.append("g").selectAll("g");
    thisGraph.circles = svgG.append("g").selectAll("g");

    thisGraph.drag = d3.behavior.drag()
          .origin(function(d){
            return {x: d.x, y: d.y};
          })
          .on("drag", function(args){
            thisGraph.state.justDragged = true;
            thisGraph.dragmove.call(thisGraph, args);
          })
          .on("dragend", function() {
            // todo check if edge-mode is selected
          });

    // listen for key events
    d3.select(window).on("keydown", function(){
      thisGraph.svgKeyDown.call(thisGraph);
    })
    .on("keyup", function(){
      thisGraph.svgKeyUp.call(thisGraph);
    });
    svg.on("mousedown", function(d){thisGraph.svgMouseDown.call(thisGraph, d);});
    svg.on("mouseup", function(d){thisGraph.svgMouseUp.call(thisGraph, d);});

    // listen for dragging
    var dragSvg = d3.behavior.zoom()
          .on("zoom", function(){
            if (d3.event.sourceEvent.shiftKey){
              // TODO  the internal d3 state is still changing
              return false;
            } else{
              thisGraph.zoomed.call(thisGraph);
            }
            return true;
          })
          .on("zoomstart", function(){
            var ael = d3.select("#" + thisGraph.consts.activeEditId).node();
            if (ael){
              ael.blur();
            }
            if (!d3.event.sourceEvent.shiftKey) d3.select('body').style("cursor", "move");
          })
          .on("zoomend", function(){
            d3.select('body').style("cursor", "auto");
          });

    svg.call(dragSvg).on("dblclick.zoom", null);

    // listen for resize
    window.onresize = function(){thisGraph.updateWindow(svg);};

    // handle download data
    d3.select("#download-input").on("click", function(){
      var saveEdges = [];
      thisGraph.edges.forEach(function(val, i){
        saveEdges.push({source: val.source.id, target: val.target.id});
      });
      var blob = new Blob([window.JSON.stringify({"nodes": thisGraph.nodes, "edges": saveEdges})], {type: "text/plain;charset=utf-8"});
      saveAs(blob, "mydag.json");
    });


    // handle uploaded data
    d3.select("#upload-input").on("click", function(){
      document.getElementById("hidden-file-upload").click();
    });
    d3.select("#hidden-file-upload").on("change", function(){
      if (window.File && window.FileReader && window.FileList && window.Blob) {
        var uploadFile = this.files[0];
        var filereader = new window.FileReader();

        filereader.onload = function(){
          var txtRes = filereader.result;
          // TODO better error handling
          try{
            var jsonObj = JSON.parse(txtRes);
            thisGraph.deleteGraph(true);
            thisGraph.nodes = jsonObj.nodes;
            thisGraph.setIdCt(jsonObj.nodes.length + 1);
            var newEdges = jsonObj.edges;
            newEdges.forEach(function(e, i){
              newEdges[i] = {source: thisGraph.nodes.filter(function(n){return n.id == e.source;})[0],
                          target: thisGraph.nodes.filter(function(n){return n.id == e.target;})[0]};
            });
            thisGraph.edges = newEdges;
            thisGraph.updateGraph();
          }catch(err){
            window.alert("Error parsing uploaded file\nerror message: " + err.message);
            return;
          }
        };
        filereader.readAsText(uploadFile);

      } else {
        alert("Your browser won't let you save this graph -- try upgrading your browser to IE 10+ or Chrome or Firefox.");
      }

    });

    // handle delete graph
    d3.select("#delete-graph").on("click", function(){
      thisGraph.deleteGraph(false);
    });
  };

  GraphCreator.prototype.setIdCt = function(idct){
    this.idct = idct;
  };

  GraphCreator.prototype.consts =  {
    selectedClass: "selected",
    connectClass: "connect-node",
    circleGClass: "conceptG",
    graphClass: "graph",
    activeEditId: "active-editing",
    BACKSPACE_KEY: 8,
    DELETE_KEY: 46,
    ENTER_KEY: 13,
    nodeRadius: 50
  };

  /* PROTOTYPE FUNCTIONS */

  GraphCreator.prototype.dragmove = function(d) {
    var thisGraph = this;
    if (thisGraph.state.shiftNodeDrag){
      thisGraph.dragLine.attr('d', 'M' + d.x + ',' + d.y + 'L' + d3.mouse(thisGraph.svgG.node())[0] + ',' + d3.mouse(this.svgG.node())[1]);
    } else{
      d.x += d3.event.dx;
      d.y +=  d3.event.dy;
      thisGraph.updateGraph();
    }
  };

  GraphCreator.prototype.deleteGraph = function(skipPrompt){
    var thisGraph = this,
        doDelete = true;
    if (!skipPrompt){
      doDelete = window.confirm("Press OK to delete this graph");
    }
    if(doDelete){
      thisGraph.nodes = [];
      thisGraph.edges = [];
      thisGraph.updateGraph();
    }
  };

  /* select all text in element: taken from http://stackoverflow.com/questions/6139107/programatically-select-text-in-a-contenteditable-html-element */
  GraphCreator.prototype.selectElementContents = function(el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };


  /* insert svg line breaks: taken from http://stackoverflow.com/questions/13241475/how-do-i-include-newlines-in-labels-in-d3-charts */
  GraphCreator.prototype.insertTitleLinebreaks = function (gEl, title) {
    var words = title.split(/\s+/g),
        nwords = words.length;
    var el = gEl.append("text")
          .attr("text-anchor","middle")
          .attr("dy", "-" + (nwords-1)*7.5);

    for (var i = 0; i < words.length; i++) {
      var tspan = el.append('tspan').text(words[i]);
      if (i > 0)
        tspan.attr('x', 0).attr('dy', '15');
    }
  };


  // remove edges associated with a node
  GraphCreator.prototype.spliceLinksForNode = function(node) {
    var thisGraph = this,
        toSplice = thisGraph.edges.filter(function(l) {
      return (l.source === node || l.target === node);
    });
    toSplice.map(function(l) {
      thisGraph.edges.splice(thisGraph.edges.indexOf(l), 1);
    });
  };

  GraphCreator.prototype.replaceSelectEdge = function(d3Path, edgeData){
    var thisGraph = this;
    d3Path.classed(thisGraph.consts.selectedClass, true);
    if (thisGraph.state.selectedEdge){
      thisGraph.removeSelectFromEdge();
    }
    thisGraph.state.selectedEdge = edgeData;
  };

  GraphCreator.prototype.replaceSelectNode = function(d3Node, nodeData){
    var thisGraph = this;
    d3Node.classed(this.consts.selectedClass, true);
    if (thisGraph.state.selectedNode){
      thisGraph.removeSelectFromNode();
    }
    thisGraph.state.selectedNode = nodeData;
  };

  GraphCreator.prototype.removeSelectFromNode = function(){
    var thisGraph = this;
    thisGraph.circles.filter(function(cd){
      return cd.id === thisGraph.state.selectedNode.id;
    }).classed(thisGraph.consts.selectedClass, false);
    thisGraph.state.selectedNode = null;
  };

  GraphCreator.prototype.removeSelectFromEdge = function(){
    var thisGraph = this;
    thisGraph.paths.filter(function(cd){
      return cd === thisGraph.state.selectedEdge;
    }).classed(thisGraph.consts.selectedClass, false);
    thisGraph.state.selectedEdge = null;
  };

  GraphCreator.prototype.pathMouseDown = function(d3path, d){
    var thisGraph = this,
        state = thisGraph.state;
    d3.event.stopPropagation();
    state.mouseDownLink = d;

    if (state.selectedNode){
      thisGraph.removeSelectFromNode();
    }

    var prevEdge = state.selectedEdge;
    if (!prevEdge || prevEdge !== d){
      thisGraph.replaceSelectEdge(d3path, d);
    } else{
      thisGraph.removeSelectFromEdge();
    }
  };

  // mousedown on node
  GraphCreator.prototype.circleMouseDown = function(d3node, d){
    var thisGraph = this,
        state = thisGraph.state;
    d3.event.stopPropagation();
    state.mouseDownNode = d;
    if (d3.event.shiftKey){
      state.shiftNodeDrag = d3.event.shiftKey;
      // reposition dragged directed edge
      thisGraph.dragLine.classed('hidden', false)
        .attr('d', 'M' + d.x + ',' + d.y + 'L' + d.x + ',' + d.y);
      return;
    }
  };

  /* place editable text on node in place of svg text */
  GraphCreator.prototype.changeTextOfNode = function(d3node, d){
    var thisGraph= this,
        consts = thisGraph.consts,
        htmlEl = d3node.node();
    d3node.selectAll("text").remove();
    var nodeBCR = htmlEl.getBoundingClientRect(),
        curScale = nodeBCR.width/consts.nodeRadius,
        placePad  =  5*curScale,
        useHW = curScale > 1 ? nodeBCR.width*0.71 : consts.nodeRadius*1.42;
    // replace with editableconent text
    var d3txt = thisGraph.svg.selectAll("foreignObject")
          .data([d])
          .enter()
          .append("foreignObject")
          .attr("x", nodeBCR.left + placePad )
          .attr("y", nodeBCR.top + placePad)
          .attr("height", 2*useHW)
          .attr("width", useHW)
          .append("xhtml:p")
          .attr("id", consts.activeEditId)
          .attr("contentEditable", "true")
          .text(d.title)
          .on("mousedown", function(d){
            d3.event.stopPropagation();
          })
          .on("keydown", function(d){
            d3.event.stopPropagation();
            if (d3.event.keyCode == consts.ENTER_KEY && !d3.event.shiftKey){
              this.blur();
            }
          })
          .on("blur", function(d){
            d.title = this.textContent;
            thisGraph.insertTitleLinebreaks(d3node, d.title);
            d3.select(this.parentElement).remove();
          });
    return d3txt;
  };

  // mouseup on nodes
  GraphCreator.prototype.circleMouseUp = function(d3node, d){
    var thisGraph = this,
        state = thisGraph.state,
        consts = thisGraph.consts;
    // reset the states
    state.shiftNodeDrag = false;
    d3node.classed(consts.connectClass, false);

    var mouseDownNode = state.mouseDownNode;

    if (!mouseDownNode) return;

    thisGraph.dragLine.classed("hidden", true);

    if (mouseDownNode !== d){
      // we're in a different node: create new edge for mousedown edge and add to graph
      var newEdge = {source: mouseDownNode, target: d};
      var filtRes = thisGraph.paths.filter(function(d){
        if (d.source === newEdge.target && d.target === newEdge.source){
          thisGraph.edges.splice(thisGraph.edges.indexOf(d), 1);
        }
        return d.source === newEdge.source && d.target === newEdge.target;
      });
      if (!filtRes[0].length){
        thisGraph.edges.push(newEdge);
        thisGraph.updateGraph();
      }
    } else{
      // we're in the same node
      if (state.justDragged) {
        // dragged, not clicked
        state.justDragged = false;
      } else{
        // clicked, not dragged
        if (d3.event.shiftKey){
          // shift-clicked node: edit text content
          var d3txt = thisGraph.changeTextOfNode(d3node, d);
          var txtNode = d3txt.node();
          thisGraph.selectElementContents(txtNode);
          txtNode.focus();
        } else{
          if (state.selectedEdge){
            thisGraph.removeSelectFromEdge();
          }
          var prevNode = state.selectedNode;

          if (!prevNode || prevNode.id !== d.id){
            thisGraph.replaceSelectNode(d3node, d);
          } else{
            thisGraph.removeSelectFromNode();
          }
        }
      }
    }
    state.mouseDownNode = null;
    return;

  }; // end of circles mouseup

  // mousedown on main svg
  GraphCreator.prototype.svgMouseDown = function(){
    this.state.graphMouseDown = true;
  };

  // mouseup on main svg
  GraphCreator.prototype.svgMouseUp = function(){
    var thisGraph = this,
        state = thisGraph.state;
    if (state.justScaleTransGraph) {
      // dragged not clicked
      state.justScaleTransGraph = false;
    } else if (state.graphMouseDown && d3.event.shiftKey){
      // clicked not dragged from svg
      var xycoords = d3.mouse(thisGraph.svgG.node()),
          d = {id: thisGraph.idct++, title: "new concept", x: xycoords[0], y: xycoords[1]};
      thisGraph.nodes.push(d);
      thisGraph.updateGraph();
      // make title of text immediently editable
      var d3txt = thisGraph.changeTextOfNode(thisGraph.circles.filter(function(dval){
        return dval.id === d.id;
      }), d),
          txtNode = d3txt.node();
      thisGraph.selectElementContents(txtNode);
      txtNode.focus();
    } else if (state.shiftNodeDrag){
      // dragged from node
      state.shiftNodeDrag = false;
      thisGraph.dragLine.classed("hidden", true);
    }
    state.graphMouseDown = false;
  };

  // keydown on main svg
  GraphCreator.prototype.svgKeyDown = function() {
    var thisGraph = this,
        state = thisGraph.state,
        consts = thisGraph.consts;
    // make sure repeated key presses don't register for each keydown
    if(state.lastKeyDown !== -1) return;

    state.lastKeyDown = d3.event.keyCode;
    var selectedNode = state.selectedNode,
        selectedEdge = state.selectedEdge;

    switch(d3.event.keyCode) {
    case consts.BACKSPACE_KEY:
    case consts.DELETE_KEY:
      d3.event.preventDefault();
      if (selectedNode){
        thisGraph.nodes.splice(thisGraph.nodes.indexOf(selectedNode), 1);
        thisGraph.spliceLinksForNode(selectedNode);
        state.selectedNode = null;
        thisGraph.updateGraph();
      } else if (selectedEdge){
        thisGraph.edges.splice(thisGraph.edges.indexOf(selectedEdge), 1);
        state.selectedEdge = null;
        thisGraph.updateGraph();
      }
      break;
    }
  };

  GraphCreator.prototype.svgKeyUp = function() {
    this.state.lastKeyDown = -1;
  };

  // call to propagate changes to graph
  GraphCreator.prototype.updateGraph = function(){

    var thisGraph = this,
        consts = thisGraph.consts,
        state = thisGraph.state;

    thisGraph.paths = thisGraph.paths.data(thisGraph.edges, function(d){
      return String(d.source.id) + "+" + String(d.target.id);
    });
    var paths = thisGraph.paths;
    // update existing paths
    paths.style('marker-end', 'url(#end-arrow)')
      .classed(consts.selectedClass, function(d){
        return d === state.selectedEdge;
      })
      .attr("d", function(d){
        return "M" + d.source.x + "," + d.source.y + "L" + d.target.x + "," + d.target.y;
      });

    // add new paths
    paths.enter()
      .append("path")
      .style('marker-end','url(#end-arrow)')
      .classed("link", true)
      .attr("d", function(d){
        return "M" + d.source.x + "," + d.source.y + "L" + d.target.x + "," + d.target.y;
      })
      .on("mousedown", function(d){
        thisGraph.pathMouseDown.call(thisGraph, d3.select(this), d);
        }
      )
      .on("mouseup", function(d){
        state.mouseDownLink = null;
      });

    // remove old links
    paths.exit().remove();

    // update existing nodes
    thisGraph.circles = thisGraph.circles.data(thisGraph.nodes, function(d){ return d.id;});
    thisGraph.circles.attr("transform", function(d){return "translate(" + d.x + "," + d.y + ")";});

    // add new nodes
    var newGs= thisGraph.circles.enter()
          .append("g");

    newGs.classed(consts.circleGClass, true)
      .attr("transform", function(d){return "translate(" + d.x + "," + d.y + ")";})
      .on("mouseover", function(d){
        if (state.shiftNodeDrag){
          d3.select(this).classed(consts.connectClass, true);
        }
      })
      .on("mouseout", function(d){
        d3.select(this).classed(consts.connectClass, false);
      })
      .on("mousedown", function(d){
        thisGraph.circleMouseDown.call(thisGraph, d3.select(this), d);
      })
      .on("mouseup", function(d){
        thisGraph.circleMouseUp.call(thisGraph, d3.select(this), d);
      })
      .call(thisGraph.drag);

    newGs.append("circle")
      .attr("r", String(consts.nodeRadius));

    newGs.each(function(d){
      thisGraph.insertTitleLinebreaks(d3.select(this), d.title);
    });

    // remove old nodes
    thisGraph.circles.exit().remove();
  };

  GraphCreator.prototype.zoomed = function(){
    this.state.justScaleTransGraph = true;
    d3.select("." + this.consts.graphClass)
      .attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
  };

  GraphCreator.prototype.updateWindow = function(svg){
    var docEl = document.documentElement,
        bodyEl = document.getElementsByTagName('body')[0];
    var x = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
    var y = window.innerHeight|| docEl.clientHeight|| bodyEl.clientHeight;
    svg.attr("width", x).attr("height", y);
  };



  /**** MAIN ****/

  // warn the user when leaving
  window.onbeforeunload = function(){
    return "Make sure to save your graph locally before leaving :-)";
  };

  var docEl = document.documentElement,
      bodyEl = document.getElementsByTagName('body')[0];

  var width = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth,
      height =  window.innerHeight|| docEl.clientHeight|| bodyEl.clientHeight;

  var xLoc = width/2 - 25,
      yLoc = 100;

  // initial node data

    var nodes = [
        {title: 'BUG#5752', id: 5752, x: xLoc, y: yLoc+0},
{title: 'BUG#11219', id: 11219, x: xLoc, y: yLoc+100},
{title: 'BUG#5935', id: 5935, x: xLoc, y: yLoc+200},
{title: 'BUG#1', id: 1, x: xLoc, y: yLoc+300},
{title: 'BUG#5696', id: 5696, x: xLoc, y: yLoc+400},
{title: 'BUG#6062', id: 6062, x: xLoc, y: yLoc+500},
{title: 'BUG#6066', id: 6066, x: xLoc, y: yLoc+600},
{title: 'BUG#6078', id: 6078, x: xLoc, y: yLoc+700},
{title: 'BUG#6180', id: 6180, x: xLoc, y: yLoc+800},
{title: 'BUG#6221', id: 6221, x: xLoc, y: yLoc+900},
{title: 'BUG#6307', id: 6307, x: xLoc, y: yLoc+1000},
{title: 'BUG#6308', id: 6308, x: xLoc, y: yLoc+1100},
{title: 'BUG#6315', id: 6315, x: xLoc, y: yLoc+1200},
{title: 'BUG#6317', id: 6317, x: xLoc, y: yLoc+1300},
{title: 'BUG#6318', id: 6318, x: xLoc, y: yLoc+1400},
{title: 'BUG#6332', id: 6332, x: xLoc, y: yLoc+1500},
{title: 'BUG#6419', id: 6419, x: xLoc, y: yLoc+1600},
{title: 'BUG#6539', id: 6539, x: xLoc, y: yLoc+1700},
{title: 'BUG#6796', id: 6796, x: xLoc, y: yLoc+1800},
{title: 'BUG#6924', id: 6924, x: xLoc, y: yLoc+1900},
{title: 'BUG#6974', id: 6974, x: xLoc, y: yLoc+2000},
{title: 'BUG#7190', id: 7190, x: xLoc, y: yLoc+2100},
{title: 'BUG#7224', id: 7224, x: xLoc, y: yLoc+2200},
{title: 'BUG#7244', id: 7244, x: xLoc, y: yLoc+2300},
{title: 'BUG#7266', id: 7266, x: xLoc, y: yLoc+2400},
{title: 'BUG#7306', id: 7306, x: xLoc, y: yLoc+2500},
{title: 'BUG#7315', id: 7315, x: xLoc, y: yLoc+2600},
{title: 'BUG#7323', id: 7323, x: xLoc, y: yLoc+2700},
{title: 'BUG#7324', id: 7324, x: xLoc, y: yLoc+2800},
{title: 'BUG#7325', id: 7325, x: xLoc, y: yLoc+2900},
{title: 'BUG#7329', id: 7329, x: xLoc, y: yLoc+3000},
{title: 'BUG#7402', id: 7402, x: xLoc, y: yLoc+3100},
{title: 'BUG#7551', id: 7551, x: xLoc, y: yLoc+3200},
{title: 'BUG#7556', id: 7556, x: xLoc, y: yLoc+3300},
{title: 'BUG#7942', id: 7942, x: xLoc, y: yLoc+3400},
{title: 'BUG#8338', id: 8338, x: xLoc, y: yLoc+3500},
{title: 'BUG#8339', id: 8339, x: xLoc, y: yLoc+3600},
{title: 'BUG#8467', id: 8467, x: xLoc, y: yLoc+3700},
{title: 'BUG#8489', id: 8489, x: xLoc, y: yLoc+3800},
{title: 'BUG#8502', id: 8502, x: xLoc, y: yLoc+3900},
{title: 'BUG#8515', id: 8515, x: xLoc, y: yLoc+4000},
{title: 'BUG#8517', id: 8517, x: xLoc, y: yLoc+4100},
{title: 'BUG#8674', id: 8674, x: xLoc, y: yLoc+4200},
{title: 'BUG#8786', id: 8786, x: xLoc, y: yLoc+4300},
{title: 'BUG#8908', id: 8908, x: xLoc, y: yLoc+4400},
{title: 'BUG#8962', id: 8962, x: xLoc, y: yLoc+4500},
{title: 'BUG#9047', id: 9047, x: xLoc, y: yLoc+4600},
{title: 'BUG#9055', id: 9055, x: xLoc, y: yLoc+4700},
{title: 'BUG#9192', id: 9192, x: xLoc, y: yLoc+4800},
{title: 'BUG#9196', id: 9196, x: xLoc, y: yLoc+4900},
{title: 'BUG#9360', id: 9360, x: xLoc, y: yLoc+5000},
{title: 'BUG#9381', id: 9381, x: xLoc, y: yLoc+5100},
{title: 'BUG#9397', id: 9397, x: xLoc, y: yLoc+5200},
{title: 'BUG#9440', id: 9440, x: xLoc, y: yLoc+5300},
{title: 'BUG#9444', id: 9444, x: xLoc, y: yLoc+5400},
{title: 'BUG#9454', id: 9454, x: xLoc, y: yLoc+5500},
{title: 'BUG#9471', id: 9471, x: xLoc, y: yLoc+5600},
{title: 'BUG#9498', id: 9498, x: xLoc, y: yLoc+5700},
{title: 'BUG#9546', id: 9546, x: xLoc, y: yLoc+5800},
{title: 'BUG#10295', id: 10295, x: xLoc, y: yLoc+5900},
{title: 'BUG#10403', id: 10403, x: xLoc, y: yLoc+6000},
{title: 'BUG#11067', id: 11067, x: xLoc, y: yLoc+6100},
{title: 'BUG#11683', id: 11683, x: xLoc, y: yLoc+6200},
{title: 'BUG#11733', id: 11733, x: xLoc, y: yLoc+6300},
{title: 'BUG#12558', id: 12558, x: xLoc, y: yLoc+6400},
{title: 'BUG#6472', id: 6472, x: xLoc, y: yLoc+6500},
{title: 'BUG#965', id: 965, x: xLoc, y: yLoc+6600},
{title: 'BUG#2237', id: 2237, x: xLoc, y: yLoc+6700},
{title: 'BUG#2239', id: 2239, x: xLoc, y: yLoc+6800},
{title: 'BUG#2575', id: 2575, x: xLoc, y: yLoc+6900},
{title: 'BUG#2619', id: 2619, x: xLoc, y: yLoc+7000},
{title: 'BUG#2781', id: 2781, x: xLoc, y: yLoc+7100},
{title: 'BUG#3170', id: 3170, x: xLoc, y: yLoc+7200},
{title: 'BUG#3202', id: 3202, x: xLoc, y: yLoc+7300},
{title: 'BUG#3246', id: 3246, x: xLoc, y: yLoc+7400},
{title: 'BUG#3426', id: 3426, x: xLoc, y: yLoc+7500},
{title: 'BUG#3427', id: 3427, x: xLoc, y: yLoc+7600},
{title: 'BUG#4220', id: 4220, x: xLoc, y: yLoc+7700},
{title: 'BUG#4458', id: 4458, x: xLoc, y: yLoc+7800},
{title: 'BUG#4505', id: 4505, x: xLoc, y: yLoc+7900},
{title: 'BUG#4783', id: 4783, x: xLoc, y: yLoc+8000},
{title: 'BUG#4814', id: 4814, x: xLoc, y: yLoc+8100},
{title: 'BUG#5218', id: 5218, x: xLoc, y: yLoc+8200},
{title: 'BUG#5680', id: 5680, x: xLoc, y: yLoc+8300},
{title: 'BUG#5751', id: 5751, x: xLoc, y: yLoc+8400},
{title: 'BUG#5823', id: 5823, x: xLoc, y: yLoc+8500},
{title: 'BUG#5907', id: 5907, x: xLoc, y: yLoc+8600},
{title: 'BUG#3457', id: 3457, x: xLoc, y: yLoc+8700},
{title: 'BUG#6061', id: 6061, x: xLoc, y: yLoc+8800},
{title: 'BUG#8352', id: 8352, x: xLoc, y: yLoc+8900},
{title: 'BUG#9054', id: 9054, x: xLoc, y: yLoc+9000},
{title: 'BUG#9450', id: 9450, x: xLoc, y: yLoc+9100},
{title: 'BUG#194', id: 194, x: xLoc, y: yLoc+9200},
{title: 'BUG#553', id: 553, x: xLoc, y: yLoc+9300},
{title: 'BUG#2288', id: 2288, x: xLoc, y: yLoc+9400},
{title: 'BUG#2565', id: 2565, x: xLoc, y: yLoc+9500},
{title: 'BUG#3914', id: 3914, x: xLoc, y: yLoc+9600},
{title: 'BUG#4058', id: 4058, x: xLoc, y: yLoc+9700},
{title: 'BUG#4097', id: 4097, x: xLoc, y: yLoc+9800},
{title: 'BUG#5105', id: 5105, x: xLoc, y: yLoc+9900},
{title: 'BUG#6067', id: 6067, x: xLoc, y: yLoc+10000},
{title: 'BUG#5753', id: 5753, x: xLoc, y: yLoc+10100},
{title: 'BUG#10881', id: 10881, x: xLoc, y: yLoc+10200},
{title: 'BUG#5932', id: 5932, x: xLoc, y: yLoc+10300},
{title: 'BUG#3405', id: 3405, x: xLoc, y: yLoc+10400},
{title: 'BUG#11475', id: 11475, x: xLoc, y: yLoc+10500},
{title: 'BUG#6063', id: 6063, x: xLoc, y: yLoc+10600},
{title: 'BUG#6462', id: 6462, x: xLoc, y: yLoc+10700},
{title: 'BUG#6138', id: 6138, x: xLoc, y: yLoc+10800},
{title: 'BUG#6239', id: 6239, x: xLoc, y: yLoc+10900},
{title: 'BUG#6309', id: 6309, x: xLoc, y: yLoc+11000},
{title: 'BUG#6321', id: 6321, x: xLoc, y: yLoc+11100},
{title: 'BUG#6379', id: 6379, x: xLoc, y: yLoc+11200},
{title: 'BUG#6334', id: 6334, x: xLoc, y: yLoc+11300},
{title: 'BUG#6423', id: 6423, x: xLoc, y: yLoc+11400},
{title: 'BUG#6538', id: 6538, x: xLoc, y: yLoc+11500},
{title: 'BUG#6795', id: 6795, x: xLoc, y: yLoc+11600},
{title: 'BUG#6921', id: 6921, x: xLoc, y: yLoc+11700},
{title: 'BUG#7002', id: 7002, x: xLoc, y: yLoc+11800},
{title: 'BUG#5773', id: 5773, x: xLoc, y: yLoc+11900},
{title: 'BUG#7028', id: 7028, x: xLoc, y: yLoc+12000},
{title: 'BUG#7281', id: 7281, x: xLoc, y: yLoc+12100},
{title: 'BUG#7330', id: 7330, x: xLoc, y: yLoc+12200},
{title: 'BUG#3239', id: 3239, x: xLoc, y: yLoc+12300},
{title: 'BUG#7552', id: 7552, x: xLoc, y: yLoc+12400},
{title: 'BUG#7699', id: 7699, x: xLoc, y: yLoc+12500},
{title: 'BUG#7966', id: 7966, x: xLoc, y: yLoc+12600},
{title: 'BUG#8414', id: 8414, x: xLoc, y: yLoc+12700},
{title: 'BUG#8461', id: 8461, x: xLoc, y: yLoc+12800},
{title: 'BUG#8490', id: 8490, x: xLoc, y: yLoc+12900},
{title: 'BUG#8505', id: 8505, x: xLoc, y: yLoc+13000},
{title: 'BUG#8693', id: 8693, x: xLoc, y: yLoc+13100},
{title: 'BUG#8673', id: 8673, x: xLoc, y: yLoc+13200},
{title: 'BUG#8794', id: 8794, x: xLoc, y: yLoc+13300},
{title: 'BUG#9008', id: 9008, x: xLoc, y: yLoc+13400},
{title: 'BUG#8961', id: 8961, x: xLoc, y: yLoc+13500},
{title: 'BUG#9146', id: 9146, x: xLoc, y: yLoc+13600},
{title: 'BUG#8849', id: 8849, x: xLoc, y: yLoc+13700},
{title: 'BUG#9238', id: 9238, x: xLoc, y: yLoc+13800},
{title: 'BUG#9369', id: 9369, x: xLoc, y: yLoc+13900},
{title: 'BUG#9364', id: 9364, x: xLoc, y: yLoc+14000},
{title: 'BUG#9476', id: 9476, x: xLoc, y: yLoc+14100},
{title: 'BUG#9441', id: 9441, x: xLoc, y: yLoc+14200},
{title: 'BUG#9472', id: 9472, x: xLoc, y: yLoc+14300},
{title: 'BUG#9589', id: 9589, x: xLoc, y: yLoc+14400},
{title: 'BUG#9174', id: 9174, x: xLoc, y: yLoc+14500},
{title: 'BUG#10294', id: 10294, x: xLoc, y: yLoc+14600},
{title: 'BUG#7881', id: 7881, x: xLoc, y: yLoc+14700},
{title: 'BUG#11179', id: 11179, x: xLoc, y: yLoc+14800},
{title: 'BUG#12015', id: 12015, x: xLoc, y: yLoc+14900},
{title: 'BUG#11998', id: 11998, x: xLoc, y: yLoc+15000},
{title: 'BUG#12859', id: 12859, x: xLoc, y: yLoc+15100},
{title: 'BUG#6537', id: 6537, x: xLoc, y: yLoc+15200},
{title: 'BUG#1106', id: 1106, x: xLoc, y: yLoc+15300},
{title: 'BUG#2241', id: 2241, x: xLoc, y: yLoc+15400},
{title: 'BUG#2576', id: 2576, x: xLoc, y: yLoc+15500},
{title: 'BUG#2622', id: 2622, x: xLoc, y: yLoc+15600},
{title: 'BUG#2796', id: 2796, x: xLoc, y: yLoc+15700},
{title: 'BUG#3185', id: 3185, x: xLoc, y: yLoc+15800},
{title: 'BUG#3217', id: 3217, x: xLoc, y: yLoc+15900},
{title: 'BUG#3278', id: 3278, x: xLoc, y: yLoc+16000},
{title: 'BUG#3428', id: 3428, x: xLoc, y: yLoc+16100},
{title: 'BUG#4190', id: 4190, x: xLoc, y: yLoc+16200},
{title: 'BUG#4460', id: 4460, x: xLoc, y: yLoc+16300},
{title: 'BUG#4539', id: 4539, x: xLoc, y: yLoc+16400},
{title: 'BUG#3545', id: 3545, x: xLoc, y: yLoc+16500},
{title: 'BUG#5868', id: 5868, x: xLoc, y: yLoc+16600},
{title: 'BUG#7187', id: 7187, x: xLoc, y: yLoc+16700},
{title: 'BUG#6366', id: 6366, x: xLoc, y: yLoc+16800},
{title: 'BUG#5824', id: 5824, x: xLoc, y: yLoc+16900},
{title: 'BUG#5909', id: 5909, x: xLoc, y: yLoc+17000},
{title: 'BUG#3540', id: 3540, x: xLoc, y: yLoc+17100},
{title: 'BUG#9325', id: 9325, x: xLoc, y: yLoc+17200},
{title: 'BUG#9066', id: 9066, x: xLoc, y: yLoc+17300},
{title: 'BUG#9445', id: 9445, x: xLoc, y: yLoc+17400},
{title: 'BUG#221', id: 221, x: xLoc, y: yLoc+17500},
{title: 'BUG#3817', id: 3817, x: xLoc, y: yLoc+17600},
{title: 'BUG#2327', id: 2327, x: xLoc, y: yLoc+17700},
{title: 'BUG#2694', id: 2694, x: xLoc, y: yLoc+17800},
{title: 'BUG#4109', id: 4109, x: xLoc, y: yLoc+17900},
{title: 'BUG#4049', id: 4049, x: xLoc, y: yLoc+18000},
{title: 'BUG#4169', id: 4169, x: xLoc, y: yLoc+18100},
{title: 'BUG#5194', id: 5194, x: xLoc, y: yLoc+18200},
{title: 'BUG#6068', id: 6068, x: xLoc, y: yLoc+18300},

    ];
    var edges = [{source: nodes[1], target: nodes[0]}];
//   var nodes = [{title: "new concept", id: 0, x: xLoc, y: yLoc},
//               {title: "new concept", id: 1, x: xLoc, y: yLoc + 200}];
//   var edges = [{source: nodes[1], target: nodes[0]}];


  /** MAIN SVG **/
  var svg = d3.select("#graph-holder").append("svg")
        .attr("width", width)
        .attr("height", height);
  var graph = new GraphCreator(svg, nodes, edges);
      graph.setIdCt(2);
  graph.updateGraph();
})(window.d3, window.saveAs, window.Blob);