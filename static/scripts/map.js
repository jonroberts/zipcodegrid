
var maxratio=0;
function initData(){
	for(var i in zipcodes.features){
		
		var zip=zipcodes.features[i];
		var id=zip.id;
		if(id in elec_pop){
			zip["pop"]=elec_pop[id]["pop"];
			zip["num_house"]=elec_pop[id]["num_house"];
			zip["E_kwh"]=elec_pop[id]["E_kwh"];
			zip["E_GJ"]=elec_pop[id]["E_GJ"];
			maxratio=(maxratio<zip.E_kwh/zip.pop)?zip.E_kwh/zip.pop:maxratio;
		}
		else{
			zip["pop"]=0;
			zip["num_house"]=0;
			zip["E_kwh"]=0;
			zip["E_GJ"]=0;
		}
	}
}

var width = window.innerWidth,
    height = window.innerHeight-20,
    centered;

var x=width/2.;
var y=height/2.;
var sum_dx=0;
var sum_dy=0;
var k=1;

initData();

var projection = d3.geo.albersUsa()
	.scale(183300)
	.translate([-53523.6,13034]);

var path = d3.geo.path().projection(projection);

/*var zoom = d3.behavior.zoom()
    //.translate(projection.translate())
    //.scale(projection.scale())
    //.scaleExtent([183300, 183300*4])
    .on("zoom", zoom);

function zoom() {
	console.log(d3.event);

	//console.log(d3.event.translate);
	//console.log(d3.event.dx);
	return false;
  //projection.translate(d3.event.translate).scale(d3.event.scale);
  //g.selectAll("path").attr("d", path);
}*/

var drag = d3.behavior.drag()
        .on("drag",function(d){dragging(d);});

var svg = d3.select("body").append("svg")
	.classed("map",true)
    .attr("width", width)
    .attr("height", height)
	.call(drag);

var g = svg.append("g")
    .attr("id", "states")
    //.call(zoom)
	.call(drag);

g.selectAll("path")
	  .data(zipcodes.features)
	.enter().append("path")
	  .attr("d", path)
	  .attr("id", function(d){return "NY"+d.id;})
	  .style("fill",function(d){var ratio=d.E_kwh/d.pop*(255/maxratio); if(ratio>0){return d3.hsl(255-ratio,0.4,0.5);}else{return "black";}})
	  .style("opacity",0.7)
	  .on("click", click)
	  .on("mouseover",mouseover)
	  .on("mouseout",mouseout);

d3.select('html') // Selects the 'html' element
  .on('mousemove', function()
    {
		var locs=d3.mouse(this);
	
		locs[0]+=15;
		locs[1]+=5;

		$(".mouseover").css("margin-left",locs[0]);
		$(".mouseover").css("margin-top",locs[1]);
    });

function mouseover(d){
	var obj=d;
	g.selectAll("path")
      .style("opacity", function(d){return (d===obj)?1:0.7;});

	var text="NY"+d.id;
	if(d.id in neighborhoods){text+="<br/>"+neighborhoods[d.id]["neighborhood"];}
	if(d.pop>0){text+="<br/>"+(d.E_kwh/(d.pop)).toFixed(0)+" kwh/person";}  

	$(".mouseover").html(text);
	$(".mouseover").css("display","inline");
}

function mouseout(){
	$(".mouseover").text("");
	$(".mouseover").css("display","none");
}

function dragging(d){
	$(".mouseover").css("display","none");
	dx=d3.event.dx/(1.*k);
	dy=d3.event.dy/(1.*k);
	
	sum_dx+=dx;
	sum_dy+=dy;
	
	x-=dx;
	y-=dy;
	
	g.attr("transform", "translate(" + width / 2 + "," + height / 2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")")
}

function anticlick(){
    x = width / 2;
    y = height / 2;
    k = 1;
    centered = null;
	
  g.selectAll("path")
      .style("opacity", function(d){return (centered && (d===centered))?1:0.7;});

  g.transition()
      .duration(1000)
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")")
      .style("stroke-width", 1 / k + "px");
}

function click(d) {

  if (d && centered !== d) {
    var centroid = path.centroid(d);
    x = centroid[0];
    y = centroid[1];
    k = 4;
    centered = d;
  } else {
    x = width / 2;
    y = height / 2;
    k = 1;
    centered = null;
  }
  if(centered === d){
	  $("#sidebar > .title").html("NY"+d.id);
	  var content="<p>"
	  if(d.id in neighborhoods){content+="<p/><p>"+neighborhoods[d.id]["neighborhood"];}
	  if(d.pop>0){content+="<p/><p>"+(d.E_kwh/(d.pop)).toFixed(0)+" kwh/person";}  
	  content+="</p>";
	  $("#sidebar > .content").html(content);
	  
	  showSidebar();
  }
  else{
	  hideSidebar();
  }
  g.selectAll("path")
      .style("opacity", function(d){return (centered && (d===centered))?1:0.7;});

  g.transition()
      .duration(1000)
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")")
      .style("stroke-width", 1 / k + "px");
}

function showSidebar(){
	d3.select("#sidebar")
		.transition().duration(1000)
		.style("margin-left","-1px");
}
function hideSidebar(){
	d3.select("#sidebar")
		.transition().duration(1000)
		.style("margin-left","-255px");
}


function resize(){
	width=window.innerWidth;
	height=window.innerHeight-25;

	$(".choice_box").css("margin-top",(height-300)/2.);
	$(".map").width(width);
	$(".map").height(height);
}

