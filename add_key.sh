#!/bin/bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOkfSVrmDLLiFPYEyd7LMvyE6TOIca3RT72oxNC7QQ2i exam-system" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
echo "Key added successfully"
