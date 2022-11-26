read log
cat normalStdout.txt

read bot error log
cat errStdErr.txt

read pm2 error log
cat ~/.pm2/logs/timezone-error.log

read timezone data
cat data.json

start bot
pm2 start index.js

stop bot
pm2 stop index.js