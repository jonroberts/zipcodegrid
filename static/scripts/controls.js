
function switch_map(arg){
	map.current=arg;
	g.selectAll("path").transition().duration(1000)
	  .style("fill",function(d){return getColor(d);})	
	$("#map_selector").blur();
	fill_questions();
}

function zip_chosen(input){
	var base=$("#zip_input").val();
	var zip_in=base;
	if(base.length==5){zip_in="NY"+$("#zip_input").val();}
	$("#zip_input")[0].value=null;
	if(zip_in in elec_pop){
		zoom_to_zip(zip_in);
	}
	else{
		$("#zip_input")[0].placeholder="Please enter a valid ZIP";
		return false;
	}
}

function showAnswer(q){
	$(q).children(".answer").show();
}

function zoom_to_zip(zip_in){
	var data=d3.select("#"+zip_in).datum();
	click(data);
}

function goto_most(){
	var most_zip="";
	var key=map.current;
	var tMax=map_details[map.current].max;
	for(var i in zipcodes.features){
		var zip=zipcodes.features[i];
		if(zip[key]>=tMax){zoom_to_zip("NY"+zip.id); break;}
	}
	return false;
}
function goto_least(){
	var most_zip="";
	var key=map.current;
	var tMin=map_details[map.current].min;
	for(var i in zipcodes.features){
		var zip=zipcodes.features[i];
		if(zip[key]<=tMin){zoom_to_zip("NY"+zip.id); break;}
	}
	return false;	
}

function goto_map(){
	$.scrollTo( '.map', 500);
}

function goto_energy_comp(){
	$.scrollTo( '#energy_comparison', 500);
}


function analyse_usage(form){	
	var data={};
	var count=0;
	for(var e in form.elements){
		var entry=form.elements[e];
		if(entry.value==""){continue;}
		if(entry.value==undefined){continue;}

		data[entry.name]=entry.value;
		count+=1;
	}
	if(count<4){
		$('#energy_error_message').html("Please enter data for at least 2 months");
		$('#energy_error').show();
		return false;
	}
	
	var urlString="http://www.ezip.jrsandbox.com/get_estimate"
	var jhxr=$.ajax({
		type:"GET",
		url:urlString,
		data:data,
		success:function(result){
			result=JSON.parse(result);
			if(result["error"]!=undefined){
				$('#energy_error_message').html(result["error"]);
				$('#energy_error').show();
				//$('#loader_single').hide();
			}
			else{
				fill_report_card(result);
				$.scrollTo("#energy_results_container",500);
			}
		},
		error:function(xhr, ajaxOptions, thrownError){
			$('#energy_error_message').html(thrownError);
			$('#energy_error').show();
			//$('#loader_single').hide();
		}
	});
	
}

