function exploreCity(){
	$(".choice_input").css("display","none");
}

function go_to_zip(){
	$("#step1").css("display","none");
	$("#step2").css("display","inline");
}

function zip_chosen(input){
	var zip_in="NY"+$("#zip_input").val();
	if(zip_in in elec_pop){
		zoom_to_zip(zip_in);
	}
	else{
		$("#zip_entry_string").text("Please enter a valid zip");
	}
}

function reset_choice_boxes(){
	$("#step1").css("display","inline");
	$("#step2").css("display","none");
	$(".choice_input").css("display","none");
	$("#zip_entry_string").text("Enter your Zip Code");
	
}

function zoom_to_zip(zip_in){
	reset_choice_boxes();
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
					text+="<p>"+key+":\t"+JSON.stringify(result[key])+"</p>";
				}
				$("#energy_results").html(text);
			}
		},
		error:function(xhr, ajaxOptions, thrownError){
			$('#energy_error_message').html(thrownError);
			$('#energy_error').show();
			//$('#loader_single').hide();
		}
	});
	
}

