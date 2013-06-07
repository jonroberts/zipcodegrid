
var map_details={"kwh_pop":{"name":"Electricity use per person","max":0,"min":-1,"units":"kwh/person","num_decimal":0,
					"questions":[
						{"question":"Which New Yorkers use the most electricity?","answer":"It's Wall Street","zipcode":"MOST"},
						{"question":"What's up with Central Park?","answer":"No one lives here - so there's no residential energy use.","zipcode":"NY00083"}
					]},
				"kwh_house":{"name":"Electricity use per household","max":0,"min":-1,"units":"kwh/house","num_decimal":0,
					"questions":[
						{"question":"Which households use the most?","answer":"","zipcode":"MOST"},
						{'question': 'Why is this map different to the per person map?' , 'answer': 'Families tend to use less electricity per person.' , 'zip code': ''}
					]},
				"E_pct_income":{"name":"% of income spent on electricity","max":0,"min":-1,"units":"percent of income","num_decimal":1,
					"questions":[
						{"question":"Who spends the most of their income on electricity?","answer":"","zipcode":"MOST"},
					]},
				"taxcredit_per_house":{"name":"Energy credits per household","max":0,"min":-1,"units":"tax credits per household","num_decimal":2,
					"questions":[
						{"question":"Who gets the most renewable energy tax credits?","answer":"","zipcode":"MOST"},
						{'question': 'Are you eligible for energy credits?' , 'answer': 'Go find out <a href=\"\">here</a>' , 'zip code': ''},
					]},
				"E_tot_density":{"name":"Electricity density - total","max":0,"min":-1,"units":"kwh/m^2","num_decimal":0,
					"questions":[
						{"question":"Where is the most electricity used?","answer":"","zipcode":"MOST"},
						{'question': 'Is this how NYC looks from the sky?' , 'answer': 'Almost. Not all electricity becomes <a href="http://www.nasa.gov/multimedia/imagegallery/image_feature_2480.html" target=_blank>light</a>' , 'zip code': ''},
						{'question': 'How much of the total usage comes from households?' , 'answer': 'That depends strongly on location. Compare the different density maps!' , 'zip code': ''} 
					]},
				"E_density":{"name":"Residential energy density","max":0,"min":-1,"units":" residential kwh/m^2","num_decimal":0,
					"questions":[
						{"question":"Where is the most residential electricity used?","answer":"","zipcode":"MOST"},
					]},
				"E_comm_density":{"name":"Commercial electricity density","max":0,"min":-1,"units":"commercial kwh/m^2","num_decimal":0,
					"questions":[
						{"question":"Where is the most electricity used by businesses?","answer":"","zipcode":"MOST"},
					]},
				"E_inst_density":{"name":"Institutional electricity density","max":0,"min":-1,"units":"institutional kwh/m^2","num_decimal":0,
					"questions":[
						{"question":"Where is the most electricity used by the city?","answer":"","zipcode":"MOST"},
					]}
				}

var mapKeys=[];
for(var key in map_details){
	mapKeys.push(key);
}

// example dict of data for a zipcode:
/*
"NY11435": {
			"kwh_pop": 1445.3028852422374,
			"rank_kwh_pop": 150,
			"kwh_house": 4377.904310539381,
			"rank_kwh_house": 134,
			"taxcredit_per_house": 0.33338975400586773,
			"rank_taxcredit_per_house": 34,
			"E_pct_income": 2.1854715894050827,
			"rank_E_pct_income": 120,

			"E_tot_density": 120649205.94059406,
			"rank_E_tot_density": 106,
			"E_density": 51217145.87458746,
			"rank_E_density": 104,
			"E_comm_density": 45887733.993399344,
			"rank_E_comm_density": 103,
			"E_inst_density": 23544326.072607264,
			"rank_E_inst_density": 63,

			"kwh_household_income": 0.08094339220018824,
			"rank_kwh_household_income": 120,
			"pop": 53687.0,
			"area": 1.515,
			"num_house": 17724.0,
			"E_GJ": 279339.0,
			"tax_credit": 5909.0,
			"E_inst_kwh": 35669654.0,
			"avg_home_value": 380400.0,
			"median_income": 54086.0,
			"E_comm_GJ": 250272.0,
			"E_kwh": 77593976.0,
			"E_inst_GJ": 128411.0,
			"E_comm_kwh": 69519917.0,
			}
*/

