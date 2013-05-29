#!/bin/python

import sys
import os
import json

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
data=readZipCodeNeighbourhoodMap()
print json.dumps(data)
sys.exit()

def convertEnergyTSV():
	file=open("./static/data/ZipCodeElecPop.tsv")
	data={}
	for line in file:
		if '#' in line:
			continue
		entry={}
		
		vals=line.split()
		key=vals[0]
		entry["E_kwh"]=vals[1]
		entry["E_GJ"]=vals[2]
		entry["pop"]=vals[3]
		entry["num_house"]=vals[4]
		data[key]=entry
	return data

data=convertEnergyTSV()
print json.dumps(data)