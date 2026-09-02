#!/bin/bash

# 目標端口
PORTS=(443 3007)

for PORT in "${PORTS[@]}"; do
    # 找到佔用該端口的 PID
    PID=$(lsof -ti tcp:$PORT)
    
    if [ -n "$PID" ]; then
        echo "Killing process on port $PORT (PID: $PID)"
        kill -9 $PID
    else
        echo "No process found on port $PORT"
    fi
done

echo "Stop completed."