function fill_report_card(udata)
{
	var zc = '#NY' + udata["zipcode"];
	
	var zipdata=d3.select(zc).datum();
	var neighavg=zipdata["kwh_house"];
	var neighavgcapita = zipdata["kwh_pop"];
	var seasmod= udata["metric"];
	var seasmodgrade = "Average";
	var seasmodtext = "";
	var seasfrac;	
	if (seasmod < 1.0)
	{
		seasmodgrade = "Better Than Average";
		seasfrac = 1.0-seasmod;
		seasmodtext = "less";
	}
	else if (seasmod > 1.0)
	{
		seasmodgrade = "Worse Than Average";
		seasfrac = seasmod - 1.0;
		seasmodtext = "more";
	}

	if (seasmod > 0.9 && seasmod < 1.1)
	{
		seasmodgrade = "Average";
	}

	var frac = udata["annual_usage"] / neighavg;
	var fracsign = "";
	var savingstext='';

	var savings = 0.27*(udata["annual_usage"] - neighavg);
	
	if (frac > 1.0)
	{
		frac = frac - 1.0;
		fracsign = "more";
		fracGrade= "Worse Than Average";
		savingstext='could ';
	}
	else
	{
		frac = 1.0 - frac;
		fracsign = "less";
		fracGrade= "Better Than Average";
		savings = savings * -1.0;
	}

	var text="<h3>Electricity Report Card</h3>";
	text+="<br/><h4>Total Electricity Use: <span class='"+fracsign+"'>" + fracGrade + "</span></h4><p>Your household uses <span class='"+fracsign+"'>"+Math.round(frac*100.0)+"% "+fracsign+"</span> electricity that the neighborhood average.</p>";
	text += '<p>You <span class="'+fracsign+'">' + savingstext + 'save $' + Math.round(savings) + '</span> per year!</p><br/>'; 
	text += '<p>Yearly household usage: ' + Math.round(udata["annual_usage"]) + ' kWh vs. Neighborhood average: ' + Math.round(neighavg) + ' kWh';
	text += '<p>Yearly usage per person: ' + Math.round(udata["annual_usage"] / udata["num_in_house"]) + ' kWh vs. Neighborhood average: ' + Math.round(neighavgcapita) + ' kWh</p><br/>';
	text += '<h3>Seasonal Modulation: <span class="'+seasmodtext+'">' + seasmodgrade + '</span></h3> <p>You use <span class="'+seasmodtext+'">' + Math.round(seasfrac*100) + '% ' + seasmodtext + '</span> electricity in the summer, relative to the winter,  compared to the U.S. average.</p><br/>';
	text += '<p>Not happy with your energy usage or seasonal variation? Check out these programs to help you increase your energy efficiency';
	text += '<ul>';
	text += '<li><a href="http://www.nyc.gov/html/coolroofs/html/about/about.shtml">NYC Cool Roofs</a></li>';
	text += '<li><a href="http://www.coned.com/energyefficiency/residential.asp"> ConEd Programs for Residential Efficiency</a></li>';
	text += '<li><a href="http://www.conedsolutions.com/GoGreen/Residential/NewYork_Green_Residential/CONEDISON_Green_Residential.aspx"> ConEd Green Power</a></li>';
	text += '<li><a href="http://www.nyserda.ny.gov/BusinessAreas/Energy-Efficiency-and-Renewable-Programs/Residential/Programs/Renewables.aspx"> NYSERDA Efficiency and Green Power Incentives</a></li>';
	text += '<li><a href="http://www.nyserda.ny.gov/Energy-Efficiency-and-Renewable-Programs/Residential/Programs/Low-Income-Assistance.aspx"> NYSERDA Efficient Appliances Assistance</a></li>';
	text += '</ul>';
	$("#report_card").html(text);



	//Setup arrays for plotting the line chart...
	var elecUser = new Array();
	var elecUS = new Array();
	var elecPred = new Array();	
	var elecPredUncert = new Array();

//	alert(udata["zipcode_usage"]);

	for (key in udata["us_monthly"])
	{
		elecUS[key] = udata["us_monthly"][key]*neighavg/12.0;
	}

	var sss=0.0;
	var count=0.0;
	for (key in udata["ratio"])
	{
		sss+=udata["ratio"][key]*udata["us_monthly"][key];
		count++;
	}
	for (key in udata["ratio"])
	{
		elecUser[key] = udata["ratio"][key]*udata["us_monthly"][key]*udata["annual_usage"]/sss*(count/12.0);// *udata["annual_usage"];//
	}

	for (key in udata["predicted_usage"])//["predicted_usage"])
	{
		elecPred[key] = udata["predicted_usage"][key];//*udata["annual_usage"]/12.0;
	}
	for (key in udata["predicted_uncertainty"])//udata["predicted_uncertainty"])
	{
		elecPredUncert[key] = udata["predicted_uncertainty"][key];//*udata["annual_usage"]/12.0*0.1;
	}


	DrawLineChart(elecUser,elecUS,elecPred,elecPredUncert,udata["average_ratio"]);
}


