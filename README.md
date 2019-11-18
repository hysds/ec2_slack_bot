# Slack Chatbot to monitor EC2

## Architecture
![architecture](./images/ec2_bot_diagram.png)

## <strong>Pre-requisite steps:</strong>

<strong>1. Create app in Slack's User interface</strong>

<strong>2. Add scopes in the "OAuth and Permissions" pane</strong>
![scopes](./images/scopes.png)

<strong>3. Add request URL (your API endpoint which handles the Slack interactive message)</strong>
![request url](./images/request_url.png)

<strong>4. Adding the Slack channel ID (`SLACK_CHANNEL_ID` in `settings.js`):</strong>
![request url](./images/channel_id.png)

<strong>5. Copy your app's OAuth token into `SLACK_TOKEN` in `settings.js`</strong>

<strong>6. Set logging directory in `LOG_DIR` in `settings.js`</strong>

<strong>7. Add database credentials, and run the app</strong>

<strong>8a. Run `node app.js`</strong>

## If you are using Docker:
- `docker build -t ec2-instance-bot:<tag> . `
- `docker run -p 3000:3000 -d ec2-instance-bot:<tag>`
