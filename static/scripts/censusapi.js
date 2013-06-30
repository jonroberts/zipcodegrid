function call_census_api()
{
	var censusCallUrl = 'http://api.census.gov/data/2011/acs5?key=1032203b9aed8a61f58dde67f507b465e6008a8a&get=B19013_001E,B25077_001E&for=zip+code+tabulation+area:10001,10002,10003,10004,10005,10006,10007,10009,10010,10011,10012,10013,10014,10016,10017,10018,10019,10021,10022,10023,10024,10025,10026,10027,10028,10029,10030,10031,10032,10033,10034,10035,10036,10037,10038,10039,10040,10044,10065,10069,10075,10128,10280,10282,10301,10302,10303,10304,10305,10306,10307,10308,10309,10310,10312,10314,10451,10452,10453,10454,10455,10456,10457,10458,10459,10460,10461,10462,10463,10464,10465,10466,10467,10468,10469,10470,10471,10472,10473,10474,10475,11001,11004,11040,11101,11102,11103,11104,11105,11106,11109,11201,11202,11203,11204,11205,11206,11207,11208,11209,11210,11211,11212,11213,11214,11215,11216,11217,11218,11219,11220,11221,11222,11223,11224,11225,11226,11228,11229,11230,11231,11232,11233,11234,11235,11236,11237,11238,11239,11354,11355,11356,11357,11358,11360,11361,11362,11363,11364,11365,11366,11367,11368,11369,11370,11372,11373,11374,11375,11377,11378,11379,11385,11411,11412,11413,11414,11415,11416,11417,11418,11419,11420,11421,11422,11423,11426,11427,11428,11429,11432,11433,11434,11435,11436,11693';
	

	var censusJx=$.ajax({
		type:"GET",
		url:censusCallUrl,
		success:function(result){
			if(result["error"]!=undefined){
				$('#energy_error_message').html(result["error"]);
				$('#energy_error').show();
			}
			else{
				result.splice(0,1);
				fill_census_values(result);
			}
		},
		error:function(xhr, ajaxOptions, thrownError){
			$('#energy_error_message').html(thrownError);
			$('#energy_error').show();
		}
	});
}


function fill_census_values(censusApiResult)
{
	for (var fcvI=0; fcvI<censusApiResult.length; fcvI++)
	{
		var fcvZip = 'NY' + censusApiResult[fcvI][2];
		if (fcvZip in elec_pop)
		{
			var medIncome = parseFloat(censusApiResult[fcvI][0]);
			var medHomeValue = parseFloat(censusApiResult[fcvI][1]);
			elec_pop[fcvZip]["median_income"]=medIncome;
			elec_pop[fcvZip]["avg_home_value"]=medHomeValue;
		}
	}
}
