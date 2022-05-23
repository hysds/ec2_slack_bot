FROM node:18

# RUN npm install aws-sdk express fs node-cron redis
# # apt-get install jq -y && \

RUN apt-get update -y && \
  apt-get install vim -y && \
  apt-get install sqlite3 -y && \
  apt-get install python-is-python3 -y && \
  apt-get clean -y

# COPY package*.json ./
# RUN npm install

RUN mkdir /root/ec2bot_files && \
  mkdir /root/ec2bot_files/logs && \
  mkdir /root/ec2bot_files/sqlite3

WORKDIR /root/node_app

COPY . .

RUN npm install && \
  npm install --save sqlite3@5.0.8

EXPOSE 3000
CMD [ "node", "app.js" ]
