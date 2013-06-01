/*function exploreCity(){
	$(".choice_input").css("display","none");
}

function go_to_zip(){
	$("#step1").css("display","none");
	$("#step2").css("display","inline");
}



function reset_choice_boxes(){
	$("#step1").css("display","inline");
	$("#step2").css("display","none");
	$(".choice_input").css("display","none");
	$("#zip_entry_string").text("Enter your Zip Code");
	
}*/

function zip_chosen(input){
	var zip_in="NY"+$("#zip_input").val();
	if(zip_in in elec_pop){
		zoom_to_zip(zip_in);
	}
	else{
		$("#zip_input")[0].placeholder="Please enter a valid ZIP";
		return false;
	}
}

function zoom_to_zip(zip_in){
	//reset_choice_boxes();
	var data=d3.select("#"+zip_in).datum();
	click(data);
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
				text="";
				for(var key in result){
					//text+="<p>"+key+":\t"+JSON.stringify(result[key])+"</p>";
				}
				$("#energy_results").html(text);
				fill_report_card(result);
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
	var carddiv = document.getElementById('energy_report_card'); 
	var zc = '#NY' + udata["zipcode"];
	
	var zipdata=d3.select(zc).datum();
	var neighavg=zipdata["kwh_by_house"];
	var neighavgcapita = zipdata["kwh_by_pop"];
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
		savingstext='could '
	}
	else
	{
		frac = 1.0 - frac;
		fracsign = "less";
		savings = savings * -1.0;
	}

	
	carddiv.innerHTML = '<a name="report_card"><h3>Energy Report Card</h3></a><p>Yearly household usage: ' + Math.round(udata["annual_usage"]) + ' kWh (Neighborhood average: ' + Math.round(neighavg) + ' kWh)';
	carddiv.innerHTML  += '<p>Yearly usage per person: ' + Math.round(udata["annual_usage"] / udata["num_in_house"]) + ' kWh (Neighborhood average: ' + Math.round(neighavgcapita) + ' kWh)</p>';
	carddiv.innerHTML += '<p>Your household uses ' + Math.round(frac*100.0) + '% ' + fracsign + ' electricity than the average in your neighborhood. You ' + savingstext + 'save $' + Math.round(savings) + ' per year!</p>'; 
	carddiv.innerHTML += '<p>Seasonal modulation: ' + seasmodgrade + '. You use ' + Math.round(seasfrac*100) + '% ' + seasmodtext + ' electricity in the summer, relative to the winter,  compared to the U.S. average.</p>';
	carddiv.innerHTML += '<p>Your seasonal modulation is computed by comparing your electricity usage in the summer to other seasons. If it is bad, then your home cooling is done inefficiently.</p>'
}

