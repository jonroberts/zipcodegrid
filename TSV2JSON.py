#!/bin/python

import sys
import os
import json
from numpy import *

# turns the zipcode data into a JSON dictionary
def readZipCodeNeighbourhoodMap():
	file=open("./static/data/zipcode_to_neighbourhood_map.txt")
	data={}
	currentBorough=""
	boroughs=["Brooklyn","Manhattan","Staten Island","Bronx","Queens"]
	for line in file:
		if line.strip() in boroughs:
			currentBorough=line.strip()
			continue
		else:
			vals=line.split(",")
			neighbourhood=vals[0].strip()
			for i in range(1,len(vals)):
				data[vals[i].strip()]={"borough":currentBorough,"neighborhood":neighbourhood}
	return data
#data=readZipCodeNeighbourhoodMap()
#print json.dumps(data)
#sys.exit()

def convertEnergyTSV():
	file=open("./data/ZipCodeData_3.2.tsv")
	kwh_price = 0.27 # dollars/kWh
	data={}
	kwh_by_pop=[]
	kwh_by_house=[]
	kwh_by_household_income=[]
	E_density=[]
	E_comm_density=[]
	E_inst_density=[]
	E_tot_density=[]
	taxcredit_per_house=[]
	E_pct_income=[]
	counter=0
	for line in file:
		if '#' in line:
			continue
		entry={}
		
		vals=line.split()
		key="NY"+vals[0]
		entry["E_kwh"]=float(vals[1])
		entry["E_GJ"]=float(vals[2])
		entry["pop"]=float(vals[3])
		entry["num_house"]=float(vals[4])
		entry["median_income"]=float(vals[5])
		entry["area"]=float(vals[6])
		entry["tax_credit"]=float(vals[7])
		entry["avg_home_value"]=float(vals[8])
		entry["E_comm_kwh"]=float(vals[9])
		entry["E_comm_GJ"]=float(vals[10])
		entry["E_inst_kwh"]=float(vals[11])
		entry["E_inst_GJ"]=float(vals[12])
		if float(vals[1])>0:

			if float(vals[3])==0:
				print vals
				entry["kwh_by_pop"]=0
				entry["kwh_by_house"]=0
				entry["kwh_by_household_income"]=0
			else:
				entry["kwh_by_pop"]=float(vals[1])/(1.*float(vals[3]))
				entry["kwh_by_house"]=float(vals[1])/(1.*float(vals[4]))
				entry["kwh_by_household_income"]=float(vals[1])/(1.*float(vals[4])*float(vals[5]))
				kwh_by_pop.append(entry["kwh_by_pop"])
				kwh_by_house.append(entry["kwh_by_house"])
				kwh_by_household_income.append(entry["kwh_by_household_income"])
				counter+=1
		else:
			entry["kwh_by_pop"]=0
			entry["kwh_by_house"]=0
			entry["kwh_by_household_income"]=0
				
		if float(vals[6])>0: # add energy densities
			entry["E_density"]      = float(vals[1])/float(vals[6])
			entry["E_comm_density"] = float(vals[9])/float(vals[6])
			entry["E_inst_density"] = float(vals[11])/float(vals[6])
			entry["E_tot_density"]  = (float(vals[1])+float(vals[9])+float(vals[11]))/float(vals[6])
		else:
			entry["E_density"]      = 0
			entry["E_comm_density"] = 0
			entry["E_inst_density"] = 0
			entry["E_tot_density"]  = 0

		try:
			entry["taxcredit_per_house"]  = float(vals[7])/float(vals[4])
		except ZeroDivisionError:
			entry["taxcredit_per_house"]  = 0

		try:
			entry["E_pct_income"]  = 100.*kwh_price*float(vals[1])/(float(vals[4])*float(vals[5]))
		except ZeroDivisionError:
			entry["E_pct_income"]  = 0



		data[key]=entry
	print counter
	kwh_by_pop=sort(array(kwh_by_pop))[::-1]
	kwh_by_house=sort(array(kwh_by_house))[::-1]
	kwh_by_household_income=sort(array(kwh_by_household_income))[::-1]
	
	E_density           = sort([data[zipcode]['E_density']           for zipcode in data if data[zipcode]['E_density']>0])[::-1]
	E_comm_density      = sort([data[zipcode]['E_comm_density']      for zipcode in data if data[zipcode]['E_comm_density']>0])[::-1]
	E_inst_density      = sort([data[zipcode]['E_inst_density']      for zipcode in data if data[zipcode]['E_inst_density']>0])[::-1]
	E_tot_density       = sort([data[zipcode]['E_tot_density']       for zipcode in data if data[zipcode]['E_tot_density']>0])[::-1]
	E_pct_income        = sort([data[zipcode]['E_pct_income']        for zipcode in data if data[zipcode]['E_pct_income']>0])[::-1]
	taxcredit_per_house = sort([data[zipcode]['taxcredit_per_house'] for zipcode in data if data[zipcode]['taxcredit_per_house']>0])[::-1]

	# add averages (ignore zeros)
	#averages = {}
	#averages.update({ 'E_density'      : mean([data[z]['E_density']      for z in data if data[z]['E_density']>0]) })
	#averages.update({ 'E_comm_density' : mean([data[z]['E_comm_density'] for z in data if data[z]['E_comm_density']>0]) })
	#averages.update({ 'E_inst_density' : mean([data[z]['E_inst_density'] for z in data if data[z]['E_inst_density']>0]) })
	#averages.update({ 'kwh_by_pop'     : mean([data[z]['kwh_by_pop']  for z in data if data[z]['kwh_by_pop']>0]) })
	#averages.update({ 'kwh_by_house'   : mean([data[z]['kwh_by_house']  for z in data if data[z]['kwh_by_house']>0]) })
	#averages.update({ 'kwh_by_household_income' : mean([data[z]['kwh_by_household_income']  for z in data if data[z]['kwh_by_household_income']>0]) })
	#averages.update({ 'E_pct_income'     : mean([data[z]['E_pct_income']  for z in data if data[z]['E_pct_income']>0]) })
	file_avgs=open("./data/ZipCodeAverages_3.3.tsv")
	for line in file_avgs:
		if '#' in line:
			continue
		vals=line.split()
		averages={}
		averages["E_kwh"]=float(vals[1])
		averages["E_GJ"]=float(vals[2])
		averages["pop"]=float(vals[3])
		averages["num_house"]=float(vals[4])
		averages["median_income"]=float(vals[5])
		averages["area"]=float(vals[6])
		averages["tax_credit"]=float(vals[7])
		averages["avg_home_value"]=float(vals[8])
		averages["E_comm_kwh"]=float(vals[9])
		averages["E_comm_GJ"]=float(vals[10])
		averages["E_inst_kwh"]=float(vals[11])
		averages["E_inst_GJ"]=float(vals[12])
		
	for key in data.keys():
		if data[key]["kwh_by_pop"]==0:
			data[key]["rank_kwh_pop"]=0
			data[key]["rank_kwh_house"]=0
			data[key]["rank_kwh_household_income"]=0
		else:
			data[key]["rank_kwh_pop"]=int(where(kwh_by_pop==data[key]["kwh_by_pop"])[0][0]+1)
			data[key]["rank_kwh_house"]=int(where(kwh_by_house==data[key]["kwh_by_house"])[0][0]+1)
			data[key]["rank_kwh_household_income"]=int(where(kwh_by_household_income==data[key]["kwh_by_household_income"])[0][0]+1)

		try:               data[key]["rank_E_density"]=int(where(E_density==data[key]["E_density"])[0][0]+1)
		except IndexError: data[key]["rank_E_density"]=0

		try:               data[key]["rank_E_comm_density"]=int(where(E_comm_density==data[key]["E_comm_density"])[0][0]+1)
		except IndexError: data[key]["rank_E_comm_density"]=0

		try:	           data[key]["rank_E_inst_density"]=int(where(E_inst_density==data[key]["E_inst_density"])[0][0]+1)
		except IndexError: data[key]["rank_E_inst_density"]=0

		try:	           data[key]["rank_E_tot_density"]=int(where(E_tot_density==data[key]["E_tot_density"])[0][0]+1)
		except IndexError: data[key]["rank_E_tot_density"]=0

		try:	           data[key]["rank_E_pct_income"]=int(where(E_pct_income==data[key]["E_pct_income"])[0][0]+1)
		except IndexError: data[key]["rank_E_pct_income"]=0

		try:	           data[key]["rank_taxcredit_per_house"]=int(where(taxcredit_per_house==data[key]["taxcredit_per_house"])[0][0]+1)
		except IndexError: data[key]["rank_taxcredit_per_house"]=0

		try:               data[key]["rank_E_density"] = int(where(E_density==data[key]["E_density"])[0][0]+1)
		except IndexError: data[key]["rank_E_density"] = 0

	return data, averages

data, averages = convertEnergyTSV()
print json.dumps(data)
print json.dumps(averages)
