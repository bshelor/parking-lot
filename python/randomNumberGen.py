import math
import random

numbers = []
finalList = []

for i in range(32):
  num = i + 1
  numbers.append(num)

print(numbers)

for i in range(32):
  idx = random.randrange(0, len(numbers))
  print(idx)
  finalList.append(numbers.pop(idx))
  print(finalList)
  print(numbers)

print(finalList)