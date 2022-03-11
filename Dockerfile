FROM node:16

RUN apt-get update -y && \
  apt-get install vim -y && \
  apt-get install sqlite3 -y && \
  apt-get clean -y

RUN mkdir /root/ec2bot_files && \
  mkdir /root/ec2bot_files/logs && \
  mkdir /root/ec2bot_files/sqlite3

WORKDIR /root/node_app

COPY . .

RUN npm install --silent && \
  npm install --silent --save sqlite3

EXPOSE 3000
CMD [ "node", "app.js" ]
