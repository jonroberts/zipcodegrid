#!/Library/Frameworks/EPD64.framework/Versions/7.1/bin/python

import sys

import matplotlib
import pylab
import numpy
from numpy import *
import scipy
from scipy import optimize
import matplotlib.pyplot as plt
from matplotlib import cm
import pickle
from pylab import *
import math
import os

sys.path.append("/Users/Jon/Code/DeflectedCRs/")
from utils import *

# plots a sky map from a pickle file
filename="./proton/deflectedMap_log10E1.60_proton_R1.60.pkl"
f=open(filename)
map=pickle.load(f)
print len(map)
print getNPIX(res=9)
f.close()