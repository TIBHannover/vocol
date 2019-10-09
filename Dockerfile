FROM openjdk:8u212-stretch

MAINTAINER  TIB/L3S Joint Lab , https://tib.edu

RUN apt-get update \
 && apt-get upgrade -y \
 && apt-get install -y  software-properties-common \
 && add-apt-repository  "deb http://deb.debian.org/debian stretch-backports main contrib non-free" -y \
 && apt-get update \
 && apt-get -y -t stretch-backports install git nodejs npm \
 && apt-get clean \
 && npm i npm@latest -g \
 && apt-get clean


# Build application
RUN mkdir -p /home/tib/
WORKDIR /home/tib/
# Copy the vocol files from the local repo to have all the changes
COPY . vocol
RUN  chmod u+x  .
WORKDIR /home/tib/vocol
#remove possible present builds of nodeModueles (ensures that the copy command will not add node_modules of a host system)
RUN rm -rdf node_modules \
 &&  npm install \
 && ./helper/scripts/resetApp.sh

EXPOSE 8080
EXPOSE 3030

ENV PORT=8080

#CMD [ "npm", "start","8080","3030"]
# port should be 3000 
CMD [ "npm", "start","3000","3030"]


### Building Docker file on local machines ###
# precondition you have on your local machine the repo
# docker build -t tib/vocol .
# Description :  docker run --name <ontology name>OntoVocol --restart=always -d -p <ontology port>|8080:3000 tib/vocol
# Example : docker run --name OntoVocol --restart=always -d -p 8080:3000 tib/vocol

###############################################################
#### to build and run the Dockerfile perform the following:####
#SSH to the host
#apt-get update
#sudo apt-get install unzip
#sudo apt-get install docker

#mkdir tibhannover
#cd tibhannover
#git clone https://github.com/tibhannover/vocol.git
#cd /vocol
#docker build -t tib/vocol .
# port should be 3000 because the -p option binds the localhost:8080 then to the docker port 3030 
#docker run --name <ontology name>OntoVocol --restart=always -d -p <ontology port>|8080:3030 tib/vocol 
################################################################
