function exploreCity(){
	console.log("called");
	$(".choice_input").css("display","none");
}

function go_to_zip(){
	$("#step1").css("display","none");
	$("#step2").css("display","inline");
}

function zip_chosen(input){
	var zip_in=""+$("#zip_input").val();
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
	var data=d3.select("#NY"+zip_in).datum();
	click(data);
}