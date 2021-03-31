#!/bin/bash
#Sets NODE on VS Stack to use NODE version 12
export PATH=$PATH:$(dirname $NODE_12)

#Installs and runs npm test
npm install
npm run test
