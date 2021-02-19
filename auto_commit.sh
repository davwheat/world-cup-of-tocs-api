#!/bin/bash
git commit "data/*.json" -m "Automated data commit (hourly cron)"
git push
