# FROM https://mashimo.wordpress.com/2012/06/08/1298/

def filterOutliers(dataPoints,q3,q1):
    # first quartile – 1.5·IQR = 3.5 – 10.5 = –7
    # third quartile + 1.5·IQR = 10.5 + 10.5 = 21
    IQR = 1.5*(q3-q1)
    lower = q1 - IQR
    upper = q3 + IQR
    filtered = []

    for d in dataPoints:
        if d < upper and d > lower:
            filtered.append(d)

    return (min(filtered),max(filtered))

def median(dataPoints):
    """
    dataPoints: a list of data points, int or float
    returns: the middle number in the sorted list, a float or an int
    """
    sortedPoints = sorted(dataPoints)
    mid = int(len(sortedPoints) / 2)
    if (len(sortedPoints) % 2 == 0):
        # even: need to get the average of the two mid numbers
        return (sortedPoints[mid-1] + sortedPoints[mid]) / 2.0
    else:
        # odd: there is only one number
        return sortedPoints[mid]

# https://mashimo.wordpress.com/2013/07/06/quartiles-and-summary-statistics-in-python/
def quartiles(dataPoints):
    if len(dataPoints) == 0: pass
    # 1. order the data set
    sortedPoints = sorted(dataPoints)
    # 2. divide the data set in two halves
    mid = int(len(sortedPoints) / 2)
    if (len(sortedPoints) % 2 == 0):
        # even
        lowerQ = median(sortedPoints[:mid])
        upperQ = median(sortedPoints[mid:])
    else:
        # odd
        lowerQ = median(sortedPoints[:mid])  # same as even
        upperQ = median(sortedPoints[mid+1:])

    # dmin = min(dataPoints)
    # dmax = max(dataPoints)
    dmin, dmax = filterOutliers(dataPoints, upperQ, lowerQ)
    return (dmin,dmax, dmax,dmin, lowerQ,median(dataPoints),upperQ, )