var _dateKeys=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function buildDateOrderedMonthKey(){
	var d = new Date();
	var n = d.getMonth(); // current month, 0 is January
	var loc_keys=[];
	for(var i=0; i<12; i++){
		var id=(n+i<=11)?n+i:n-12+i;
		var key=_dateKeys[id];
		loc_keys.push(key);
	}
	return loc_keys;
}

function constructDateInput(){
	var d = new Date();
	var y = d.getFullYear()-2000; // 2 digit full year

	var loc_keys=buildDateOrderedMonthKey();
	var input = $('#date_input');

	fields="";
	var inLastYear=true;
	for(var i in loc_keys)
	{
		var key=loc_keys[i];
		if(key=="Jan"){inLastYear=false;}
			
		var yearString=(inLastYear)?" '"+(y-1):" '"+y;
		
		input.append($("<input>").attr('class',"date-input").attr('name',key).attr("placeholder",key+yearString));
		if(i%4==3){input.append("<br/>");}
	}
}















function monthlyUseLine()
{
	this.month="";
	this.use=0.0;
	this.use_uncert=0.0;
}

function DrawLineChart(elecUser, elecUS, elecPred, elecPredUncert, average_ratio)
{


  var w = 800;
  var h = 400;
  var margin = 80;


  var mydiv = document.getElementById("monthlyPlot");
  mydiv.innerHTML="";



//Setup data arrays
//elecUser: Monthly usage for the user : MUST BE PASSED TO THIS FUNCTION
//elecUS: Monthly average use for USA : MUST BE PASSED TO THIN FUNCTION
//elecNorm: Monthly average use for USA normalized to yearly usage of user : CALCULATED WITHIN THE FUNCTION


  var elecUSNorm = new Array;
  //var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var months = buildDateOrderedMonthKey();

  var monthsIndex={};

  for (var i=0; i<months.length; i++)
  {
    monthsIndex[months[i]]=i;
  }

  

  var elecUserOrdered = new Array();
  var ind=0;
  for (key in monthsIndex)
  {
    if (elecUser[key])
    {
      elecUserOrdered[ind] = new monthlyUseLine();
      elecUserOrdered[ind].month = key;
      elecUserOrdered[ind].use = elecUser[key];
      ind++;
    }
  }

  var elecUSOrdered = new Array();
  ind=0;
  for (key in monthsIndex)
  {
    if (elecUS[key])
    {
      elecUSOrdered[monthsIndex[key]] = new monthlyUseLine();
      elecUSOrdered[monthsIndex[key]].month = key;
      elecUSOrdered[monthsIndex[key]].use = elecUS[key];
      ind++;
    }
  }


  var elecPredOrdered = new Array();
  ind=0;
  for (key in monthsIndex)
  {
    if (elecPred[key])
    {
      elecPredOrdered[ind] = new monthlyUseLine();
      elecPredOrdered[ind].month = key;
      elecPredOrdered[ind].use = elecPred[key];
      elecPredOrdered[ind].use_uncert = elecPredUncert[key];
      ind++;
    }
  }


  for (i=0; i<elecUSOrdered.length; i++)
  {
    elecUSNorm[i] = new monthlyUseLine();
    elecUSNorm[i].month = elecUSOrdered[i].month;
    elecUSNorm[i].use = elecUSOrdered[i].use*average_ratio;
  }
  

//Done calculating the data for lines...


  




//Setup scales
//Calculate max Y value

  var maxY = -1000.0;
  for (var i = 0; i<elecUserOrdered.length; i++)
  {
    if (elecUserOrdered[i].use > maxY)
    {
      maxY = elecUserOrdered[i].use;
    }
  }

  for (var i = 0; i<elecUSOrdered.length; i++)
  {
    if (elecUSOrdered[i].use > maxY)
    {
      maxY = elecUSOrdered[i].use;
    }
  }

  for (var i = 0; i<elecPredOrdered.length; i++)
  {
    if (elecPredOrdered[i].use+elecPredOrdered[i].use_uncert > maxY)
    {
      maxY = elecPredOrdered[i].use+elecPredOrdered[i].use_uncert;
    }
  }

  for (var i = 0; i<elecUSNorm.length; i++)
  {
    if (elecUSNorm[i].use > maxY)
    {
      maxY = elecUSNorm[i].use;
    }
  }


  //var maxY = d3.max( [ d3.max(elecUS), d3.max(elecUser), d3.max(elecUSNorm) ] );

  var y = d3.scale.linear().domain([0,maxY]).range([ 0 + margin, h - margin]);
  var x = d3.scale.linear().domain([0,13]).range([ 0 + margin, w - margin]);



//Setup basix D3 containers...

  var plt = d3.select("#monthlyPlot")
              .append("svg:svg")
              .attr("width",w)
              .attr("height",h);

  var g = plt.append("svg:g")
             .attr("transform","translate(0,"+h+")");


//Setup Axes

  g.append("svg:line")
      .attr("class","monthlyPlotAxis")
      .attr("x1", x(0))
      .attr("y1", -1 * y(0))
      .attr("x2", x(13))
      .attr("y2", -1 * y(0))

  g.append("svg:line")
      .attr("class","monthlyPlotAxis")
      .attr("x1", x(0))
      .attr("y1", -1 * y(0))
      .attr("x2", x(0))
      .attr("y2", -1 * y(maxY) )



  g.selectAll(".yLabel")
      .data(y.ticks(4))
      .enter().append("svg:text")
      .text(String)
      .attr("class","monthlyPlot")
      .attr("x", x(0)-40)
      .attr("y", function(d) { return -1 * y(d) })
      .attr("text-anchor", "right")
      .attr("dy", 4)



  g.selectAll(".xTicks")
      .data(x.ticks(10))
      .enter().append("svg:line")
      .attr("class","monthlyPlotTicks")
      .attr("x1", function(d) { return x(d); })
      .attr("y1", -1 * y(1)+10)
      .attr("x2", function(d) { return x(d); })
      .attr("y2", -1 * y(-0.3))

  g.selectAll(".yTicks")
      .data(y.ticks(4))
      .enter().append("svg:line")
      .attr("class","monthlyPlotTicks")
      .attr("y1", function(d) { return -1 * y(d); })
      .attr("x1", x(-0.2))
      .attr("y2", function(d) { return -1 * y(d); })
      .attr("x2", x(0))



  g.selectAll(".yGrid")
      .data(y.ticks(4))
      .enter().append("svg:line")
      .attr("class", "monthlyPlotGrid")
      .attr("x1", function(d) { return x(0); })
      .attr("y1", function(d) { return -1 * y(d); } )
      .attr("x2", function(d) { return x(13); })
      .attr("y2", function(d) { return -1 * y(d); } );



//Draw monthly labels
  var monthText = new Array();
  for (var i=0; i<12; i++)
  {
    monthText[i] = g.append("svg:text")
                    .attr("class","monthlyPlot")
                    .attr("x",x(i+1)-10)
                    .attr("y",-1*y(0)+25)
                    .text(months[i]);
  }


//Draw Y Axis label
  var yLabelText = g.append("svg:text")
                   .attr("transform","rotate(270 "+(x(0)-margin+20)+", "+(-1*y( maxY )/2+50)+")")
                   .attr("class","monthlyPlot")
                   .attr("x",x(0)-margin+20)
                   .attr("y",-1*y( maxY )/2+50)
                   .attr("border","1px")
                   .text("Electricity Consumption (kWh)");



//Draw plot title
  var plotTitle = g.append("svg:text")
                   .attr("class","monthlyPlotTitle")
                   .attr("x",w/2-200)
                   .attr("y",-1*y(maxY)-margin/2)
                   .text("Monthly Electricity Usage");


//This is the tool tip that will pop-up when the user mouse-overs the lines
//Tells user what each line is.
var tooltip = d3.select("body")
    .append("div")
    .style("position", "absolute")
    .style("z-index", "10")
    .style("visibility", "hidden")
    .style("fill","white")
    .style("background","white")
    .style("border","1px solid")
    .style("border-color","steelblue")
    .style("box-shadow","5px 5px 5px #888888")
    .text("a simple tooltip");







//OKAY 1000 LINES LATER WE PLOT DATA!
//In the future: install gnuplot on server. call gnuplot from some python script to generate a beautiful plot in 10 lines of code. serve up image.

  var lineElec = d3.svg.line()
                       .x(function(d,i) { return x(monthsIndex[d.month]+1); } )
                       .y(function(d,i) { return -1 * y(d.use); } );


  var areaElec = d3.svg.area()
                       .x(function(d,i) { return x(monthsIndex[d.month]+1); } )
                       .y1(function(d,i) { return -1 * y(d.use-d.use_uncert); } )
                       .y0(function(d,i) { return -1 * y(d.use+d.use_uncert); } );
                       

  g.append("svg:path").attr("d",areaElec(elecPredOrdered))
                      .style("stroke","grey")
                      .style("fill","grey")
                      .style("stroke-width","5")
                      .style("opacity","0.5")
                      .on("mousemove", function(){return tooltip.style("top", (event.pageY-10)+"px").style("left",(event.pageX+10)+"px");})
                      .on("mouseout", function(){return tooltip.style("visibility", "hidden");})
                      .on("mouseover", function(){return tooltip.text("Your Estimated Seasonal Variation").style("visibility", "visible");});

  g.append("svg:path").attr("d",lineElec(elecUSOrdered))
                      .style("stroke","tomato")
                      .style("fill","none")
                      .style("stroke-width","5")
                      .on("mousemove", function(){return tooltip.style("top", (event.pageY-10)+"px").style("left",(event.pageX+10)+"px");})
                      .on("mouseout", function(){return tooltip.style("visibility", "hidden");})
                      .on("mouseover", function(){return tooltip.text("Your neighborhoods Electricity Usage").style("visibility", "visible");});

/*
  g.append("svg:path").attr("d",lineElec(elecUSNorm))
                      .style("stroke-width","5")
                      .style("stroke","tomato")
                      .style("fill","none")
                      .style("stroke-dasharray","10,10")
                      .on("mousemove", function(){return tooltip.style("top", (event.pageY-10)+"px").style("left",(event.pageX+10)+"px");})
                      .on("mouseout", function(){return tooltip.style("visibility", "hidden");})
                      .on("mouseover", function(){return tooltip.text("Normalized U.S. Average Electricity Usage").style("visibility", "visible");});
*/

  g.append("svg:path").attr("d",lineElec(elecUserOrdered))
                      .style("stroke","steelblue")
                      .style("fill","none")
                      .style("stroke-width","5")
                      .on("mousemove", function(){return tooltip.style("top", (event.pageY-10)+"px").style("left",(event.pageX+10)+"px");})
                      .on("mouseout", function(){return tooltip.style("visibility", "hidden");})
                      .on("mouseover", function(){return tooltip.text("Your Electricity Usage").style("visibility", "visible");});

  g.selectAll("circles").data(elecUserOrdered)
                        .enter()
                        .append("circle")
                        .attr("cx",function (d,i) { return x(monthsIndex[d.month]+1); } )
                        .attr("cy",function (d,i) { return -1 * y(d.use); } )
                        .attr("r", "5")
                        .style("stroke","steelblue")
                        .style("fill","steelblue")
                        .style("stroke-width","5")
                        .on("mousemove", function(){return tooltip.style("top", (event.pageY-10)+"px").style("left",(event.pageX+10)+"px");})
                        .on("mouseout", function(){return tooltip.style("visibility", "hidden");})
                        .on("mouseover", function(){return tooltip.text("Your Electricity Usage").style("visibility", "visible");});



}


