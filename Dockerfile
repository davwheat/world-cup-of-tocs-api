FROM node:lts-alpine
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --production --silent && mv node_modules ../
COPY . .
EXPOSE 2678
RUN chown -R node /usr/src/app
USER node
# Make sure to provide your twitter token as process.env.TWITTER_BEARER_TOKEN
# Image mounts itself to /usr/src/app - so mount a volume to /usr/src/app/data to store it here to store data
CMD ["npm", "start"]
