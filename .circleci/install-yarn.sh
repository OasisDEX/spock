#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

source ~/.bashrc

# setup node version
nvm install 10
nvm use 10

nvm alias default 10

npm install --global yarn

# Used when we have `apt-get` calls. there is a lock conflict
# and this code allows to way for the lock to be release before going any further
#
# date
# echo -n "Waiting for other software managers to finish..."
# while pgrep apt-get >/dev/null 2>&1 ; do
#     echo -n "."
#     sleep 5
# done
# echo ""
# date
