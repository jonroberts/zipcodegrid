
function switch_map(arg){
	map.current=arg;
	g.selectAll("path").transition().duration(1000)
	  .style("fill",function(d){return getColor(d);})	
	$("#map_selector").blur();
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


function switchMeasure(button,key){
	g.selectAll("path").transition().duration(1000)
	  .style("fill",function(d){return getColor(d,key)})	
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
		seasmodgrade = "Good";
		seasfrac = 1.0-seasmod;
		seasmodtext = "less";
	}
	else if (seasmod > 1.0)
	{
		seasmodgrade = "Bad";
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
		fracGrade= "Bad";
		savingstext='could ';
	}
	else
	{
		frac = 1.0 - frac;
		fracsign = "less";
		fracGrade= "Good";
		savings = savings * -1.0;
	}

	$("#energy_results > h2.title").text("Energy Report Card");
	var text="<br/><h3>Total Energy Use: <span class='"+fracsign+"'>" + fracGrade + "</span></h3><p>Your household uses <span class='"+fracsign+"'>"+Math.round(frac*100.0)+"% "+fracsign+"</span> electricity that the neighborhood average.</p>";
	text += '<p>You <span class="'+fracsign+'">' + savingstext + 'save $' + Math.round(savings) + '</span> per year!</p><br/>'; 
	text += '<p>Yearly household usage: ' + Math.round(udata["annual_usage"]) + ' kWh vs. Neighborhood average: ' + Math.round(neighavg) + ' kWh';
	text += '<p>Yearly usage per person: ' + Math.round(udata["annual_usage"] / udata["num_in_house"]) + ' kWh vs. Neighborhood average: ' + Math.round(neighavgcapita) + ' kWh</p><br/>';
	text += '<h3>Seasonal Modulation: <span class="'+seasmodtext+'">' + seasmodgrade + '</span></h3> <p>You use <span class="'+seasmodtext+'">' + Math.round(seasfrac*100) + '% ' + seasmodtext + '</span> electricity in the summer, relative to the winter,  compared to the U.S. average.</p><br/>';

	$("#energy_results").append(text);
}