function initData(){
	for(var i in zipcodes.features){
		var zip=zipcodes.features[i];
		var id="NY"+zip.id;
		if(id in elec_pop){
			for(var key in elec_pop[id]){zip[key]=elec_pop[id][key];}
			for(var key in map_details){
				map_details[key]["min"]=(map_details[key]["min"]==-1 || map_details[key]["min"]>zip[key])?zip[key]:map_details[key]["min"];
				map_details[key]["max"]=(map_details[key]["max"]==0 || map_details[key]["max"]<zip[key])?zip[key]:map_details[key]["max"];
			}
		}
		else{for(var key in elec_pop["NY10012"]){zip[key]=0;}}
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
	.scale(183300*0.45)
	.translate([-23700,5980]);

var path = d3.geo.path().projection(projection);

var drag = d3.behavior.drag()
        .on("drag",function(d){dragging(d);});

var map = d3.select("body").append("svg")
	.classed("map",true)
    .attr("width", width)
    .attr("height", height)
	.call(drag);
map.current="kwh_pop";

var background=map.append("rect")
	.attr("class","background")
    .attr("width", width)
    .attr("height", height)
	.on("click",function(){resetSidebar();});

var g = map.append("g")
    .attr("id", "zips")
	.call(drag);

function getColor(d){
	key=map.current;
	var ratio=(d[key]-map_details[key]["min"])*(255/(1.*map_details[key]["max"]-map_details[key]["min"]));
	if(ratio>0){
		return d3.hsl(255-ratio,0.4,0.5);
	}else{
		return "lightgrey";
	}
}

function getColorWithKey(d,key){
	var ratio=(d[key]-map_details[key]["min"])*(255/(1.*map_details[key]["max"]-map_details[key]["min"]));
	if(ratio>0){
		return d3.hsl(255-ratio,0.4,0.5);
	}else{
		return "lightgrey";
	}
}


g.selectAll("path")
	  .data(zipcodes.features)
	.enter().append("path")
	  .attr("d", path)
	  .attr("id", function(d){return "NY"+d.id;})
	  .style("fill",function(d){return getColor(d,"kwh_pop")})
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
	g.append("path")
	      .attr("d", d3.select(this).attr("d"))
	      .attr("id", "arcSelection")
	      .style("fill", "none")
	      .style("stroke", "#fff")
	      .style("stroke-width", 3 / k + "px");

	var text="NY"+d.id;
	if(d.id in neighborhoods){text+="<br/>"+neighborhoods[d.id]["neighborhood"];}
	if(d.pop>0){
		if(d[map.current]>0){
			text+="<br/>"+d[map.current].toFixed(map_details[map.current]["num_decimal"])+" "+map_details[map.current]["units"];} 
		else{
			text+="<br/>0 "+map_details[map.current]["units"];}
	}

	$(".mouseover").html(text);
	$(".mouseover").css("display","inline");
}

function mouseout(){
    d3.select("#arcSelection").remove();

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

function fill_questions(){
	var qs=$("#questions");
	var text=""
	for(var i in map_details[map.current]["questions"]){
		question=map_details[map.current]["questions"][i]["question"];
		answer=map_details[map.current]["questions"][i]["answer"];
		zipcode=map_details[map.current]["questions"][i]["zipcode"];
		console.log(question);
		// set up the zoom behaviour
		if(zipcode=="MOST"){text+="<li>&#9657; <a href='' onclick='goto_most();";}
		else if(zipcode=="LEAST"){text+="<li>&#9657; <a href='' onclick='goto_least();";}
		else if(zipcode!=undefined & zipcode!=""){text+="<li>&#9657; <a href='' onclick='zoom_to_zip(\""+zipcode+"\");";}
		else{text+="<li>&#9657; <a href='' onclick='";}
		
		// now add the showAnswer function if the answer exists
		if(answer!=""){text+="showAnswer(this.parentNode);return false;'>"+question+"</a><p class=\"answer\" style=\"display:none\">"+answer+"</p></li>";}
		else{text+="return false;'>"+question+"</a></li>";}
		
	}
	qs.html(text);
}

function zoom_in(){
	k*=2.;
	if(k>8){
		k=8;
	}
	else{
		g.transition()
	      .duration(1000)
	      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")")	
		  .style("stroke-width", 1 / k + "px");
	}
}
function zoom_out(){
	k*=0.5;
	if(k<1){
		k=1;
	}
	else{
		g.transition()
	      .duration(1000)
	      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")")	
		  .style("stroke-width", 1 / k + "px");
	}
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

function energy_conversion(kWh){
    production = {'coal':0.137535, 'oil':0.162274, 'gas':0.224641, 'ofossil':0.006988,'nuclear':0.286643, 'hydro':0.168852, 'oren':0.013067};

    units  = {'kWh':1, 'MJ':3.62, 'GJ':3.62e-3, 'Btu':3412, 'gas':0.0944, 'oil':5.89e-4, 'coal':5.35e-4};

    output = {'CO2':kWh*0.828, 'CO2_tonnes':kWh*0.828/2000}; // add CO2 emission in pounds and tonnes

    for (var fuel_type in production){
        if(fuel_type in units){
	            output[fuel_type]=kWh*production[fuel_type]*units[fuel_type];
            }
        else{
	            output[fuel_type]=kWh*production[fuel_type]; // this will just return number of kWh from fuel type
            }
    }
    return output;
    }

function click(d) {
	$('#zip_input').blur();

  if (d && centered !== d) {
    var centroid = path.centroid(d);
    x = centroid[0];
    y = centroid[1];
    k = 4;
    centered = d;
	//$("#zip_input")[0].value=d.id;

  } else {
	$("#zip_input")[0].value=null;
  
    x = width / 2;
    y = height / 2;
    k = 1;
    centered = null;
  }
  if(centered === d){
	setSidebarContent(d);
  }
  else{
  }

  g.transition()
      .duration(1000)
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")")
      .style("stroke-width", 1 / k + "px");
}

