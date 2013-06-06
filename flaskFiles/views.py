from flask import render_template, flash, redirect, session, make_response
from theApp import app, db
from forms import LoginForm

import json
from tools import valueFromRequest
from numpy import *
import os
import calendar
from flask import request
import datetime

from models import User, Bill

import random

@app.route('/')
@app.route('/index')
def index():
	return render_template("index_flask.html")

@app.route('/get_estimate')
def get_estimate():
	today = datetime.date.today()

	this_month=today.month
	this_year=today.year
	day=1
	
	ip_address=request.remote_addr
	zipcode = int(valueFromRequest(key="zip_in", request=request))
	num_in_house = int(valueFromRequest(key="num_in_house", request=request))

	months=the_months()
	monthly_data={}

	for month in months:
		try:
			d=float(valueFromRequest(key=month, request=request))
			monthly_data[month]=d
		except:
			continue

	# store the data
	user = User.query.filter_by(ip = ip_address).first()
	# add the user if they don't exist
	print str(user)+" "+str(ip_address)+" "+str(zipcode)+" "+str(num_in_house)
	if user is None:
		
		user = User(name = "", email = "", ip = ip_address, zip=zipcode, state="NY", num_in_house=num_in_house)
		db.session.add(user)
		db.session.commit()
		return "added a user!"

	# run through the last 12 months. If there's a data entry, then check for a bill object. If one doesn't exist, add it.
	for i in range(1,13):
		t_year=this_year
		t_month=this_month-i
		if t_month<=0:
			t_month+=12
			t_year-=1
		
		month_str=months[t_month-1]
		if month_str not in monthly_data.keys():
			continue
			
		date=datetime.date(day=day, month=t_month, year=t_year)
		bill = Bill.query.filter_by(month = date).filter_by(user_id = user.id).first()

		if bill is None:
			bill=Bill(month=date,user_id=user.id,kwh=monthly_data[month_str])
			db.session.add(bill)
		else:
			bill.kwh=monthly_data[month_str]
		db.session.commit()

	ratio, average_ratio, normalized_ratio, metric, annual_usage = analyze_user(monthly_data, usage_by_unit, US_norm)
	pred_use, pred_uncert = predict_all_months(monthly_data, US_norm)
	response=make_response(json.dumps({"num_in_house":num_in_house, "zipcode":zipcode, "us_monthly":US_norm, "ratio":ratio, "average_ratio":average_ratio, "normalized_ratio":normalized_ratio, "metric":metric, "annual_usage":annual_usage, "predicted_usage":pred_use, "predicted_uncertainty":pred_uncert }))
	response.headers.add("Access-Control-Allow-Origin","*")
	return response






#=======================================================================
# Ronnie's code after this point
#=======================================================================

# predict a given month's electricity bill/usage
def predict_usage(user, norm, month):
    """
    Input: 'user' is a dict of months (keys) and usage in kWh, 'norm' is the chosen monthly normalization, 'month' is the month for the prediction.
    Output: prediction of the kWh usage for the input month.
    """
    user_mean = mean(user.values())
    predicted_relative_increase = (norm[month]/mean([norm[m] for m in user]))
    return user_mean*predicted_relative_increase

def the_months():
	return [month[:3] for month in calendar.month_name[1:13]]

def load_zip_data(electricity_by_zip):
	"""
	Create dicts with integer zip codes as keys for monthly usage in kWh, population and housing units.
	"""
	zip_data = loadtxt(electricity_by_zip, dtype='int')
	usage = {}; pop = {}; hunits = {}
	for z in zip_data:
		usage.update({z[0]:float(z[1])/12}) 
		pop.update({z[0]:z[3]})
		hunits.update({z[0]:z[4]})
	return usage, pop, hunits

# get city monthly averages
def get_nyc_average_usage(usage, pop, hunits):
	"""
	Get the NYC average monthly kWh usage by housing unit and by person.
	"""
	return sum(usage.values())/sum(hunits.values()), sum(usage.values())/sum(pop.values())

def load_2012_US_normalized_usage(residential_us):
	"""
	Get monthly 2012 data for US residential electricity usage, normalized to unity.
	"""
	months = the_months()
	us  = loadtxt(residential_us)
	usm_2012 = [x[1] for x in us if 201201<=x[0]<=201212] # monthly data, 2012
	usm_2012_norm = usm_2012/mean(usm_2012)
	US_2012 = {}
	for month, value in zip(months, usm_2012_norm): 
		US_2012.update({ month:value })
	return US_2012

def analyze_user(user, usage_by_unit, norm):
    """
    Input: dict of month (key) and usage in kWh (value). NYC usage and monthly normalization.
    Output: ratio of user's power usage and the city average, as well as a normalized ratio.
    If the latter is larger than unity for the summer months, it implies greater seasonal variation
    than what is implied in the input 'norm' data.

    """
    ratio = {} # ratio of user's household usage to the NYC average for each entered month
    for month in user:
        ratio.update({month: user[month]/(usage_by_unit*norm[month]) })
    average_ratio = mean(ratio.values())
    normalized_ratio = ratio.copy()
    for key in normalized_ratio:
        normalized_ratio[key] *= (1/average_ratio)

    # crude estimate of insulation
    summer = ['Jun', 'Jul', 'Aug']
    metric_list = []
    for month in user:
        if month in summer:
            metric_list.append(normalized_ratio[month])
    if len(metric_list)>0:
        metric = mean(metric_list)
    else:
        metric = None

    # predict annual usage
    months = the_months()
    annual_usage = sum(user.values()) # sum known months' usage
    annual_usage += sum([predict_usage(user, norm, m) for m in months if m not in user]) # add predicted values
    return ratio, average_ratio, normalized_ratio, metric, annual_usage	


def predict_all_months(user, norm):
    """
    Input: 'user' is a dict of months (keys) and usage in kWh, 'norm' is the chosen monthly normalization.
    Output: prediction of the kWh usage for all (12) months, with an uncertainty (note: the relative uncertainty is the same for all months).
            Both outputs are arrays.
    """
    user_mean = mean(user.values())
    usage_prediction  = []
    for month in the_months():
        usage_prediction.append(user_mean*(norm[month]/mean([norm[m] for m in user])))
    usage_prediction = array(usage_prediction)

    # estimate uncertainty
    trash, trash, n_ratio, trash, trash = analyze_user(user, 1., norm) # overall normalization doesn't matter if normalized_ratio is only needed
    sigma_min = 0.1 # min sigma, to avoid some rare, crazy results
    usage_uncertainty = usage_prediction*max(sigma_min, std(1-array(n_ratio.values())))
    print std(1-array(n_ratio.values()))
    return usage_prediction, usage_uncertainty




# input data
electricity_by_zip = '/home/jr_hack/ezip.jrsandbox.com/theApp/static/data/ZipCodeElecPop.tsv'
residential_us     = '/home/jr_hack/ezip.jrsandbox.com/theApp/static/data/electricity_retail_sales_to_residential_sector_MkWh.tsv'

# load usage by zip code
usage, pop, hunits = load_zip_data(electricity_by_zip)

# get average values for NYC
usage_by_unit, usage_by_pop = get_nyc_average_usage(usage, pop, hunits)

# get month-by-month US national residential electricity usage, normalized to unity
US_norm = load_2012_US_normalized_usage(residential_us)

