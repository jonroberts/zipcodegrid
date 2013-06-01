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
	file=open("./data/ZipCodeData.tsv")
	data={}
	kwh_by_pop=[]
	kwh_by_house=[]
	kwh_by_household_income=[]
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
				
		
		data[key]=entry
	print counter
	kwh_by_pop=sort(array(kwh_by_pop))[::-1]
	kwh_by_house=sort(array(kwh_by_house))[::-1]
	kwh_by_household_income=sort(array(kwh_by_household_income))[::-1]
	
	for key in data.keys():
		if data[key]["kwh_by_pop"]==0:
			data[key]["rank_kwh_pop"]=0
			data[key]["rank_kwh_house"]=0
			data[key]["rank_kwh_household_income"]=0
		else:
			data[key]["rank_kwh_pop"]=int(where(kwh_by_pop==data[key]["kwh_by_pop"])[0][0]+1)
			data[key]["rank_kwh_house"]=int(where(kwh_by_house==data[key]["kwh_by_house"])[0][0]+1)
			data[key]["rank_kwh_household_income"]=int(where(kwh_by_household_income==data[key]["kwh_by_household_income"])[0][0]+1)
	
	return data

data=convertEnergyTSV()
print json.dumps(data)