function showSidebar(){
	d3.select("#sidebar")
		.transition().duration(1000)
		.style("margin-left","20px");
}
function hideSidebar(){
	d3.select("#sidebar")
		.transition().duration(1000)
		.style("margin-left","-325px");
}
var suffix = function(n) {
	var d = (n|0)%100;
	return d > 3 && d < 21 ? 'th' : ['th', 'st', 'nd', 'rd'][d%10] || 'th';
};
function setSidebarContent(d){
	if(d.pop==0){$("#zip_details > div.title").html("<p>NY"+d.id+"</p><p>Nobody lives here!</p>");}
	else if(d.id in neighborhoods){	$("#zip_details > div.title").html("NY"+d.id+": "+neighborhoods[d.id]["neighborhood"]);}
	else{ $("#zip_details > div.title").html("NY"+d.id);}
	var content="";
	if(d.pop>0){
		
		content+="<p>Energy per person: "+(d.kwh_pop).toFixed(0)+"kwh</p>";
		var color=getColorWithKey(d,"kwh_pop");
		content+="<p style='text-align:center'><span class='ranking' style='color:"+color+"'>"+(d.rank_kwh_pop).toFixed(0)+suffix(d.rank_kwh_pop)+"</span> of <span class='out_of'>175</span>  </p>";

		content+="<p>Energy per household: "+(d.kwh_house).toFixed(0)+"kwh</p>";
		color=getColorWithKey(d,"kwh_house");
		content+="<p style='text-align:center'><span class='ranking' style='color:"+color+"'>"+(d.rank_kwh_house).toFixed(0)+suffix(d.rank_kwh_house)+"</span></p>";

		content+="<p>% of income on electricity: "+(d.E_pct_income).toFixed(0)+"%</p>";
		color=getColorWithKey(d,"E_pct_income");
		content+="<p style='text-align:center'><span class='ranking' style='color:"+color+"'>"+(d.rank_E_pct_income).toFixed(0)+suffix(d.rank_E_pct_income)+"</span></p>";
	}  
	$("#zip_details > div.content").html(content);
	$("#zip_details").show();
	$("#map_intro").hide();
}

function resetSidebar(){
	$("#zip_details").hide();
	$("#map_intro").show();
}

function resize(){
	width=window.innerWidth;
	height=window.innerHeight;

	$(".choice_box").css("margin-top",(height-300)/2.);
	$(".map").width(width);
	$(".map").height(height);
}

function init(){
	// sets up the dropdown that lets us choose between the maps
	var sel = $('#map_selector');
	for(var key in map_details){sel.append($("<option>").attr('value',key).attr('name',key).text(map_details[key]["name"]));}
	$('#map_picker').show();
	constructDateInput();
	fill_questions();
}
