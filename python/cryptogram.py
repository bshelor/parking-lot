stringChart = 'abcdefghijklmnopqrstuvwxyz'
skipChars = ' ;-.'
encrypted = 'sreu tj reunpdy ua bad kal\'u ka ua elaurnf. urtj tj urn srayn uafer; urn fnju tj hazznluefb - rtyyny'

maxIndex = 25

def displayMap(iteration):
  map = {}
  for charIdx in range(len(stringChart)):
    if (charIdx+iteration) > maxIndex:
      ## Ex: pos = 24, i = 5; pos should now equal 3, or char 'd'
      pos = (charIdx+iteration) - maxIndex - 1
    else:
      pos = charIdx+iteration
    map[stringChart[charIdx]] = stringChart[pos]
  print('Mapping -- ', map)


for i in range(1, len(stringChart)+1):
  # print('Adding '+str(i)+' to each char')
  # displayMap(i)
  unencrypted = ''
  for char in encrypted:
    # print(char)
    pos = stringChart.find(char)

    ## didn't find it in stringChar
    if (pos == -1):
      newChar = char
    else:
      if (pos+i) > maxIndex:
        ## Ex: pos = 24, i = 5; pos should now equal 3, or char 'd'
        pos = (pos+i) - maxIndex - 1
      else:
        pos = pos+i
      newChar = stringChart[pos]

    unencrypted += str(newChar)
  print('Decrypt Attempt #'+str(i)+': '+unencrypted)