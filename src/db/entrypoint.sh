#!/bin/bash
set -e

# Execute the original entrypoint script
exec /usr/local/bin/docker-entrypoint.sh postgres &

# Wait for the PostgreSQL service to start
until psql -U "$POSTGRES_USER" -lqt | cut -d \| -f 1 | grep -qw "postgres"; do
  echo "Waiting for PostgreSQL to start..."
  sleep 1
done

echo "Running update scripts..."

# Check if the update scripts folder exists
if [ -d "/docker-entrypoint-initdb.d/update-scripts" ]; then

  # Get the list of update scripts in the folder
  update_scripts=(/docker-entrypoint-initdb.d/update-scripts/*.sql)
  
  # Execute each update script in order
  for script in "${update_scripts[@]}"; do
    echo "Executing update script: $script"
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$script"
  done
fi

# Bring the container back to the foreground
wait -n